import { getSupabaseConfigError, isSupabaseConfigured, listPaymentExceptions, listPaymentReconciliation } from '../_supabase.js';

function hasStaffAccess(req) {
  const expected = process.env.PLP_STAFF_CODE;
  const provided = req.headers['x-plp-staff-code'];
  return Boolean(expected && provided === expected);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!hasStaffAccess(req)) {
    return res.status(401).json({ ok: false, error: 'Staff access required' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ ok: false, error: getSupabaseConfigError() });
  }

  try {
    const rows = await listPaymentReconciliation(100);
    const exceptions = await listPaymentExceptions(100);
    return res.status(200).json({ ok: true, rows, exceptions });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Unable to load operations data', detail: error.message });
  }
}
