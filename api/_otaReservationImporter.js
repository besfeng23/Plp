import { insertRow, selectRows, updateRows } from './_supabase.js';

const CHANNELS = new Set(['agoda', 'airbnb', 'expedia', 'booking_com', 'direct_website', 'google_hotel_ads', 'trip_com', 'unknown']);
const PAYMENT_STATES = new Set(['unknown', 'unpaid', 'paid_to_ota', 'collect_at_property', 'partially_paid', 'cancelled', 'refunded']);
const REVIEW_STATUSES = new Set(['needs_review', 'in_review', 'rejected', 'approved_for_manual_entry', 'archived']);
const ACCOMMODATIONS = new Set(['Grand Ocean Villa', 'Sunset Suite', 'Smart Room Premium']);
const enc = (value) => encodeURIComponent(String(value ?? ''));
const text = (value, max = 240) => value === undefined || value === null ? null : String(value).trim().slice(0, max) || null;
const first = (input, names) => names.map((name) => input?.[name]).find((value) => value !== undefined && value !== null && value !== '') ?? null;
const dateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value).slice(0, 10) : null;
const daysBetween = (start, end) => Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000);
const numberOrNull = (value) => value === undefined || value === null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const intOrNull = (value) => numberOrNull(value) === null ? null : Math.trunc(Number(value));
const channelKey = (value) => { const key = String(value || 'unknown').trim().toLowerCase().replace(/[\s.-]+/g, '_'); return CHANNELS.has(key) ? key : 'unknown'; };
const accommodationName = (value) => { const raw = text(value, 160); return raw ? ([...ACCOMMODATIONS].find((name) => name.toLowerCase() === raw.toLowerCase()) || raw) : null; };
const rank = (value) => ({ low: 1, medium: 2, high: 3, critical: 4 }[value] || 2);
const maxSeverity = (items) => items.reduce((max, item) => rank(item.severity) > rank(max) ? item.severity : max, 'low');

function paymentState(value) {
  const key = String(value || 'unknown').trim().toLowerCase().replace(/[\s.-]+/g, '_');
  if (['paid', 'prepaid', 'paid_to_channel', 'ota_paid'].includes(key)) return 'paid_to_ota';
  if (['property_collect', 'pay_at_property', 'hotel_collect'].includes(key)) return 'collect_at_property';
  if (['partial', 'partially_paid'].includes(key)) return 'partially_paid';
  if (['cancelled', 'canceled'].includes(key)) return 'cancelled';
  if (['refund', 'refunded'].includes(key)) return 'refunded';
  if (['unpaid', 'not_paid'].includes(key)) return 'unpaid';
  return PAYMENT_STATES.has(key) ? key : 'unknown';
}

export function normalizeOtaReservationPayload(input = {}) {
  const rawPayload = input.rawPayload && typeof input.rawPayload === 'object' ? input.rawPayload : input;
  return {
    channelKey: channelKey(first(input, ['channelKey', 'channel_key', 'channel']) ?? first(rawPayload, ['channelKey', 'channel_key', 'channel'])),
    otaReservationReference: text(first(input, ['otaReservationReference', 'ota_reservation_reference', 'reservation_id', 'booking_id', 'confirmation_code']) ?? first(rawPayload, ['reservation_id', 'booking_id', 'confirmation_code']), 160),
    guestName: text(first(input, ['guestName', 'guest_name']) ?? first(rawPayload, ['guestName', 'guest_name']), 160),
    guestEmail: text(first(input, ['guestEmail', 'guest_email', 'email']) ?? first(rawPayload, ['email', 'guest_email']), 180),
    guestPhone: text(first(input, ['guestPhone', 'guest_phone', 'phone']) ?? first(rawPayload, ['phone', 'guest_phone']), 80),
    accommodationName: accommodationName(first(input, ['accommodationName', 'accommodation_name', 'room_name']) ?? first(rawPayload, ['accommodationName', 'accommodation_name', 'room_name'])),
    otaRoomId: text(first(input, ['otaRoomId', 'ota_room_id', 'room_id']) ?? first(rawPayload, ['room_id', 'ota_room_id']), 160),
    otaRoomName: text(first(input, ['otaRoomName', 'ota_room_name', 'room_name']) ?? first(rawPayload, ['room_name', 'ota_room_name']), 160),
    otaRatePlanId: text(first(input, ['otaRatePlanId', 'ota_rate_plan_id', 'rate_plan_id']) ?? first(rawPayload, ['rate_plan_id', 'ota_rate_plan_id']), 160),
    checkIn: dateOnly(first(input, ['checkIn', 'check_in', 'arrival_date']) ?? first(rawPayload, ['check_in', 'arrival_date'])),
    checkOut: dateOnly(first(input, ['checkOut', 'check_out', 'departure_date']) ?? first(rawPayload, ['check_out', 'departure_date'])),
    guests: intOrNull(first(input, ['guests', 'guest_count']) ?? first(rawPayload, ['guests', 'guest_count'])),
    currency: text(first(input, ['currency', 'currency_code']) ?? first(rawPayload, ['currency', 'currency_code']) ?? 'PHP', 12)?.toUpperCase(),
    totalAmount: numberOrNull(first(input, ['totalAmount', 'ota_total_amount', 'total', 'amount']) ?? first(rawPayload, ['total', 'amount'])),
    depositAmount: numberOrNull(first(input, ['depositAmount', 'ota_deposit_amount', 'deposit']) ?? rawPayload.deposit),
    paymentState: paymentState(first(input, ['paymentState', 'payment_status', 'ota_payment_state']) ?? first(rawPayload, ['payment_status', 'ota_payment_state'])),
    rawCurrency: text(first(input, ['currency', 'currency_code']) ?? first(rawPayload, ['currency', 'currency_code']), 12),
    rawPayload,
  };
}

export function validateOtaReservationPayload(normalized) {
  const errors = [];
  if (!normalized.otaReservationReference) errors.push('OTA reservation reference is required.');
  if (!normalized.checkIn) errors.push('Check-in must use YYYY-MM-DD.');
  if (!normalized.checkOut) errors.push('Check-out must use YYYY-MM-DD.');
  if (normalized.checkIn && normalized.checkOut) { const nights = daysBetween(normalized.checkIn, normalized.checkOut); if (nights <= 0) errors.push('Check-out must be after check-in.'); if (nights > 90) errors.push('Date range must not exceed 90 days.'); }
  if (normalized.guests !== null && (!Number.isInteger(normalized.guests) || normalized.guests < 1)) errors.push('Guests must be an integer greater than or equal to 1.');
  if (!PAYMENT_STATES.has(normalized.paymentState)) errors.push('Unsupported OTA payment state.');
  return { ok: errors.length === 0, errors };
}

export async function detectOtaReservationConflicts(normalized) {
  const conflicts = [];
  if (normalized.channelKey && normalized.otaReservationReference) {
    const duplicate = await selectRows('plp_ota_reservation_imports', `channel_key=eq.${enc(normalized.channelKey)}&ota_reservation_reference=eq.${enc(normalized.otaReservationReference)}&select=id&limit=1`).catch(() => []);
    if (duplicate?.[0]) conflicts.push({ type: 'duplicate_import', severity: 'high', message: 'Duplicate OTA reservation reference.' });
  }
  if (!normalized.accommodationName || !ACCOMMODATIONS.has(normalized.accommodationName)) conflicts.push({ type: 'invalid_accommodation', severity: 'high', message: 'Accommodation is missing or not recognized.' });
  if (normalized.accommodationName && normalized.checkIn && normalized.checkOut) {
    const overlap = `accommodation_name=eq.${enc(normalized.accommodationName)}&check_in=lt.${enc(normalized.checkOut)}&check_out=gt.${enc(normalized.checkIn)}&select=*&limit=20`;
    const holds = await selectRows('plp_active_booking_holds', overlap).catch(() => []);
    const blocks = await selectRows('plp_active_blocked_dates', overlap).catch(() => []);
    if (holds?.length) conflicts.push({ type: 'direct_booking_overlap', severity: 'critical', message: 'Overlaps active direct booking holds.', matches: holds });
    if (blocks?.length) conflicts.push({ type: 'manual_block_overlap', severity: holds?.length ? 'critical' : 'high', message: 'Overlaps manual blocked dates.', matches: blocks });
  }
  if (normalized.accommodationName) {
    const parts = [`channel_key=eq.${enc(normalized.channelKey)}`, `internal_accommodation_name=eq.${enc(normalized.accommodationName)}`];
    if (normalized.otaRoomId) parts.push(`ota_room_id=eq.${enc(normalized.otaRoomId)}`);
    const mappings = await selectRows('plp_ota_room_mappings', `${parts.join('&')}&select=id&limit=1`).catch(() => []);
    if (!mappings?.[0]) conflicts.push({ type: 'missing_room_mapping', severity: 'medium', message: 'No reviewed OTA room mapping matches.' });
  }
  if (['unknown', 'paid_to_ota', 'collect_at_property'].includes(normalized.paymentState)) conflicts.push({ type: 'payment_ambiguity', severity: 'medium', message: 'OTA payment state is review-only and must not alter PLP payment status.' });
  if (!normalized.guestEmail || !normalized.guestPhone) conflicts.push({ type: 'optional_guest_contact_incomplete', severity: 'low', message: 'Guest contact data is incomplete.' });
  return { hasConflicts: conflicts.length > 0, severity: conflicts.length ? maxSeverity(conflicts) : 'low', items: conflicts, summary: { count: conflicts.length, items: conflicts, reviewFirstOnly: true, noBookingCreated: true, noPaymentMutation: true, noGuestMessageSent: true } };
}

function rowPayload(normalized, validation, conflicts, overrides = {}) {
  return { channel_key: normalized.channelKey, ota_reservation_reference: normalized.otaReservationReference || `missing-reference-${Date.now()}`, ota_guest_name: normalized.guestName, ota_guest_email: normalized.guestEmail, ota_guest_phone: normalized.guestPhone, accommodation_name: normalized.accommodationName, ota_room_id: normalized.otaRoomId, ota_room_name: normalized.otaRoomName, ota_rate_plan_id: normalized.otaRatePlanId, check_in: normalized.checkIn, check_out: normalized.checkOut, guests: normalized.guests, currency: normalized.currency || 'PHP', ota_total_amount: normalized.totalAmount, ota_deposit_amount: normalized.depositAmount, ota_payment_state: normalized.paymentState, normalized_status: validation.ok ? (conflicts.hasConflicts ? 'conflict' : 'ready_for_operator_review') : 'invalid', review_status: 'needs_review', conflict_status: validation.ok ? (conflicts.hasConflicts ? 'conflict_detected' : 'no_conflict') : 'invalid', severity: validation.ok ? conflicts.severity : 'high', raw_payload: normalized.rawPayload || {}, normalized_payload: { ...normalized, rawPayload: undefined, validationErrors: validation.errors, reviewFirstOnly: true }, conflict_summary: conflicts.summary, ...overrides };
}

export async function stageOtaReservationImport(input = {}) {
  const normalized = normalizeOtaReservationPayload(input);
  const validation = validateOtaReservationPayload(normalized);
  const conflicts = validation.ok || normalized.otaReservationReference ? await detectOtaReservationConflicts(normalized) : { hasConflicts: false, severity: 'high', items: [], summary: { count: 0, items: [] } };
  try {
    const row = await insertRow('plp_ota_reservation_imports', rowPayload(normalized, validation, conflicts, { created_by: text(input.createdBy || 'staff', 120) }));
    return { ok: validation.ok, reviewFirstOnly: true, import: row, normalized, conflicts, errors: validation.errors, message: validation.ok ? 'OTA reservation staged for review. No booking was created.' : 'OTA reservation staged as invalid for review. No booking was created.' };
  } catch (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, reviewFirstOnly: true, normalized, conflicts, error: 'Duplicate OTA reservation import. No booking was created.', message: 'Duplicate OTA reservation reference detected. No booking was created.' };
    throw error;
  }
}

export function listOtaReservationImports(filters = {}) {
  const params = ['select=*', `limit=${Math.min(Math.max(Number(filters.limit) || 100, 1), 500)}`, 'order=created_at.desc'];
  if (filters.reviewStatus) params.push(`review_status=eq.${enc(filters.reviewStatus)}`);
  if (filters.channelKey) params.push(`channel_key=eq.${enc(channelKey(filters.channelKey))}`);
  if (filters.severity) params.push(`severity=eq.${enc(filters.severity)}`);
  if (filters.accommodationName) params.push(`accommodation_name=eq.${enc(filters.accommodationName)}`);
  return selectRows('plp_ota_reservation_imports', params.join('&'));
}

export async function updateOtaReservationReview(input = {}) {
  const id = text(input.id, 80);
  const reviewStatus = String(input.reviewStatus || '').trim().toLowerCase();
  if (!id) throw new Error('Import id is required.');
  if (!REVIEW_STATUSES.has(reviewStatus)) throw new Error('Unsupported review status.');
  const rows = await updateRows('plp_ota_reservation_imports', `id=eq.${enc(id)}`, { review_status: reviewStatus, normalized_status: reviewStatus === 'approved_for_manual_entry' ? 'approved_for_manual_entry' : reviewStatus === 'rejected' ? 'rejected' : undefined, review_note: text(input.reviewNote, 1200), reviewed_by: text(input.reviewedBy || 'staff', 120), reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  return rows?.[0] || null;
}

export async function getOtaReservationReviewSummary() {
  const rows = await selectRows('plp_ota_reservation_imports', 'select=review_status,conflict_status,severity,created_at&limit=5000&order=created_at.desc').catch(() => []);
  const summary = { totalImports: rows.length, byReviewStatus: {}, byConflictStatus: {}, bySeverity: {}, latestImportAt: rows?.[0]?.created_at || null };
  for (const row of rows) { summary.byReviewStatus[row.review_status] = (summary.byReviewStatus[row.review_status] || 0) + 1; summary.byConflictStatus[row.conflict_status] = (summary.byConflictStatus[row.conflict_status] || 0) + 1; summary.bySeverity[row.severity] = (summary.bySeverity[row.severity] || 0) + 1; }
  return summary;
}
