import { getAvailabilityConflicts } from './availabilityHelper.js';
import { getSupabaseConfigError, isSupabaseConfigured } from './_supabase.js';

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
    const result = await getAvailabilityConflicts({
      accommodationName: body.accommodation,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
    });

    return res.status(result.available ? 200 : 409).json({
      ok: result.available,
      available: result.available,
      conflictCount: result.conflictCount,
      invalidDateRange: Boolean(result.invalidDateRange),
      missingAccommodation: Boolean(result.missingAccommodation),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Availability check failed', detail: error.message });
  }
}
