import { cancelBlockedDate, createBlockedDate, listAvailabilityCalendar, listBlockedDates } from './availabilityHelper.js';
import { notifyBookingStatus } from './_notifications.js';
import { getSupabaseConfigError, insertRow, isSupabaseConfigured, listPaymentExceptions, listPaymentReconciliation, selectRows, updateRows } from './_supabase.js';
import { getOtaReservationReviewSummary, listOtaReservationImports, stageOtaReservationImport, updateOtaReservationReview } from './otaReservationImporter.js';

const ALLOWED_CONTENT_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const STAFF_TASK_KINDS = new Set(['task', 'note']);
const STAFF_TASK_CATEGORIES = new Set(['concierge', 'housekeeping', 'payment', 'arrival', 'availability', 'admin']);
const STAFF_TASK_PRIORITIES = new Set(['high', 'medium', 'normal']);
const STAFF_TASK_STATUSES = new Set(['open', 'in_progress', 'done', 'cancelled']);

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

function cleanText(value, max = 500) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

function cleanEnum(value, allowed, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase().replace(/[\s-]+/g, '_');
  return allowed.has(normalized) ? normalized : fallback;
}

function encode(value) {
  return encodeURIComponent(String(value || ''));
}

async function handleHealth(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  return json(res, 200, {
    ok: true,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
    supabase: isSupabaseConfigured() ? 'connected' : 'missing',
    xendit: process.env.XENDIT_SECRET_KEY ? 'configured' : 'missing',
    resend: process.env.RESEND_API_KEY ? 'configured' : 'missing',
    webhookToken: process.env.XENDIT_WEBHOOK_TOKEN ? 'configured' : 'missing',
    adminAccess: process.env.PLP_STAFF_CODE ? 'configured' : 'missing',
    staffTasks: 'configured',
    checkedAt: new Date().toISOString(),
  });
}

async function handleOperations(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  const rows = await listPaymentReconciliation(1000);
  let exceptions = [];
  let exceptionsWarning = null;
  try {
    exceptions = await listPaymentExceptions(1000);
  } catch (error) {
    exceptionsWarning = error.message;
  }
  return json(res, 200, { ok: true, rows: rows || [], exceptions: exceptions || [], warnings: { exceptions: exceptionsWarning } });
}

async function handleNotifications(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const rows = await selectRows('plp_notification_activity', 'select=*&limit=1000');
    return json(res, 200, { ok: true, rows: rows || [] });
  } catch (error) {
    return json(res, 200, { ok: true, rows: [], warning: error.message });
  }
}

async function handleBookingStatus(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  const body = parseBody(req);
  const reference = String(body.reference || '').trim();
  const nextStatus = String(body.nextStatus || '').trim();
  if (!reference || !nextStatus) return json(res, 400, { ok: false, error: 'Missing reference or next status' });

  const rows = await selectRows('plp_payment_reconciliation', `booking_reference=eq.${encode(reference)}&select=*&limit=1`);
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

  const updated = await updateRows('plp_bookings', `booking_reference=eq.${encode(reference)}`, payload);
  let notifications = null;
  try {
    notifications = await notifyBookingStatus(reference, nextStatus);
  } catch (error) {
    notifications = { ok: false, error: error.message };
  }
  return json(res, 200, { ok: true, row: updated?.[0] || null, notifications });
}

async function handleStaffTasks(req, res) {
  if (req.method === 'GET') {
    const reference = cleanText(req.query?.reference, 80);
    const query = reference
      ? `booking_reference=eq.${encode(reference)}&select=*&order=created_at.desc&limit=1000`
      : 'select=*&order=created_at.desc&limit=1000';
    const rows = await selectRows('plp_staff_tasks', query);
    return json(res, 200, { ok: true, rows: rows || [] });
  }

  const body = parseBody(req);

  if (req.method === 'POST') {
    const reference = cleanText(body.reference || body.bookingReference, 80);
    const kind = cleanEnum(body.kind, STAFF_TASK_KINDS, 'task');
    const category = cleanEnum(body.category, STAFF_TASK_CATEGORIES, 'admin');
    const priority = cleanEnum(body.priority, STAFF_TASK_PRIORITIES, 'normal');
    const title = cleanText(body.title || (kind === 'note' ? 'Internal note' : ''), 160);
    const note = cleanText(body.note || body.body, 1200);
    if (!reference) return json(res, 400, { ok: false, error: 'Booking reference is required.' });
    if (!title && !note) return json(res, 400, { ok: false, error: 'Task title or note is required.' });
    const saved = await insertRow('plp_staff_tasks', {
      booking_reference: reference,
      kind,
      category,
      priority,
      status: kind === 'note' ? 'done' : 'open',
      title: title || 'Internal note',
      note: note || null,
      actor: cleanText(req.headers['x-plp-staff-name'] || 'staff', 120),
      source: 'resort-command-admin',
      completed_at: kind === 'note' ? new Date().toISOString() : null,
    });
    return json(res, 200, { ok: true, row: saved });
  }

  if (req.method === 'PATCH') {
    const id = cleanText(body.id, 80);
    const status = cleanEnum(body.status, STAFF_TASK_STATUSES, 'open');
    if (!id) return json(res, 400, { ok: false, error: 'Task id is required.' });
    const updated = await updateRows('plp_staff_tasks', `id=eq.${encode(id)}`, {
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
      actor: cleanText(req.headers['x-plp-staff-name'] || 'staff', 120),
    });
    return json(res, 200, { ok: true, row: updated?.[0] || null });
  }

  return json(res, 405, { ok: false, error: 'Method not allowed' });
}

async function handleDateBlocks(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) return json(res, 405, { ok: false, error: 'Method not allowed' });
  if (req.method === 'GET') {
    try {
      const [blockedDates, calendar] = await Promise.all([listBlockedDates(200), listAvailabilityCalendar(300)]);
      return json(res, 200, { ok: true, blockedDates: blockedDates || [], calendar: calendar || [] });
    } catch (error) {
      return json(res, 200, { ok: true, blockedDates: [], calendar: [], warning: error.message });
    }
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
    try {
      const rows = await selectRows('plp_site_content', 'select=id,section,status,content,updated_at,updated_by&order=section.asc');
      return json(res, 200, { ok: true, content: rows || [] });
    } catch (error) {
      return json(res, 200, { ok: true, content: [], warning: error.message });
    }
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
  const existing = await selectRows('plp_site_content', `section=eq.${encode(section)}&select=id&limit=1`);
  const saved = existing?.[0]
    ? (await updateRows('plp_site_content', `id=eq.${existing[0].id}`, payload))?.[0]
    : await insertRow('plp_site_content', payload);
  return json(res, 200, { ok: true, content: saved });
}

const PHASE_2B_BLOCK_MESSAGE = 'Phase 2B is review-first only. Automatic booking/payment/guest-message actions are disabled.';

function containsDisabledOtaAction(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.createBooking === true || value.autoConfirm === true || value.mutatePayment === true || value.sendGuestMessage === true) return true;
  if (String(value.mode || '').trim().toLowerCase() === 'live') return true;
  return Object.values(value).some((item) => item && typeof item === 'object' && containsDisabledOtaAction(item));
}

function staffName(req) {
  return cleanText(req.headers['x-plp-staff-name'] || 'staff', 120);
}

async function handleOtaReservationImports(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  const rows = await listOtaReservationImports({
    reviewStatus: req.query?.reviewStatus,
    channelKey: req.query?.channelKey,
    severity: req.query?.severity,
    accommodationName: req.query?.accommodationName,
    limit: req.query?.limit,
  });
  return json(res, 200, { ok: true, rows: rows || [], reviewFirstOnly: true });
}

async function handleOtaReservationStage(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  const body = parseBody(req);
  if (containsDisabledOtaAction(body)) return json(res, 400, { ok: false, error: PHASE_2B_BLOCK_MESSAGE });
  const result = await stageOtaReservationImport({ ...body, createdBy: staffName(req) });
  return json(res, result.ok ? 200 : 409, result);
}

async function handleOtaReservationReview(req, res) {
  if (req.method !== 'PATCH') return json(res, 405, { ok: false, error: 'Method not allowed' });
  const body = parseBody(req);
  if (containsDisabledOtaAction(body)) return json(res, 400, { ok: false, error: PHASE_2B_BLOCK_MESSAGE });
  const row = await updateOtaReservationReview({ ...body, reviewedBy: body.reviewedBy || staffName(req) });
  return json(res, row ? 200 : 404, { ok: Boolean(row), row, reviewFirstOnly: true, message: 'Review status updated. No booking was created.' });
}

async function handleOtaReservationSummary(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  const summary = await getOtaReservationReviewSummary();
  return json(res, 200, { ok: true, summary, reviewFirstOnly: true });
}

export default async function handler(req, res) {
  if (!hasStaffAccess(req)) return json(res, 401, { ok: false, error: 'Staff access required' });

  try {
    const action = actionOf(req);
    if (action === 'health') return await handleHealth(req, res);

    if (!isSupabaseConfigured()) return json(res, 503, { ok: false, error: getSupabaseConfigError() });

    if (action === 'operations') return await handleOperations(req, res);
    if (action === 'notifications') return await handleNotifications(req, res);
    if (action === 'booking-status') return await handleBookingStatus(req, res);
    if (action === 'staff-tasks' || action === 'staff-task' || action === 'internal-notes') return await handleStaffTasks(req, res);
    if (action === 'date-blocks') return await handleDateBlocks(req, res);
    if (action === 'content') return await handleContent(req, res);
    if (action === 'ota-reservation-imports') return await handleOtaReservationImports(req, res);
    if (action === 'ota-reservation-stage') return await handleOtaReservationStage(req, res);
    if (action === 'ota-reservation-review') return await handleOtaReservationReview(req, res);
    if (action === 'ota-reservation-summary') return await handleOtaReservationSummary(req, res);
    return json(res, 404, { ok: false, error: 'Unknown admin action' });
  } catch (error) {
    return json(res, 500, { ok: false, error: 'Admin action failed', detail: error.message });
  }
}
