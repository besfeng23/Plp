import { waitUntil } from '@vercel/functions';
import { notifyPaymentException, notifyPaymentVerified } from '../_notifications.js';
import { recordPayPalCapture } from './_db.js';
import { findBookingByReference, selectRows } from '../_supabase.js';
import { evaluatePayPalCapture } from '../../lib/paypal-capture-guard.js';
import { capturePayPalOrder, getBaseUrl } from './_paypal.js';

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-store');
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
  // PayPal redirects with GET. Reject unapproved methods without side effects.
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end();
  }


  if (!orderToken) {
    return redirect(res, `${baseUrl}/booking/cancel?${bookingQuery}provider=paypal&reason=missing-paypal-token`);
  }

  if (!bookingRef) {
    return redirect(res, `${baseUrl}/booking/cancel?provider=paypal&reason=missing-booking-reference`);
  }

  try {
    // A payment capture MUST be tied to the exact stored PayPal order. Do not
    // contact PayPal for a missing/mismatched/expired/previously paid record.
    if (typeof orderToken !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(orderToken) ||
        typeof bookingRef !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(bookingRef)) {
      return redirect(res, `${baseUrl}/booking/cancel?${bookingQuery}provider=paypal&reason=invalid-payment-return`);
    }
    const booking = await findBookingByReference(bookingRef);
    const records = await selectRows('plp_payments',
      `provider=eq.PAYPAL&provider_reference_id=eq.${encodeURIComponent(bookingRef)}&provider_session_id=eq.${encodeURIComponent(orderToken)}&select=id,booking_id,provider_reference_id,provider_session_id,amount_php,currency,status,verification_status&limit=1`);
    const state = evaluatePayPalCapture({
      booking, payment: records?.[0], bookingRef, orderToken,
    });
    if (state.decision === 'already_paid') {
      return redirect(res, `${baseUrl}/booking/success?${bookingQuery}provider=paypal&paypalOrderId=${encodeURIComponent(orderToken)}`);
    }
    if (state.decision !== 'capture') {
      return redirect(res, `${baseUrl}/booking/cancel?${bookingQuery}provider=paypal&reason=payment-needs-review`);
    }
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
    return redirect(res, `${baseUrl}/booking/cancel?${bookingQuery}provider=paypal&reason=payment-review-required`);
  }
}
