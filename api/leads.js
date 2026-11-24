import { deskAvailable, receiveEnquiry } from '../lib/concierge-desk.js';
import { CONCIERGE_NUMBER_DISPLAY } from '../lib/contact.js';
import { refuseUnlessAuthorized } from '../lib/preview-gate.js';

const required = ['name', 'email', 'interest'];

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function inquiryRecipient() {
  const value = process.env.LEADS_TO_EMAIL || process.env.BOOKINGS_TO_EMAIL || process.env.PLP_ADMIN_EMAIL || '';
  return isValidEmail(value) ? value : '';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (await refuseUnlessAuthorized(req, res)) return;
  if (req.method === 'GET') {
    if (await deskAvailable()) return res.status(200).json({ available: true, channel: 'desk' });
    const email = Boolean(process.env.RESEND_API_KEY && process.env.LEADS_FROM_EMAIL && inquiryRecipient());
    return res.status(200).json(email ? { available: true, channel: 'email' } : { available: false });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (body?.channel === 'desk') {
      const [status, result] = await receiveEnquiry(body);
      return res.status(status).json(result);
    }
    const missing = required.filter((field) => typeof body?.[field] !== 'string' || !body[field].trim());

    if (missing.length > 0 || !isValidEmail(body?.email?.trim?.())) {
      return res.status(400).json({
        ok: false,
        error: 'Missing or invalid lead fields',
        missing,
      });
    }

    const lead = {
      name: String(body.name).slice(0, 120),
      email: body.email.trim().slice(0, 180),
      phone: String(body.phone || '').slice(0, 60),
      interest: body.interest.trim().replace(/[\r\n]+/g, ' ').slice(0, 120),
      preferredDates: String(body.preferredDates || '').slice(0, 120),
      message: String(body.message || '').slice(0, 1200),
      source: 'website',
      receivedAt: new Date().toISOString(),
    };

    let emailDelivered = false;
    const from = process.env.LEADS_FROM_EMAIL;
    const recipient = inquiryRecipient();

    if (process.env.RESEND_API_KEY && from && recipient) {
      const requestId = typeof body.requestId === 'string' && /^[0-9a-f-]{36}$/i.test(body.requestId) ? body.requestId : null;
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          ...(requestId && { 'Idempotency-Key': 'plp-enquiry/' + requestId }),
        },
        body: JSON.stringify({
          from,
          to: [recipient],
          reply_to: lead.email,
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
        error: `Online inquiry delivery is temporarily unavailable. Please use the contact form or call ${CONCIERGE_NUMBER_DISPLAY}.`,
      });
    }

    return res.status(200).json({
      ok: true,
      ...(body.channel !== 'email' && { lead }),
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
