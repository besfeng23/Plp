import { getSupabaseConfigError, isSupabaseConfigured, rpc } from '../_supabase.js';

function mapPayPalStatus(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return 'SUCCEEDED';
  if (normalized === 'APPROVED') return 'AUTHORIZED';
  if (normalized === 'VOIDED') return 'VOIDED';
  if (normalized === 'PAYER_ACTION_REQUIRED') return 'PENDING';
  if (normalized.includes('FAIL') || normalized.includes('DECLIN')) return 'FAILED';
  return normalized || 'PENDING';
}

export async function createPayPalPaymentRecord({ bookingReference, session, amount, checkoutUrl, rawResponse }) {
  if (!isSupabaseConfigured()) {
    return { databaseWarning: getSupabaseConfigError(), databasePayment: null };
  }

  const providerSessionId = session?.paypalOrderId || rawResponse?.id || null;
  const stored = await rpc('create_paypal_payment_atomic', {
    p_payment: {
      bookingReference,
      providerSessionId,
      checkoutUrl: checkoutUrl || session?.checkoutUrl || null,
      amount: Number(amount || 0),
      currency: String(session?.currency || 'PHP').toUpperCase(),
      rawResponse: rawResponse || session || {},
    },
  });
  const databasePayment = Array.isArray(stored) ? stored[0] : stored;
  return { databaseWarning: null, databasePayment: databasePayment || null };
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

  const result = await rpc('record_paypal_capture_atomic', {
    p_event: {
      bookingReference,
      orderId,
      captureId,
      amount: amount == null ? null : String(amount),
      currency,
      status,
      payload: payload || {},
    },
  });
  const row = Array.isArray(result) ? result[0] : result;
  return {
    databaseWarning: null,
    databaseEvent: null,
    paymentStatus: mapPayPalStatus(status),
    verificationStatus: row?.verificationStatus || 'CAPTURE_NOT_VERIFIED',
    verificationNote: row?.verificationNote || 'Database did not return a verification result.',
  };
}
