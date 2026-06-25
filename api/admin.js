import { cancelBlockedDate, createBlockedDate, listAvailabilityCalendar, listBlockedDates } from './availabilityHelper.js';
import { notifyBookingStatus } from './_notifications.js';
import { getSupabaseConfigError, insertRow, isSupabaseConfigured, listPaymentExceptions, listPaymentReconciliation, selectRows, updateRows } from './_supabase.js';

const ALLOWED_CONTENT_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function hasStaffAccess(req) {
  const expected = process.env.PLP_STAFF_CODE;
  const provided = req.headers['x-plp-staff-code'];
  return Boolean(expected && provided && String(provided) === String(expected));
}

function actionOf(req) {
  return String(req.query?.action || req.query?.route || '').trim().toLowerCase();
}

function parseBody(req) {
  try {
    return typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

function cleanSection(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 80);
}

function cleanStatus(value) {
  const status = String(value || 'DRAFT').trim().toUpperCase();
  return ALLOWED_CONTENT_STATUSES.has(status) ? status : 'DRAFT';
}

async function handleOperations(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  const rows = await listPaymentReconciliation(100);
  const exceptions = await listPaymentExceptions(100);
  return json(res, 200, { ok: true, rows, exceptions });
}

async function handleNotifications(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  const rows = await selectRows('plp_notification_activity', 'select=*&limit=100');
  return json(res, 200, { ok: true, rows });
}

async function handleBookingStatus(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  const body = parseBody(req);
  const reference = String(body.reference || '').trim();
  const nextStatus = String(body.nextStatus || '').trim();
  if (!reference || !nextStatus) return json(res, 400, { ok: false, error: 'Missing reference or next status' });

  const rows = await selectRows('plp_payment_reconciliation', `booking_reference=eq.${encodeURIComponent(reference)}&select=*&limit=1`);
  const current = rows?.[0] || null;
  if (!current) return json(res, 404, { ok: false, error: 'Booking not found' });

  const payload = {};
  if (nextStatus === 'CONFIRMED') {
    const verifiedPayment = current.payment_verification_status === 'VERIFIED';
    const successfulPayment = ['SUCCEEDED', 'CAPTURED'].includes(current.payment_status) || ['SUCCEEDED', 'CAPTURED'].includes(current.booking_payment_status);
    if (!verifiedPayment || !successfulPayment) return json(res, 409, { ok: false, error: 'Deposit payment must be verified first.' });
    payload.status = 'CONFIRMED';
    payload.confirmed_at = new Date().toISOString();
  } else if (nextStatus === 'CANCELLED') {
    payload.status = 'CANCELLED';
    payload.cancelled_at = new Date().toISOString();
  } else if (nextStatus === 'PAYMENT_PROCESSING') {
    payload.status = 'PAYMENT_PROCESSING';
  } else {
    return json(res, 400, { ok: false, error: 'Unsupported status' });
  }

  const updated = await updateRows('plp_bookings', `booking_reference=eq.${encodeURIComponent(reference)}`, payload);
  let notifications = null;
  try {
    notifications = await notifyBookingStatus(reference, nextStatus);
  } catch (error) {
    notifications = { ok: false, error: error.message };
  }
  return json(res, 200, { ok: true, row: updated?.[0] || null, notifications });
}

async function handleDateBlocks(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) return json(res, 405, { ok: false, error: 'Method not allowed' });
  if (req.method === 'GET') {
    const [blockedDates, calendar] = await Promise.all([listBlockedDates(200), listAvailabilityCalendar(300)]);
    return json(res, 200, { ok: true, blockedDates, calendar });
  }
  const body = parseBody(req);
  if (req.method === 'PATCH') {
    const row = await cancelBlockedDate(body.id);
    return json(res, row ? 200 : 404, { ok: Boolean(row), row });
  }
  const result = await createBlockedDate({
    accommodationName: body.accommodation,
    startDate: body.startDate,
    endDate: body.endDate,
    reason: body.reason,
    createdBy: 'staff',
  });
  return json(res, result.ok ? 200 : 409, result);
}

async function handleContent(req, res) {
  if (req.method === 'GET') {
    const rows = await selectRows('plp_site_content', 'select=id,section,status,content,updated_at,updated_by&order=section.asc');
    return json(res, 200, { content: rows || [] });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const body = parseBody(req);
  const section = cleanSection(body.section);
  if (!section) return json(res, 400, { error: 'Section is required.' });
  if (!body.content || typeof body.content !== 'object' || Array.isArray(body.content)) return json(res, 400, { error: 'Content must be a JSON object.' });

  const payload = {
    section,
    content: body.content,
    status: cleanStatus(body.status),
    updated_by: String(body.updatedBy || 'staff').trim().slice(0, 120),
    updated_at: new Date().toISOString(),
  };
  const existing = await selectRows('plp_site_content', `section=eq.${encodeURIComponent(section)}&select=id&limit=1`);
  const saved = existing?.[0]
    ? (await updateRows('plp_site_content', `id=eq.${existing[0].id}`, payload))?.[0]
    : await insertRow('plp_site_content', payload);
  return json(res, 200, { ok: true, content: saved });
}

export default async function handler(req, res) {
  if (!hasStaffAccess(req)) return json(res, 401, { ok: false, error: 'Staff access required' });
  if (!isSupabaseConfigured()) return json(res, 503, { ok: false, error: getSupabaseConfigError() });

  try {
    const action = actionOf(req);
    if (action === 'operations') return await handleOperations(req, res);
    if (action === 'notifications') return await handleNotifications(req, res);
    if (action === 'booking-status') return await handleBookingStatus(req, res);
    if (action === 'date-blocks') return await handleDateBlocks(req, res);
    if (action === 'content') return await handleContent(req, res);
    return json(res, 404, { ok: false, error: 'Unknown admin action' });
  } catch (error) {
    return json(res, 500, { ok: false, error: 'Admin action failed', detail: error.message });
  }
}
