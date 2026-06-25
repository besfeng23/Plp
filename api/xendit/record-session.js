import { createPaymentRecord, getSupabaseConfigError, isSupabaseConfigured } from '../_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ ok: false, error: getSupabaseConfigError() });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const booking = body.booking || {};
    const checkout = body.checkout || {};

    if (!booking.reference || !checkout.referenceId) {
      return res.status(400).json({ ok: false, error: 'Missing booking or Xendit session details' });
    }

    const databasePayment = await createPaymentRecord({
      bookingReference: booking.reference,
      session: checkout,
      amount: Number(booking.deposit || booking.paymentDue || 0),
      checkoutUrl: checkout.checkoutUrl,
      rawResponse: checkout,
    });

    return res.status(200).json({ ok: true, databasePayment });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Unable to record payment session', detail: error.message });
  }
}
