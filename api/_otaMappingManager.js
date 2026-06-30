import { insertRow, selectRows, updateRows } from './_supabase.js';

export const ALLOWED_CHANNELS = new Set(['agoda', 'airbnb', 'expedia', 'booking_com', 'direct_website', 'google_hotel_ads', 'trip_com', 'unknown']);
export const ALLOWED_ACCOMMODATIONS = new Set(['Grand Ocean Villa', 'Sunset Suite', 'Smart Room Premium']);
export const ALLOWED_MAPPING_STATUSES = new Set(['draft', 'ready_for_review', 'approved', 'archived', 'blocked']);
export const ALLOWED_REVIEW_STATUSES = new Set(['needs_review', 'in_review', 'approved', 'rejected', 'archived']);

const enc = (value) => encodeURIComponent(String(value ?? ''));
const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const nullableText = (value, max = 500) => { const cleaned = text(value, max); return cleaned || null; };
const intOrNull = (value) => { const n = Number.parseInt(value, 10); return Number.isFinite(n) ? n : null; };
const cleanChannel = (value) => { const key = text(value || 'unknown', 80).toLowerCase().replace(/[\s-]+/g, '_'); return ALLOWED_CHANNELS.has(key) ? key : 'unknown'; };
const cleanAccommodation = (value) => { const name = text(value, 160); return ALLOWED_ACCOMMODATIONS.has(name) ? name : ''; };
const cleanMappingStatus = (value, fallback = 'draft') => { const status = text(value || fallback, 40).toLowerCase(); return ALLOWED_MAPPING_STATUSES.has(status) ? status : fallback; };
const cleanReviewStatus = (value, fallback = 'needs_review') => { const status = text(value || fallback, 40).toLowerCase(); return ALLOWED_REVIEW_STATUSES.has(status) ? status : fallback; };
const limitOf = (value) => Math.min(Math.max(Number.parseInt(value, 10) || 200, 1), 500);

function buildFilters(filters = {}) {
  const parts = ['select=*'];
  const channelKey = filters.channelKey ? cleanChannel(filters.channelKey) : '';
  const accommodationName = filters.accommodationName ? cleanAccommodation(filters.accommodationName) : '';
  const mappingStatus = filters.mappingStatus ? cleanMappingStatus(filters.mappingStatus, '') : '';
  const reviewStatus = filters.reviewStatus ? cleanReviewStatus(filters.reviewStatus, '') : '';
  if (channelKey) parts.push(`channel_key=eq.${enc(channelKey)}`);
  if (accommodationName) parts.push(`internal_accommodation_name=eq.${enc(accommodationName)}`);
  if (mappingStatus) parts.push(`mapping_status=eq.${enc(mappingStatus)}`);
  if (reviewStatus) parts.push(`review_status=eq.${enc(reviewStatus)}`);
  parts.push('order=updated_at.desc');
  parts.push(`limit=${limitOf(filters.limit)}`);
  return parts.join('&');
}

export function normalizeRoomMapping(row = {}) {
  return {
    id: row.id || null,
    channelKey: row.channel_key || 'unknown',
    internalAccommodationName: row.internal_accommodation_name || row.accommodation_name || null,
    otaRoomId: row.ota_room_id || null,
    otaRoomName: row.ota_room_name || null,
    otaPropertyId: row.ota_property_id || null,
    otaListingId: row.ota_listing_id || null,
    otaChannelRoomCode: row.ota_channel_room_code || null,
    maxGuests: row.max_guests ?? null,
    mappingStatus: row.mapping_status || 'draft',
    reviewStatus: row.review_status || 'needs_review',
    notes: row.notes || null,
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    updatedBy: row.updated_by || null,
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null,
  };
}

export function normalizeRateMapping(row = {}) {
  return {
    id: row.id || null,
    channelKey: row.channel_key || 'unknown',
    internalAccommodationName: row.internal_accommodation_name || null,
    otaRoomMappingId: row.ota_room_mapping_id || null,
    internalRateName: row.internal_rate_name || 'standard',
    otaRatePlanId: row.ota_rate_plan_id || null,
    otaRatePlanName: row.ota_rate_plan_name || null,
    otaRateCode: row.ota_rate_code || null,
    currency: row.currency || 'PHP',
    mappingStatus: row.mapping_status || 'draft',
    reviewStatus: row.review_status || 'needs_review',
    minNights: row.min_nights ?? null,
    maxNights: row.max_nights ?? null,
    refundablePolicy: row.refundable_policy || null,
    mealPlan: row.meal_plan || null,
    notes: row.notes || null,
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    updatedBy: row.updated_by || null,
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null,
  };
}

export function validateRoomMapping(input = {}) {
  const errors = [];
  if (!ALLOWED_CHANNELS.has(cleanChannel(input.channelKey))) errors.push('Unsupported OTA channel.');
  if (!cleanAccommodation(input.internalAccommodationName)) errors.push('Unsupported internal accommodation.');
  if (!nullableText(input.otaRoomId, 160) && !nullableText(input.otaRoomName, 240) && !nullableText(input.otaListingId, 160) && !nullableText(input.otaChannelRoomCode, 160)) errors.push('Room mapping needs an OTA room ID, OTA room name, OTA listing ID, or OTA channel room code.');
  return { ok: errors.length === 0, errors };
}

export function validateRateMapping(input = {}) {
  const errors = [];
  if (!ALLOWED_CHANNELS.has(cleanChannel(input.channelKey))) errors.push('Unsupported OTA channel.');
  if (!cleanAccommodation(input.internalAccommodationName)) errors.push('Unsupported internal accommodation.');
  if (!nullableText(input.internalRateName, 160)) errors.push('Internal rate name is required.');
  if (!nullableText(input.otaRatePlanId, 160) && !nullableText(input.otaRatePlanName, 240) && !nullableText(input.otaRateCode, 160)) errors.push('Rate mapping needs an OTA rate plan ID, OTA rate plan name, or OTA rate code.');
  return { ok: errors.length === 0, errors };
}

function roomPayload(input = {}) {
  const now = new Date().toISOString();
  const reviewStatus = cleanReviewStatus(input.reviewStatus);
  return {
    channel_key: cleanChannel(input.channelKey),
    internal_accommodation_name: cleanAccommodation(input.internalAccommodationName),
    ota_room_id: nullableText(input.otaRoomId, 160),
    ota_room_name: nullableText(input.otaRoomName, 240),
    ota_property_id: nullableText(input.otaPropertyId, 160),
    ota_listing_id: nullableText(input.otaListingId, 160),
    ota_channel_room_code: nullableText(input.otaChannelRoomCode, 160),
    max_guests: intOrNull(input.maxGuests),
    mapping_status: cleanMappingStatus(input.mappingStatus),
    review_status: reviewStatus,
    notes: nullableText(input.notes, 1200),
    reviewed_by: reviewStatus === 'approved' || reviewStatus === 'rejected' ? nullableText(input.reviewedBy || input.updatedBy || input.actor, 120) : undefined,
    reviewed_at: reviewStatus === 'approved' || reviewStatus === 'rejected' ? now : undefined,
    updated_by: nullableText(input.updatedBy || input.actor, 120),
    updated_at: now,
  };
}

function ratePayload(input = {}) {
  const now = new Date().toISOString();
  const reviewStatus = cleanReviewStatus(input.reviewStatus);
  return {
    channel_key: cleanChannel(input.channelKey),
    internal_accommodation_name: cleanAccommodation(input.internalAccommodationName),
    ota_room_mapping_id: nullableText(input.otaRoomMappingId, 80),
    internal_rate_name: nullableText(input.internalRateName, 160) || 'standard',
    ota_rate_plan_id: nullableText(input.otaRatePlanId, 160),
    ota_rate_plan_name: nullableText(input.otaRatePlanName, 240),
    ota_rate_code: nullableText(input.otaRateCode, 160),
    currency: text(input.currency || 'PHP', 10).toUpperCase() || 'PHP',
    mapping_status: cleanMappingStatus(input.mappingStatus),
    review_status: reviewStatus,
    min_nights: intOrNull(input.minNights),
    max_nights: intOrNull(input.maxNights),
    refundable_policy: nullableText(input.refundablePolicy, 240),
    meal_plan: nullableText(input.mealPlan, 160),
    notes: nullableText(input.notes, 1200),
    reviewed_by: reviewStatus === 'approved' || reviewStatus === 'rejected' ? nullableText(input.reviewedBy || input.updatedBy || input.actor, 120) : undefined,
    reviewed_at: reviewStatus === 'approved' || reviewStatus === 'rejected' ? now : undefined,
    updated_by: nullableText(input.updatedBy || input.actor, 120),
    updated_at: now,
  };
}

export async function createOtaMappingAuditEvent(payload = {}) {
  return insertRow('plp_ota_mapping_audit_events', {
    mapping_table: payload.mappingTable || 'plp_ota_room_mappings',
    mapping_id: payload.mappingId || null,
    channel_key: payload.channelKey || null,
    internal_accommodation_name: payload.internalAccommodationName || null,
    previous_status: payload.previousStatus || null,
    next_status: payload.nextStatus || null,
    action_type: payload.actionType || 'unknown',
    operator_note: payload.operatorNote || null,
    actor: payload.actor || 'staff',
    event_payload: payload.eventPayload || {},
  });
}

async function withAudit(row, auditPayload, normalize) {
  const warnings = [];
  try { await createOtaMappingAuditEvent({ ...auditPayload, mappingId: row?.id }); } catch (error) { warnings.push(`Audit event was not saved: ${error.message}`); }
  return { ok: true, reviewOnly: true, row: normalize(row), warnings, message: 'Mapping saved for review. No OTA sync was performed.' };
}

export async function listOtaMappingWorkspace(filters = {}) {
  const warnings = [];
  let rooms = [];
  let rates = [];
  const query = buildFilters(filters);
  try { rooms = await selectRows('plp_ota_room_mappings', query); } catch (error) { warnings.push(`plp_ota_room_mappings: ${error.message}`); }
  try { rates = await selectRows('plp_ota_rate_plan_mappings', query); } catch (error) { warnings.push(`plp_ota_rate_plan_mappings: ${error.message}`); }
  return { ok: warnings.length === 0, reviewOnly: true, rooms: (rooms || []).map(normalizeRoomMapping), rates: (rates || []).map(normalizeRateMapping), warnings };
}

export async function getOtaMappingWorkspaceSummary() {
  const result = await listOtaMappingWorkspace({ limit: 500 });
  const summary = { totalRoomMappings: result.rooms.length, approvedRoomMappings: 0, roomMappingsNeedingReview: 0, totalRateMappings: result.rates.length, approvedRateMappings: 0, rateMappingsNeedingReview: 0, archivedMappings: 0, latestMappingUpdateAt: null, byChannel: {}, warnings: result.warnings };
  for (const row of [...result.rooms, ...result.rates]) {
    summary.byChannel[row.channelKey] = (summary.byChannel[row.channelKey] || 0) + 1;
    if (row.mappingStatus === 'archived' || row.reviewStatus === 'archived') summary.archivedMappings += 1;
    if (!summary.latestMappingUpdateAt || (row.updatedAt && row.updatedAt > summary.latestMappingUpdateAt)) summary.latestMappingUpdateAt = row.updatedAt;
  }
  for (const row of result.rooms) { if (row.mappingStatus === 'approved' || row.reviewStatus === 'approved') summary.approvedRoomMappings += 1; if (['needs_review', 'in_review', 'rejected'].includes(row.reviewStatus)) summary.roomMappingsNeedingReview += 1; }
  for (const row of result.rates) { if (row.mappingStatus === 'approved' || row.reviewStatus === 'approved') summary.approvedRateMappings += 1; if (['needs_review', 'in_review', 'rejected'].includes(row.reviewStatus)) summary.rateMappingsNeedingReview += 1; }
  return { ok: result.ok, reviewOnly: true, summary };
}

export async function createOtaRoomMapping(input = {}) {
  const validation = validateRoomMapping(input); if (!validation.ok) return { ok: false, errors: validation.errors, reviewOnly: true };
  const payload = roomPayload(input); const row = await insertRow('plp_ota_room_mappings', payload);
  return withAudit(row, { mappingTable: 'plp_ota_room_mappings', channelKey: payload.channel_key, internalAccommodationName: payload.internal_accommodation_name, nextStatus: payload.mapping_status, actionType: 'create_room_mapping', actor: input.actor || input.createdBy || input.updatedBy, operatorNote: payload.notes, eventPayload: { reviewOnly: true } }, normalizeRoomMapping);
}

export async function updateOtaRoomMapping(input = {}) {
  const id = nullableText(input.id, 80); if (!id) return { ok: false, error: 'Room mapping id is required.', reviewOnly: true };
  const validation = validateRoomMapping(input); if (!validation.ok) return { ok: false, errors: validation.errors, reviewOnly: true };
  const payload = roomPayload(input); const rows = await updateRows('plp_ota_room_mappings', `id=eq.${enc(id)}`, payload); const row = rows?.[0] || null;
  return withAudit(row, { mappingTable: 'plp_ota_room_mappings', channelKey: payload.channel_key, internalAccommodationName: payload.internal_accommodation_name, nextStatus: payload.mapping_status, actionType: 'update_room_mapping', actor: input.actor || input.updatedBy, operatorNote: payload.notes, eventPayload: { reviewOnly: true } }, normalizeRoomMapping);
}

export async function archiveOtaRoomMapping(input = {}) {
  const id = nullableText(input.id, 80); if (!id) return { ok: false, error: 'Room mapping id is required.', reviewOnly: true };
  const now = new Date().toISOString(); const actor = nullableText(input.actor || input.updatedBy || input.archivedBy, 120) || 'staff';
  const rows = await updateRows('plp_ota_room_mappings', `id=eq.${enc(id)}`, { mapping_status: 'archived', review_status: 'archived', archived_by: actor, archived_at: now, updated_by: actor, updated_at: now, notes: nullableText(input.notes, 1200) });
  const row = rows?.[0] || null;
  return withAudit(row, { mappingTable: 'plp_ota_room_mappings', channelKey: row?.channel_key, internalAccommodationName: row?.internal_accommodation_name, nextStatus: 'archived', actionType: 'archive_room_mapping', actor, operatorNote: input.notes, eventPayload: { reviewOnly: true } }, normalizeRoomMapping);
}

export async function createOtaRatePlanMapping(input = {}) {
  const validation = validateRateMapping(input); if (!validation.ok) return { ok: false, errors: validation.errors, reviewOnly: true };
  const payload = ratePayload(input); const row = await insertRow('plp_ota_rate_plan_mappings', { ...payload, created_by: nullableText(input.createdBy || input.actor, 120) });
  return withAudit(row, { mappingTable: 'plp_ota_rate_plan_mappings', channelKey: payload.channel_key, internalAccommodationName: payload.internal_accommodation_name, nextStatus: payload.mapping_status, actionType: 'create_rate_mapping', actor: input.actor || input.createdBy || input.updatedBy, operatorNote: payload.notes, eventPayload: { reviewOnly: true } }, normalizeRateMapping);
}

export async function updateOtaRatePlanMapping(input = {}) {
  const id = nullableText(input.id, 80); if (!id) return { ok: false, error: 'Rate mapping id is required.', reviewOnly: true };
  const validation = validateRateMapping(input); if (!validation.ok) return { ok: false, errors: validation.errors, reviewOnly: true };
  const payload = ratePayload(input); const rows = await updateRows('plp_ota_rate_plan_mappings', `id=eq.${enc(id)}`, payload); const row = rows?.[0] || null;
  return withAudit(row, { mappingTable: 'plp_ota_rate_plan_mappings', channelKey: payload.channel_key, internalAccommodationName: payload.internal_accommodation_name, nextStatus: payload.mapping_status, actionType: 'update_rate_mapping', actor: input.actor || input.updatedBy, operatorNote: payload.notes, eventPayload: { reviewOnly: true } }, normalizeRateMapping);
}

export async function archiveOtaRatePlanMapping(input = {}) {
  const id = nullableText(input.id, 80); if (!id) return { ok: false, error: 'Rate mapping id is required.', reviewOnly: true };
  const now = new Date().toISOString(); const actor = nullableText(input.actor || input.updatedBy || input.archivedBy, 120) || 'staff';
  const rows = await updateRows('plp_ota_rate_plan_mappings', `id=eq.${enc(id)}`, { mapping_status: 'archived', review_status: 'archived', archived_by: actor, archived_at: now, updated_by: actor, updated_at: now, notes: nullableText(input.notes, 1200) });
  const row = rows?.[0] || null;
  return withAudit(row, { mappingTable: 'plp_ota_rate_plan_mappings', channelKey: row?.channel_key, internalAccommodationName: row?.internal_accommodation_name, nextStatus: 'archived', actionType: 'archive_rate_mapping', actor, operatorNote: input.notes, eventPayload: { reviewOnly: true } }, normalizeRateMapping);
}
