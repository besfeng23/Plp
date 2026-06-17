const required = ['name', 'email', 'interest'];

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
      return res.status(400).json({
        ok: false,
        error: 'Missing or invalid lead fields',
        missing,
      });
    }

    const lead = {
      name: String(body.name).slice(0, 120),
      email: String(body.email).slice(0, 180),
      phone: String(body.phone || '').slice(0, 60),
      interest: String(body.interest).slice(0, 120),
      preferredDates: String(body.preferredDates || '').slice(0, 120),
      message: String(body.message || '').slice(0, 1200),
      source: 'website',
      receivedAt: new Date().toISOString(),
    };

    let emailDelivered = false;

    if (process.env.RESEND_API_KEY && process.env.LEADS_TO_EMAIL) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.LEADS_FROM_EMAIL || 'Pueblo La Perla <onboarding@resend.dev>',
          to: [process.env.LEADS_TO_EMAIL],
          subject: `New Pueblo La Perla inquiry: ${lead.interest}`,
          text: [
            `Name: ${lead.name}`,
            `Email: ${lead.email}`,
            `Phone: ${lead.phone || '-'}`,
            `Interest: ${lead.interest}`,
            `Preferred dates: ${lead.preferredDates || '-'}`,
            '',
            lead.message || '-',
          ].join('\n'),
        }),
      });

      emailDelivered = response.ok;
    }

    return res.status(200).json({
      ok: true,
      lead,
      emailDelivered,
      note: emailDelivered
        ? 'Lead email delivered.'
        : 'Lead accepted. Add RESEND_API_KEY and LEADS_TO_EMAIL in Vercel to enable email delivery.',
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Lead submission failed',
    });
  }
}
