import { CONCIERGE_EMAIL } from '../lib/contact.js';

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
    const from = process.env.LEADS_FROM_EMAIL;

    if (process.env.RESEND_API_KEY && from) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [CONCIERGE_EMAIL],
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

    if (!emailDelivered) {
      return res.status(503).json({
        ok: false,
        emailDelivered,
        error: `Online inquiry delivery is temporarily unavailable. Email ${CONCIERGE_EMAIL}.`,
      });
    }

    return res.status(200).json({
      ok: true,
      lead,
      emailDelivered,
      note: 'Lead email delivered.',
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Lead submission failed',
    });
  }
}
