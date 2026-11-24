import { deskAvailable, receiveEnquiry } from '../lib/concierge-desk.js';
import { CONCIERGE_NUMBER_DISPLAY } from '../lib/contact.js';
import { inquiryMailReady } from '../lib/inquiry-alert.js';
import { refuseUnlessAuthorized } from '../lib/preview-gate.js';

const required = ['name', 'email', 'interest'];

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (await refuseUnlessAuthorized(req, res)) return;
  if (req.method === 'GET') {
    if (await deskAvailable()) return res.status(200).json({ available: true, channel: 'desk' });
    return res.status(200).json(inquiryMailReady() ? { available: true, channel: 'email' } : { available: false });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const canPersist = typeof body?.requestId === 'string' && typeof body?.topic === 'string' && typeof body?.message === 'string';
    if (body?.channel === 'desk' || canPersist) {
      const [status, result] = await receiveEnquiry({ ...body, interest: body.interest });
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

    const { sendInquiryAlert } = await import('../lib/inquiry-alert.js');
    const emailDelivered = await sendInquiryAlert({ ...lead, requestId: body.requestId });

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
