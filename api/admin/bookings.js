import { getSupabaseConfigError, isSupabaseConfigured, listPaymentExceptions, listPaymentReconciliation } from '../_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ ok: false, error: getSupabaseConfigError() });
  }

  try {
    const rows = await listPaymentReconciliation(100);
    const exceptions = await listPaymentExceptions(100);
    return res.status(200).json({ ok: true, rows, exceptions });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Unable to load bookings', detail: error.message });
  }
}
