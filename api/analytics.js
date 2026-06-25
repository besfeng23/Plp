import { insertRow, isSupabaseConfigured } from './_supabase.js';

const ALLOWED_EVENTS = new Set([
  'view_page',
  'click_reserve',
  'click_email',
  'click_concierge',
  'view_booking',
  'select_room',
  'select_dates',
  'check_availability',
  'availability_result',
  'start_booking',
  'submit_booking',
  'booking_created',
  'start_checkout',
  'checkout_error',
  'payment_return_success',
  'payment_return_cancel',
  'view_accommodation',
  'view_experiences',
  'view_seo_page'
]);

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function cleanString(value, max = 160) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

function cleanPayload(payload = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (['name', 'email', 'phone', 'message', 'specialRequests'].includes(key)) continue;
    if (typeof value === 'string') safe[key] = cleanString(value, 240);
    else if (typeof value === 'number' || typeof value === 'boolean') safe[key] = value;
    else if (value == null) safe[key] = null;
  }
  return safe;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  let body = {};
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch {
    body = {};
  }

  const eventName = cleanString(body.event, 80);
  if (!ALLOWED_EVENTS.has(eventName)) {
    return json(res, 202, { ok: true, skipped: true });
  }

  const payload = cleanPayload(body.payload || {});
  const pagePath = cleanString(body.path || req.headers.referer || '/', 240);
  const sessionId = cleanString(body.sessionId, 80);

  if (!isSupabaseConfigured()) {
    return json(res, 202, { ok: true, stored: false, reason: 'analytics_not_configured' });
  }

  try {
    await insertRow('plp_analytics_events', {
      event_name: eventName,
      page_path: pagePath,
      session_id: sessionId || null,
      payload,
      user_agent: cleanString(req.headers['user-agent'], 240),
      referrer: cleanString(req.headers.referer, 240),
      created_at: new Date().toISOString()
    });
    return json(res, 200, { ok: true, stored: true });
  } catch (error) {
    return json(res, 202, { ok: true, stored: false, reason: 'analytics_table_unavailable' });
  }
}
