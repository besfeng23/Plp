import { insertRow, isSupabaseConfigured, selectRows } from './_supabase.js';

const DEFAULT_CONTENT = {
  homepage: {
    heroTitle: 'Pueblo La Perla',
    heroSubtitle: 'A private hillside retreat above Boracay’s white sands.',
    primaryCta: 'Reserve your stay'
  },
  accommodation: {
    grandOceanVilla: { name: 'Grand Ocean Villa', rate: 40000, capacity: 8, bedrooms: 4 },
    sunsetSuite: { name: 'Sunset Suite', rate: 18000, capacity: 4, bedrooms: 2 },
    smartRoomPremium: { name: 'Smart Room Premium', rate: 8000, capacity: 2, bedrooms: 1 }
  },
  experiences: {
    water: 'Paraw sailing, island hopping, snorkeling, and curated water activities.',
    wellness: 'Quiet recovery days and rest-focused island rhythm.',
    privateDining: 'Sunset dinners, in-villa meals, and intimate celebration arrangements.'
  },
  policies: {
    reservationNote: 'Final confirmation follows availability review and reservation completion.'
  }
};

const ALLOWED_EVENTS = new Set([
  'view_page', 'click_reserve', 'click_email', 'click_concierge', 'view_booking',
  'select_room', 'select_dates', 'check_availability', 'availability_result',
  'start_booking', 'submit_booking', 'booking_created', 'start_checkout', 'checkout_error',
  'payment_return_success', 'payment_return_cancel', 'view_accommodation', 'view_experiences', 'view_seo_page'
]);

function json(res, status, payload, cache = false) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  if (cache) res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.end(JSON.stringify(payload));
}

function actionOf(req) {
  return String(req.query?.action || '').trim().toLowerCase();
}

function cleanSection(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 80);
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

function parseBody(req) {
  try {
    return typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

async function handleContent(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  const section = cleanSection(req.query?.section || '');
  if (!isSupabaseConfigured()) {
    if (section) return json(res, 200, { section, content: DEFAULT_CONTENT[section] || null, source: 'default' }, true);
    return json(res, 200, { content: DEFAULT_CONTENT, source: 'default' }, true);
  }
  try {
    const query = section
      ? `section=eq.${encodeURIComponent(section)}&status=eq.PUBLISHED&select=section,content,updated_at&limit=1`
      : 'status=eq.PUBLISHED&select=section,content,updated_at&order=section.asc';
    const rows = await selectRows('plp_site_content', query);
    if (section) {
      return json(res, 200, { section, content: rows?.[0]?.content || DEFAULT_CONTENT[section] || null, source: rows?.[0] ? 'database' : 'default' }, true);
    }
    const content = { ...DEFAULT_CONTENT };
    for (const row of rows || []) content[row.section] = row.content;
    return json(res, 200, { content, source: rows?.length ? 'database' : 'default' }, true);
  } catch {
    if (section) return json(res, 200, { section, content: DEFAULT_CONTENT[section] || null, source: 'default', warning: 'content_table_unavailable' }, true);
    return json(res, 200, { content: DEFAULT_CONTENT, source: 'default', warning: 'content_table_unavailable' }, true);
  }
}

async function handleAnalytics(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const body = parseBody(req);
  const eventName = cleanString(body.event, 80);
  if (!ALLOWED_EVENTS.has(eventName)) return json(res, 202, { ok: true, skipped: true });

  if (!isSupabaseConfigured()) return json(res, 202, { ok: true, stored: false, reason: 'analytics_not_configured' });

  try {
    await insertRow('plp_analytics_events', {
      event_name: eventName,
      page_path: cleanString(body.path || req.headers.referer || '/', 240),
      session_id: cleanString(body.sessionId, 80) || null,
      payload: cleanPayload(body.payload || {}),
      user_agent: cleanString(req.headers['user-agent'], 240),
      referrer: cleanString(req.headers.referer, 240),
      created_at: new Date().toISOString()
    });
    return json(res, 200, { ok: true, stored: true });
  } catch {
    return json(res, 202, { ok: true, stored: false, reason: 'analytics_table_unavailable' });
  }
}

export default async function handler(req, res) {
  const action = actionOf(req);
  if (action === 'content' || (!action && req.method === 'GET')) return handleContent(req, res);
  if (action === 'analytics') return handleAnalytics(req, res);
  return json(res, 404, { ok: false, error: 'Unknown PLP action' });
}
