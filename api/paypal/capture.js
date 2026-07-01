import { waitUntil } from '@vercel/functions';
import { notifyPaymentException, notifyPaymentVerified } from '../_notifications.js';
import { recordPayPalCapture } from './_db.js';
import { capturePayPalOrder, getBaseUrl } from './_paypal.js';

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  return res.end();
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function buildBookingQuery(bookingRef) {
  return bookingRef ? `bookingId=${encodeURIComponent(bookingRef)}&` : '';
}

function scheduleNotification(task) {
  const promise = Promise.resolve().then(task).catch(() => {
    // Notifications are non-critical; never fail the guest redirect on a notify error.
  });

  waitUntil(promise);
}

export default async function handler(req, res) {
  const baseUrl = getBaseUrl(req);
  const orderToken = firstQueryValue(req.query?.token);
  const bookingRef = firstQueryValue(req.query?.bookingRef);
  const bookingQuery = buildBookingQuery(bookingRef);

  if (!orderToken) {
    return redirect(res, `${baseUrl}/booking/cancel?${bookingQuery}provider=paypal&reason=missing-paypal-token`);
  }

  if (!bookingRef) {
    return redirect(res, `${baseUrl}/booking/cancel?provider=paypal&reason=missing-booking-reference`);
  }

  try {
    const capture = await capturePayPalOrder(orderToken);
    const databaseResult = await recordPayPalCapture({
      bookingReference: bookingRef,
      orderId: capture.orderId,
      captureId: capture.captureId,
      amount: capture.amount,
      currency: capture.currency,
      status: capture.status,
      payload: capture.raw,
    });

    const captureId = capture.captureId || capture.orderId;
    const verified = capture.status === 'COMPLETED' && databaseResult.verificationStatus === 'VERIFIED';

    // A verified PayPal deposit capture triggers the same guest/staff
    // "deposit verified" notification as the Xendit webhook path. The Promise is
    // created and passed to Vercel's supported waitUntil helper before the 302
    // response is ended, so email, Supabase writes, or provider latency never
    // block the guest redirect while Vercel still has an explicit background task
    // to keep alive. Duplicate emails are prevented by the unique
    // notification_key inside notifyPaymentVerified, so the deposit-verified copy
    // is idempotent. Verifying the deposit does NOT confirm the stay: the booking
    // stays in PAID_DEPOSIT and only staff confirmation in Admin Operations
    // finalizes it.
    if (verified) {
      scheduleNotification(() => notifyPaymentVerified(bookingRef));
      return redirect(res, `${baseUrl}/booking/success?${bookingQuery}provider=paypal&paypalOrderId=${encodeURIComponent(capture.orderId)}&captureId=${encodeURIComponent(captureId)}`);
    }

    if (
      databaseResult.verificationStatus &&
      !['VERIFIED', 'DUPLICATE', 'DATABASE_UNCONFIGURED'].includes(databaseResult.verificationStatus)
    ) {
      scheduleNotification(() => notifyPaymentException({
        reference: bookingRef,
        verificationStatus: databaseResult.verificationStatus,
        verificationNote: databaseResult.verificationNote,
        eventType: 'PAYPAL.ORDER.CAPTURE',
      }));
    }

    const reason = databaseResult.verificationStatus || capture.status || 'capture-not-verified';
    return redirect(res, `${baseUrl}/booking/cancel?${bookingQuery}provider=paypal&reason=${encodeURIComponent(reason)}`);
  } catch (error) {
    return redirect(res, `${baseUrl}/booking/cancel?${bookingQuery}provider=paypal&reason=${encodeURIComponent(error.message || 'paypal-capture-failed')}`);
  }
}
