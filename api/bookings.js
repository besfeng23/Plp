import { requireAvailability } from './_availabilityHelper.js';
import { notifyBookingCreated } from './_notifications.js';
import { createBookingRecord, getSupabaseConfigError, isSupabaseConfigured } from './_supabase.js';

const DEPOSIT_RATE = 0.3;

// Temporary live PayPal test pricing (2026 go-live verification).
// Nightly rates are intentionally low so a real guest can complete a live
// PayPal deposit without a large charge. 30% deposits are 90 / 60 / 30.
// The server-side computed deposit below remains the single source of truth;
// no browser-supplied amount can override it.
const accommodations = {
  'Grand Ocean Villa': { rate: 300, capacity: 8 },
  'Sunset Suite': { rate: 200, capacity: 4 },
  'Smart Room Premium': { rate: 100, capacity: 2 },
};

const required = ['name', 'email', 'phone', 'accommodation', 'checkIn', 'checkOut', 'guests'];

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function countNights(checkIn, checkOut) {
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  const diff = end.getTime() - start.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.round(diff / 86400000);
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

    const selected = accommodations[body.accommodation];
    if (!selected) return res.status(400).json({ ok: false, error: 'Invalid accommodation selected' });

    const guests = Number(body.guests);
    if (!Number.isFinite(guests) || guests < 1 || guests > selected.capacity) {
      return res.status(400).json({ ok: false, error: 'Guest count exceeds selected accommodation capacity' });
    }

    const nights = countNights(body.checkIn, body.checkOut);
    if (nights < 1) return res.status(400).json({ ok: false, error: 'Check-out date must be after check-in date' });

    const amount = nights * selected.rate;
    const deposit = Math.round(amount * DEPOSIT_RATE);
    const balance = Math.max(amount - deposit, 0);
    const reference = `PLP-${Date.now().toString().slice(-8)}`;

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
    return res.status(500).json({ ok: false, error: 'Booking request failed', detail: error.message });
  }
}
