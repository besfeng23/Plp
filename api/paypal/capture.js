import { waitUntil } from '@vercel/functions';
import { notifyPaymentException, notifyPaymentVerified } from '../_notifications.js';
import { recordPayPalCapture } from './_db.js';
import { capturePayPalOrder, getBaseUrl } from './_paypal.js';
import { findBookingByReference, isSupabaseConfigured, selectRows } from '../_supabase.js';

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
  const cancel = (reason) => redirect(
    res,
    `${baseUrl}/booking/cancel?${bookingQuery}provider=paypal&reason=${encodeURIComponent(reason)}`
  );
  const success = (orderId, captureId) => redirect(
    res,
    `${baseUrl}/booking/success?${bookingQuery}provider=paypal&paypalOrderId=${encodeURIComponent(orderId)}&captureId=${encodeURIComponent(captureId || orderId)}`
  );

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end('Method not allowed');
  }
  if (!orderToken) return cancel('missing-paypal-token');
  if (!bookingRef) return cancel('missing-booking-reference');

  try {
    // Never capture first and discover afterward that the database session is
    // missing, belongs to a different booking, or has expired. A PayPal order
    // remains only approved until this handler explicitly captures it.
    if (!isSupabaseConfigured()) return cancel('payment-database-unavailable');

    const booking = await findBookingByReference(bookingRef);
    if (!booking) return cancel('booking-not-found');

    const paymentRows = await selectRows(
      'plp_payments',
      `provider=eq.PAYPAL&provider_reference_id=eq.${encodeURIComponent(bookingRef)}&select=provider_session_id,provider_payment_id,status,verification_status,checkout_url,amount_php,currency&limit=1`
    );
    const payment = paymentRows?.[0] || null;
    if (!payment) return cancel('payment-session-not-found');

    if (String(payment.provider_session_id || '') !== String(orderToken)) {
      return cancel('paypal-session-mismatch');
    }

    const paymentStatus = String(payment.status || '').toUpperCase();
    const verificationStatus = String(payment.verification_status || '').toUpperCase();

    // A guest may refresh the PayPal return URL. If we already verified this
    // exact order, return the receipt without trying to capture it a second time.
    if (
      verificationStatus === 'VERIFIED'
      && ['SUCCEEDED', 'CAPTURED'].includes(paymentStatus)
      && payment.provider_payment_id
    ) {
      return success(orderToken, payment.provider_payment_id);
    }

    const bookingStatus = String(booking.status || '').toUpperCase();
    const terminalBookingStatuses = new Set([
      'PAID_DEPOSIT', 'DEPOSIT_VERIFIED', 'CONFIRMED', 'CANCELLED', 'VOIDED',
      'FAILED', 'EXPIRED', 'REFUNDED', 'CHECKED_OUT', 'COMPLETED', 'NO_SHOW',
    ]);
    if (terminalBookingStatuses.has(bookingStatus)) return cancel('booking-not-payable');
    if (!['PENDING_PAYMENT', 'PAYMENT_PROCESSING'].includes(bookingStatus)) {
      return cancel('booking-not-payable');
    }

    if (booking.expires_at) {
      const expiresAt = Date.parse(booking.expires_at);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return cancel('booking-hold-expired');
      }
    }

    if (paymentStatus !== 'PENDING' || verificationStatus !== 'PENDING') {
      return cancel('payment-session-not-pending');
    }

    const capture = await capturePayPalOrder(orderToken);
    let databaseResult;
    try {
      databaseResult = await recordPayPalCapture({
        bookingReference: bookingRef,
        orderId: capture.orderId,
        captureId: capture.captureId,
        amount: capture.amount,
        currency: capture.currency,
        status: capture.status,
        payload: capture.raw,
      });
    } catch (error) {
      // PayPal may already have completed the capture. Surface an operator
      // exception instead of treating a failed database write as a failed charge.
      if (String(capture.status || '').toUpperCase() === 'COMPLETED') {
        scheduleNotification(() => notifyPaymentException({
          reference: bookingRef,
          verificationStatus: 'DATABASE_WRITE_FAILED',
          verificationNote: 'PayPal reported a completed capture but PLP could not save the verification result. Reconcile the payment before confirming the stay.',
          eventType: 'PAYPAL.ORDER.CAPTURE',
        }));
        return cancel('payment-reconciliation-pending');
      }
      throw error;
    }

    const captureId = capture.captureId || capture.orderId;
    const verified = capture.status === 'COMPLETED' && databaseResult.verificationStatus === 'VERIFIED';

    // Verified deposit is not final confirmation; staff must still confirm
    // availability in Admin Operations.
    if (verified) {
      scheduleNotification(() => notifyPaymentVerified(bookingRef));
      return success(capture.orderId, captureId);
    }

    if (
      databaseResult.verificationStatus
      && !['VERIFIED', 'DUPLICATE', 'DATABASE_UNCONFIGURED'].includes(databaseResult.verificationStatus)
    ) {
      scheduleNotification(() => notifyPaymentException({
        reference: bookingRef,
        verificationStatus: databaseResult.verificationStatus,
        verificationNote: databaseResult.verificationNote,
        eventType: 'PAYPAL.ORDER.CAPTURE',
      }));
    }

    return cancel(databaseResult.verificationStatus || capture.status || 'capture-not-verified');
  } catch {
    // Do not place raw provider or database errors in the redirect URL.
    return cancel('paypal-capture-failed');
  }
}
