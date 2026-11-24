import { getAvailabilityConflicts, getUnavailableNights } from './_availabilityHelper.js';
import { isSupabaseConfigured } from './_supabase.js';
import { shiftMonth, todayAtResort, validDate } from '../lib/booking-dates.js';
import { PLP_ROOMS } from '../lib/pricing.js';
import { refuseUnlessAuthorized } from '../lib/preview-gate.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (await refuseUnlessAuthorized(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ ok: false, error: 'Availability is temporarily unavailable.' });
  }

  try {
    if (req.method === 'GET') {
      const { month, room } = req.query || {};
      const selected = PLP_ROOMS.find(item => item.key === room);
      const start = `${month}-01`;
      if (typeof month !== 'string' || !validDate(start) || month < todayAtResort().slice(0, 7) ||
          month >= '9999-12' || !selected) {
        return res.status(400).json({ ok: false, error: 'Choose an accommodation and a valid month.' });
      }
      const unavailableNights = await getUnavailableNights(selected.name, start, `${shiftMonth(month, 1)}-01`);
      if (!unavailableNights) {
        return res.status(404).json({ ok: false, error: 'This accommodation is unavailable.' });
      }
      return res.status(200).json({ ok: true, month, room, unavailableNights });
    }

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
  } catch {
    return res.status(503).json({ ok: false, error: 'Availability is temporarily unavailable.' });
  }
}
