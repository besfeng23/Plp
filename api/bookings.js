import { requireAvailability } from './_availabilityHelper.js';
import { notifyBookingCreated } from './_notifications.js';
import { createBookingRecord, getSupabaseConfigError, isSupabaseConfigured } from './_supabase.js';
import { PLP_ROOMS, quoteStay } from '../lib/pricing.js';
import { nightsBetween, todayAtResort } from '../lib/booking-dates.js';
import { createBookingReference } from '../lib/booking-reference.js';

const required = ['name', 'email', 'phone', 'accommodation', 'checkIn', 'checkOut', 'guests'];

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const missing = required.filter((field) => !body[field]);

    if (missing.length > 0 || !isValidEmail(body.email)) {
      return res.status(400).json({ ok: false, error: 'Missing or invalid booking fields', missing });
    }

    const selected = PLP_ROOMS.find(room => room.name === body.accommodation);
    if (!selected) return res.status(400).json({ ok: false, error: 'Invalid accommodation selected' });

    const guests = Number(body.guests);
    if (!Number.isInteger(guests) || guests < 1 || guests > selected.capacity) {
      return res.status(400).json({ ok: false, error: 'Guest count exceeds selected accommodation capacity' });
    }

    const nights = nightsBetween(body.checkIn, body.checkOut);
    if (nights < 1) return res.status(400).json({ ok: false, error: 'Check-out date must be after check-in date' });
    if (body.checkIn < todayAtResort()) {
      return res.status(400).json({ ok: false, error: 'Check-in cannot be before today in Boracay.' });
    }

    const { amount, deposit, balance } = quoteStay(selected, nights);
    if (body.quote && (body.quote.amount !== amount || body.quote.deposit !== deposit)) {
      return res.status(409).json({ ok: false, error: 'The rate has changed. Refresh this page to review the updated quote.' });
    }
    const reference = createBookingReference();

    const booking = {
      reference,
      name: String(body.name).slice(0, 120),
      email: String(body.email).slice(0, 180),
      phone: String(body.phone).slice(0, 60),
      accommodation: String(body.accommodation).slice(0, 120),
      checkIn: String(body.checkIn).slice(0, 40),
      checkOut: String(body.checkOut).slice(0, 40),
      guests,
      nights,
      rate: selected.rate,
      amount,
      deposit,
      balance,
      paymentDue: deposit,
      paymentStatus: 'Awaiting Deposit Checkout',
      status: 'Pending Deposit',
      message: String(body.message || '').slice(0, 1200),
      receivedAt: new Date().toISOString(),
      persisted: false,
    };

    let databaseRecord = null;
    let databaseWarning = null;
    let availability = null;
    if (isSupabaseConfigured()) {
      availability = await requireAvailability({ accommodationName: booking.accommodation, checkIn: booking.checkIn, checkOut: booking.checkOut });
      if (!availability.available) {
        return res.status(409).json({ ok: false, error: availability.error, conflictCount: availability.conflictCount });
      }
      databaseRecord = await createBookingRecord(booking);
      booking.databaseId = databaseRecord.id;
      booking.persisted = true;
    } else {
      databaseWarning = getSupabaseConfigError();
    }

    let notifications = null;
    if (booking.persisted) {
      try {
        notifications = await notifyBookingCreated({ booking, databaseRecord });
      } catch (error) {
        notifications = { ok: false, error: error.message };
      }
    }

    return res.status(200).json({
      ok: true,
      booking,
      availabilityChecked: Boolean(availability),
      databaseRecord,
      databaseWarning,
      notifications,
      note: booking.persisted
        ? 'Booking request accepted, availability-held, and persisted. Continue to the secure deposit checkout.'
        : 'Booking request accepted but not persisted. Add Supabase environment variables in Vercel.',
    });
  } catch (error) {
    if (error.code === '23P01' || /overlaps active inventory|not available for those dates/i.test(error.message)) {
      return res.status(409).json({ ok: false, error: 'Selected accommodation is not available for those dates.' });
    }
    if (/rate does not match|price or deposit is invalid/i.test(error.message)) {
      return res.status(409).json({ ok: false, error: 'The rate has changed. Refresh this page to review the updated quote.' });
    }
    // Log only the PostgreSQL error class, never guest PII, payloads, credentials,
    // or raw database details. A generic 503 is still appropriate for guests.
    const sqlState = typeof error?.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code)
      ? error.code : 'UNKNOWN';
    console.error('[plp-booking] unable to persist reservation request', { sqlState });
    return res.status(503).json({ ok: false, error: 'Your request could not be saved. Please contact concierge.' });
  }
}
