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
  if (!isSupabaseConfigured()) return { databaseWarning: getSupabaseConfigError(), databaseEvent: null };

  const booking = bookingReference ? await findBookingByReference(bookingReference) : null;
  const paymentRows = bookingReference
    ? await selectRows('plp_payments', `provider=eq.PAYPAL&provider_reference_id=eq.${encodeFilterValue(bookingReference)}&select=id,booking_id,amount_php,currency,status,verification_status&limit=1`)
    : [];
  const payment = paymentRows?.[0] || null;
  const paymentStatus = mapPayPalStatus(status);
  const receivedAmount = Number(amount || 0);
  const receivedCurrency = String(currency || '').toUpperCase();
  const expectedAmount = Number(payment?.amount_php || booking?.deposit_amount_php || 0);

  let verificationStatus = 'VERIFIED';
  let verificationNote = 'PayPal capture matched booking reference, payment record, amount, and currency.';

  if (!booking) {
    verificationStatus = 'UNMATCHED_REFERENCE';
    verificationNote = 'No booking was found for this PayPal reference.';
  } else if (!payment) {
    verificationStatus = 'UNMATCHED_PAYMENT';
    verificationNote = 'No payment session was found for this PayPal reference.';
  } else if (isFinalPositiveStatus(paymentStatus) && receivedCurrency !== 'PHP') {
    verificationStatus = 'CURRENCY_MISMATCH';
    verificationNote = `Expected PHP but received ${receivedCurrency || 'missing currency'}.`;
  } else if (isFinalPositiveStatus(paymentStatus) && (!receivedAmount || receivedAmount !== expectedAmount)) {
    verificationStatus = 'AMOUNT_MISMATCH';
    verificationNote = `Expected ${expectedAmount} but received ${receivedAmount || 'missing amount'}.`;
  }

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
    expected_amount_php: expectedAmount || null,
    expected_currency: 'PHP',
    verification_status: verificationStatus,
    verification_notes: verificationNote,
    payload: payload || {},
    processed_at: new Date().toISOString(),
  });

  if (payment?.id) {
    await updateRows('plp_payments', `id=eq.${payment.id}`, {
      provider_payment_id: captureId || orderId || null,
      amount_php: amount ? Number(amount) : payment.amount_php,
      currency: currency || 'PHP',
      status: paymentStatus,
      verification_status: verificationStatus,
      verification_error: verificationStatus === 'VERIFIED' ? null : verificationNote,
      last_webhook_id: captureId || orderId || null,
      paid_at: verificationStatus === 'VERIFIED' && isFinalPositiveStatus(paymentStatus) ? new Date().toISOString() : null,
      raw_response: payload || {},
    });
  }

  if (booking?.id && verificationStatus === 'VERIFIED') {
    await updateRows('plp_bookings', `id=eq.${booking.id}`, {
      status: mapBookingStatus(paymentStatus),
      payment_status: paymentStatus,
    });
  }

  return { databaseWarning: null, databaseEvent: event, paymentStatus, verificationStatus, verificationNote };
}
