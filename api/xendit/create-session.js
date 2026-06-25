function getBaseUrl(req) {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = req.headers.host || 'plp-boracay.vercel.app';
  return `https://${host}`;
}

function normalizePhone(phone) {
  const raw = String(phone || '').trim().replace(/[\s()-]/g, '');
  if (!raw) return undefined;
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('09')) return `+63${raw.slice(1)}`;
  if (raw.startsWith('639')) return `+${raw}`;
  return undefined;
}

function cleanPersonName(value, fallback) {
  const cleaned = String(value || fallback || 'Guest')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .slice(0, 50);
  return cleaned || fallback || 'Guest';
}

function splitName(name) {
  const parts = String(name || 'Guest').trim().split(/\s+/).filter(Boolean);
  return {
    given: cleanPersonName(parts[0], 'Guest'),
    surname: cleanPersonName(parts.slice(1).join(' '), 'Guest'),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const booking = body.booking || body;
    const reference = String(booking.reference || '').slice(0, 64);
    const amount = Number(booking.deposit || booking.paymentDue || 0);

    if (!reference || !booking.name || !booking.email || !amount || amount < 1) {
      return res.status(400).json({ ok: false, error: 'Missing booking reference, guest details, or deposit amount' });
    }

    if (!process.env.XENDIT_SECRET_KEY) {
      return res.status(503).json({
        ok: false,
        error: 'Xendit is not configured yet. Add XENDIT_SECRET_KEY in Vercel environment variables.',
      });
    }

    const baseUrl = getBaseUrl(req);
    const names = splitName(booking.name);
    const customerReference = `guest${reference.replace(/[^a-zA-Z0-9]/g, '')}`.slice(0, 64);
    const auth = Buffer.from(`${process.env.XENDIT_SECRET_KEY}:`).toString('base64');

    const payload = {
      reference_id: reference,
      session_type: 'PAY',
      mode: 'PAYMENT_LINK',
      amount,
      currency: 'PHP',
      country: 'PH',
      capture_method: 'AUTOMATIC',
      locale: 'en',
      description: `Pueblo La Perla reservation deposit ${reference}`,
      customer: {
        reference_id: customerReference,
        type: 'INDIVIDUAL',
        email: String(booking.email).slice(0, 50),
        individual_detail: {
          given_names: names.given,
          surname: names.surname,
        },
      },
      items: [
        {
          reference_id: `deposit_${reference}`.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 255),
          name: `${booking.accommodation || 'Pueblo La Perla'} reservation deposit`.slice(0, 255),
          description: `${booking.checkIn || ''} to ${booking.checkOut || ''}`.trim().slice(0, 255) || 'Reservation deposit',
          type: 'PHYSICAL_SERVICE',
          category: 'ACCOMMODATION',
          net_unit_amount: amount,
          quantity: 1,
          currency: 'PHP',
          url: baseUrl,
        },
      ],
      success_return_url: `${baseUrl}/booking/success?bookingId=${encodeURIComponent(reference)}`,
      cancel_return_url: `${baseUrl}/booking/cancel?bookingId=${encodeURIComponent(reference)}`,
      metadata: {
        booking_reference: reference,
        accommodation: String(booking.accommodation || '').slice(0, 80),
        check_in: String(booking.checkIn || '').slice(0, 40),
        check_out: String(booking.checkOut || '').slice(0, 40),
      },
    };

    const mobileNumber = normalizePhone(booking.phone);
    if (mobileNumber) payload.customer.mobile_number = mobileNumber;

    const response = await fetch('https://api.xendit.co/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: 'Xendit session creation failed', details: data });
    }

    return res.status(201).json({
      ok: true,
      checkoutUrl: data.payment_link_url,
      paymentSessionId: data.payment_session_id,
      referenceId: data.reference_id,
      status: data.status,
      expiresAt: data.expires_at,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Unable to create Xendit checkout session' });
  }
}
