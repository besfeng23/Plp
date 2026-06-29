import {
  findBookingByReference,
  getSupabaseConfigError,
  insertRow,
  isSupabaseConfigured,
  selectRows,
  updateRows,
} from '../_supabase.js';

function encodeFilterValue(value) {
  return encodeURIComponent(String(value));
}

function mapPayPalStatus(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return 'SUCCEEDED';
  if (normalized === 'APPROVED') return 'AUTHORIZED';
  if (normalized === 'VOIDED') return 'VOIDED';
  if (normalized === 'PAYER_ACTION_REQUIRED') return 'PENDING';
  if (normalized.includes('FAIL') || normalized.includes('DECLIN')) return 'FAILED';
  return normalized || 'PENDING';
}

function mapBookingStatus(paymentStatus) {
  if (paymentStatus === 'SUCCEEDED' || paymentStatus === 'CAPTURED') return 'PAID_DEPOSIT';
  if (paymentStatus === 'FAILED') return 'FAILED';
  if (paymentStatus === 'VOIDED') return 'CANCELLED';
  return 'PAYMENT_PROCESSING';
}

function isFinalPositiveStatus(paymentStatus) {
  return paymentStatus === 'SUCCEEDED' || paymentStatus === 'CAPTURED';
}

function getVerificationResult({ booking, payment, orderId, amount, currency, paymentStatus }) {
  if (!booking) {
    return { status: 'UNMATCHED_REFERENCE', note: 'No booking was found for this PayPal reference.' };
  }

  if (!payment) {
    return { status: 'UNMATCHED_PAYMENT', note: 'No payment session was found for this PayPal reference.' };
  }

  const expectedOrderId = String(payment.provider_session_id || '').trim();
  const receivedOrderId = String(orderId || '').trim();
  if (!expectedOrderId) {
    return { status: 'ORDER_SESSION_MISSING', note: 'Stored PayPal payment row is missing the PayPal order/session id.' };
  }
  if (!receivedOrderId) {
    return { status: 'ORDER_ID_MISSING', note: 'PayPal capture response did not include an order id.' };
  }
  if (expectedOrderId !== receivedOrderId) {
    return { status: 'ORDER_ID_MISMATCH', note: 'PayPal order id does not match the stored payment session.' };
  }

  if (!isFinalPositiveStatus(paymentStatus)) {
    return { status: 'CAPTURE_NOT_COMPLETED', note: `PayPal capture is not completed. Received status ${paymentStatus || 'unknown'}.` };
  }

  const expectedAmount = Number(payment.amount_php || booking.deposit_amount_php || 0);
  const receivedAmount = Number(amount || 0);
  const receivedCurrency = String(currency || '').toUpperCase();

  if (receivedCurrency !== 'PHP') {
    return { status: 'CURRENCY_MISMATCH', note: `Expected PHP but received ${receivedCurrency || 'missing currency'}.`, expectedAmount };
  }
  if (!receivedAmount || receivedAmount !== expectedAmount) {
    return { status: 'AMOUNT_MISMATCH', note: `Expected ${expectedAmount} but received ${receivedAmount || 'missing amount'}.`, expectedAmount };
  }

  return { status: 'VERIFIED', note: 'PayPal capture matched booking reference, stored order id, payment record, amount, and currency.', expectedAmount };
}

export async function createPayPalPaymentRecord({ bookingReference, session, amount, checkoutUrl, rawResponse }) {
  if (!isSupabaseConfigured()) return { databaseWarning: getSupabaseConfigError(), databasePayment: null };

  const booking = await findBookingByReference(bookingReference);
  if (!booking) throw new Error(`Booking ${bookingReference} was not found`);

  const providerSessionId = session?.paypalOrderId || rawResponse?.id || null;
  const providerReferenceId = bookingReference;
  const existing = await selectRows('plp_payments', `provider=eq.PAYPAL&provider_reference_id=eq.${encodeFilterValue(providerReferenceId)}&select=id&limit=1`);

  const payload = {
    provider_session_id: providerSessionId,
    checkout_url: checkoutUrl || session?.checkoutUrl || null,
    amount_php: Number(amount || booking.deposit_amount_php || 0),
    currency: 'PHP',
    status: 'PENDING',
    verification_status: 'PENDING',
    verification_error: null,
    raw_response: rawResponse || session || {},
    expires_at: null,
  };

  if (existing?.[0]) {
    const updated = await updateRows('plp_payments', `id=eq.${existing[0].id}`, payload);
    return { databaseWarning: null, databasePayment: updated?.[0] || null };
  }

  const payment = await insertRow('plp_payments', {
    booking_id: booking.id,
    provider: 'PAYPAL',
    provider_reference_id: providerReferenceId,
    ...payload,
  });

  await updateRows('plp_bookings', `id=eq.${booking.id}`, {
    status: 'PAYMENT_PROCESSING',
    payment_status: 'PROCESSING',
  });

  return { databaseWarning: null, databasePayment: payment };
}

export async function recordPayPalCapture({ bookingReference, orderId, captureId, amount, currency, status, payload }) {
  if (!isSupabaseConfigured()) {
    return {
      databaseWarning: getSupabaseConfigError(),
      databaseEvent: null,
      paymentStatus: mapPayPalStatus(status),
      verificationStatus: 'DATABASE_UNCONFIGURED',
      verificationNote: getSupabaseConfigError(),
    };
  }

  const booking = bookingReference ? await findBookingByReference(bookingReference) : null;
  const paymentRows = bookingReference
    ? await selectRows('plp_payments', `provider=eq.PAYPAL&provider_reference_id=eq.${encodeFilterValue(bookingReference)}&select=id,booking_id,provider_session_id,amount_php,currency,status,verification_status&limit=1`)
    : [];
  const payment = paymentRows?.[0] || null;
  const paymentStatus = mapPayPalStatus(status);
  const verification = getVerificationResult({ booking, payment, orderId, amount, currency, paymentStatus });
  const expectedAmount = verification.expectedAmount || Number(payment?.amount_php || booking?.deposit_amount_php || 0) || null;

  const event = await insertRow('plp_payment_events', {
    payment_id: payment?.id || null,
    booking_id: booking?.id || payment?.booking_id || null,
    provider: 'PAYPAL',
    provider_event_id: captureId || orderId || null,
    event_type: 'PAYPAL.ORDER.CAPTURE',
    provider_reference_id: bookingReference || null,
    provider_payment_id: captureId || orderId || null,
    amount_php: amount ? Number(amount) : null,
    currency: currency || null,
    status: status || null,
    expected_amount_php: expectedAmount,
    expected_currency: 'PHP',
    verification_status: verification.status,
    verification_notes: verification.note,
    payload: payload || {},
    processed_at: new Date().toISOString(),
  });

  if (payment?.id) {
    if (verification.status === 'VERIFIED') {
      await updateRows('plp_payments', `id=eq.${payment.id}`, {
        provider_payment_id: captureId || orderId || null,
        amount_php: amount ? Number(amount) : payment.amount_php,
        currency: currency || 'PHP',
        status: paymentStatus,
        verification_status: 'VERIFIED',
        verification_error: null,
        last_webhook_id: captureId || orderId || null,
        paid_at: isFinalPositiveStatus(paymentStatus) ? new Date().toISOString() : null,
        raw_response: payload || {},
      });
    } else {
      await updateRows('plp_payments', `id=eq.${payment.id}`, {
        provider_payment_id: captureId || orderId || null,
        verification_status: verification.status,
        verification_error: verification.note,
        last_webhook_id: captureId || orderId || null,
        raw_response: payload || {},
      });
    }
  }

  if (booking?.id && verification.status === 'VERIFIED') {
    await updateRows('plp_bookings', `id=eq.${booking.id}`, {
      status: mapBookingStatus(paymentStatus),
      payment_status: paymentStatus,
    });
  }

  return {
    databaseWarning: null,
    databaseEvent: event,
    paymentStatus,
    verificationStatus: verification.status,
    verificationNote: verification.note,
  };
}
