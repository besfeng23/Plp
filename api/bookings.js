const DEPOSIT_RATE = 0.3;

const accommodations = {
  'Grand Ocean Villa': { rate: 40000, capacity: 8 },
  'Sunset Suite': { rate: 18000, capacity: 4 },
  'Smart Room Premium': { rate: 8000, capacity: 2 },
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

function currency(value) {
  return `PHP ${Number(value || 0).toLocaleString('en-PH')}`;
}

async function sendEmail({ to, subject, text }) {
  if (!process.env.RESEND_API_KEY) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.BOOKINGS_FROM_EMAIL || process.env.LEADS_FROM_EMAIL || 'Pueblo La Perla <onboarding@resend.dev>',
      to: [to],
      subject,
      text,
    }),
  });

  return response.ok;
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
    if (!selected) {
      return res.status(400).json({ ok: false, error: 'Invalid accommodation selected' });
    }

    const guests = Number(body.guests);
    if (!Number.isFinite(guests) || guests < 1 || guests > selected.capacity) {
      return res.status(400).json({ ok: false, error: 'Guest count exceeds selected accommodation capacity' });
    }

    const nights = countNights(body.checkIn, body.checkOut);
    if (nights < 1) {
      return res.status(400).json({ ok: false, error: 'Check-out date must be after check-in date' });
    }

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
      paymentStatus: 'Awaiting Xendit Checkout',
      status: 'Pending Deposit',
      message: String(body.message || '').slice(0, 1200),
      receivedAt: new Date().toISOString(),
    };

    const guestText = [
      `Dear ${booking.name},`,
      '',
      'Thank you for your Pueblo La Perla Boracay reservation request. Your booking reference has been created and will be attached to your secure Xendit deposit checkout.',
      '',
      `Booking reference: ${booking.reference}`,
      `Accommodation: ${booking.accommodation}`,
      `Check-in: ${booking.checkIn}`,
      `Check-out: ${booking.checkOut}`,
      `Nights: ${booking.nights}`,
      `Guests: ${booking.guests}`,
      `Estimated total stay: ${currency(booking.amount)}`,
      `Reservation deposit due now: ${currency(booking.deposit)}`,
      `Estimated balance after deposit: ${currency(booking.balance)}`,
      '',
      'Your reservation is not final until payment is verified and the resort confirms availability.',
      '',
      'Pueblo La Perla Boracay',
      'plpvillas@gmail.com',
    ].join('\n');

    const adminText = [
      'New Pueblo La Perla reservation deposit request received.',
      '',
      `Reference: ${booking.reference}`,
      `Guest: ${booking.name}`,
      `Email: ${booking.email}`,
      `Phone: ${booking.phone}`,
      `Accommodation: ${booking.accommodation}`,
      `Dates: ${booking.checkIn} to ${booking.checkOut}`,
      `Nights: ${booking.nights}`,
      `Guests: ${booking.guests}`,
      `Estimated total stay: ${currency(booking.amount)}`,
      `Deposit due now: ${currency(booking.deposit)}`,
      `Estimated balance: ${currency(booking.balance)}`,
      '',
      `Message: ${booking.message || '-'}`,
    ].join('\n');

    const guestEmailSent = await sendEmail({
      to: booking.email,
      subject: `Pueblo La Perla reservation ${booking.reference}`,
      text: guestText,
    });

    const adminTo = process.env.BOOKINGS_TO_EMAIL || process.env.LEADS_TO_EMAIL;
    const adminEmailSent = adminTo
      ? await sendEmail({ to: adminTo, subject: `New deposit reservation ${booking.reference}`, text: adminText })
      : false;

    return res.status(200).json({
      ok: true,
      booking,
      guestEmailSent,
      adminEmailSent,
      note: 'Booking request accepted. Continue to Xendit deposit checkout.',
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Booking request failed' });
  }
}
