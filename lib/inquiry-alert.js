import { CONCIERGE_NUMBER_DISPLAY } from './contact.js';

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function inquiryRecipient(env = process.env) {
  const value = env.LEADS_TO_EMAIL || env.BOOKINGS_TO_EMAIL || env.PLP_ADMIN_EMAIL || '';
  return isValidEmail(value) ? value : '';
}

export function inquiryFromAddress(env = process.env) {
  return env.LEADS_FROM_EMAIL || env.BOOKINGS_FROM_EMAIL || '';
}

export function inquiryMailReady(env = process.env) {
  return Boolean(env.RESEND_API_KEY && inquiryFromAddress(env) && inquiryRecipient(env));
}

export async function sendInquiryAlert(enquiry, env = process.env) {
  const to = inquiryRecipient(env);
  const from = inquiryFromAddress(env);
  if (!env.RESEND_API_KEY || !from || !to) return false;
  const name = String(enquiry?.name || '').trim() || 'Guest';
  const interest = String(enquiry?.interest || 'Enquiry').trim();
  const requestId = typeof enquiry?.requestId === 'string' && /^[0-9a-f-]{36}$/i.test(enquiry.requestId) ? enquiry.requestId.toLowerCase() : null;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(requestId && { 'Idempotency-Key': 'plp-enquiry/' + requestId }),
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: isValidEmail(enquiry?.email) ? enquiry.email : undefined,
      subject: `New Pueblo La Perla inquiry: ${interest}`.slice(0, 200),
      text: [
        `Name: ${name}`,
        `Email: ${enquiry?.email || '-'}`,
        `Phone: ${enquiry?.phone || '-'}`,
        `Interest: ${interest}`,
        `Preferred dates: ${enquiry?.preferredDates || '-'}`,
        '',
        enquiry?.message || '-',
        '',
        `If you need to reach the guest another way, the public sales number is ${CONCIERGE_NUMBER_DISPLAY}.`,
      ].join('\n'),
    }),
  });
  return response.ok;
}
