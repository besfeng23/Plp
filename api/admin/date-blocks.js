import { cancelBlockedDate, createBlockedDate, listAvailabilityCalendar, listBlockedDates } from '../availabilityHelper.js';
import { getSupabaseConfigError, isSupabaseConfigured } from '../_supabase.js';

function hasStaffAccess(req) {
  const expected = process.env.PLP_STAFF_CODE;
  const provided = req.headers['x-plp-staff-code'];
  return Boolean(expected && provided === expected);
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!hasStaffAccess(req)) {
    return res.status(401).json({ ok: false, error: 'Staff access required' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ ok: false, error: getSupabaseConfigError() });
  }

  try {
    if (req.method === 'GET') {
      const [blockedDates, calendar] = await Promise.all([
        listBlockedDates(200),
        listAvailabilityCalendar(300),
      ]);
      return res.status(200).json({ ok: true, blockedDates, calendar });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    if (req.method === 'PATCH') {
      const row = await cancelBlockedDate(body.id);
      return res.status(row ? 200 : 404).json({ ok: Boolean(row), row });
    }

    const result = await createBlockedDate({
      accommodationName: body.accommodation,
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason,
      createdBy: 'staff',
    });
    return res.status(result.ok ? 200 : 409).json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Date block operation failed', detail: error.message });
  }
}
