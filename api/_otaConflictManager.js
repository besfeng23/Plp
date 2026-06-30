import { insertRow, selectRows, updateRows } from './_supabase.js';

const SOURCE_TABLES = new Set(['plp_ota_conflicts', 'plp_ota_reservation_imports']);
const RESOLUTION_STATUSES = new Set(['open', 'in_review', 'waiting_on_guest', 'waiting_on_ota', 'waiting_on_staff', 'resolved', 'ignored']);
const RESOLUTION_TYPES = new Set(['manual_entry_required', 'contact_guest', 'contact_ota', 'maintain_direct_booking', 'maintain_manual_block', 'update_room_mapping', 'update_rate_mapping', 'reject_ota_import', 'archive_duplicate', 'no_action_required', 'unknown']);
const WAITING = new Set(['waiting_on_guest', 'waiting_on_ota', 'waiting_on_staff']);
const enc = (value) => encodeURIComponent(String(value ?? ''));
const clean = (value, fallback = '') => String(value ?? fallback).trim();
const lower = (value, fallback = '') => clean(value, fallback).toLowerCase().replace(/[\s-]+/g, '_');
const limitOf = (value) => Math.min(Math.max(Number.parseInt(value, 10) || 100, 1), 500);
const arr = (value) => Array.isArray(value) ? value : [];

function nested(row, key) {
  return row?.details?.[key] ?? row?.conflict_summary?.[key] ?? row?.normalized_payload?.[key] ?? row?.raw_payload?.[key] ?? null;
}

function pick(row, keys, fallback = null) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key];
    const value = nested(row, key);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function hasConflictSummary(row) {
  const summary = row?.conflict_summary;
  if (!summary) return false;
  if (Array.isArray(summary)) return summary.length > 0;
  if (typeof summary === 'object') return Object.keys(summary).length > 0 || Number(summary.count || 0) > 0;
  return Boolean(summary);
}

export function classifyConflict(row = {}) {
  const raw = lower(pick(row, ['conflict_type', 'type', 'conflictType'], 'unknown'), 'unknown');
  const summary = JSON.stringify(row?.conflict_summary || row?.details || {}).toLowerCase();
  if (raw.includes('manual_block_overlaps_booking')) return 'manual_block_overlaps_booking';
  if (raw.includes('direct') || summary.includes('direct_booking')) return 'direct_booking_overlap';
  if (raw.includes('manual_block') || summary.includes('manual_block')) return 'manual_block_overlap';
  if (raw.includes('duplicate') || summary.includes('duplicate')) return 'duplicate_import';
  if (raw.includes('mapping_missing_ota_room')) return 'mapping_missing_ota_room';
  if (raw.includes('mapping_missing_rate_plan')) return 'mapping_missing_rate_plan';
  if (raw.includes('missing_room_mapping') || raw.includes('missing_mapping')) return 'missing_room_mapping';
  if (raw.includes('invalid_accommodation')) return 'invalid_accommodation';
  if (raw.includes('payment') || summary.includes('payment')) return 'payment_ambiguity';
  if (raw.includes('channel_disabled')) return 'channel_disabled';
  if (raw.includes('credential')) return 'channel_credentials_missing';
  return raw || 'unknown';
}

export function buildConflictRecommendation(row = {}) {
  const type = classifyConflict(row);
  if (type === 'direct_booking_overlap') return 'Maintain direct booking. Contact OTA or reject OTA import.';
  if (type === 'manual_block_overlap' || type === 'manual_block_overlaps_booking') return 'Maintain manual block unless owner releases inventory.';
  if (type === 'duplicate_import') return 'Archive duplicate after confirming original staged row.';
  if (['missing_room_mapping', 'mapping_missing_ota_room', 'mapping_missing_rate_plan', 'invalid_accommodation'].includes(type)) return 'Update OTA room mapping before approving.';
  if (type === 'payment_ambiguity') return 'Review OTA payment terms. Do not alter PLP payment status.';
  if (type === 'channel_disabled') return 'No live sync action. Keep disabled until operator approval.';
  if (type === 'channel_credentials_missing') return 'No live sync action. Configure credentials outside repo only.';
  return 'Review manually. No booking, payment, guest message, cancellation, or OTA call is automatic.';
}

export function normalizeConflictSource(row = {}) {
  const sourceTable = row.sourceTable || row.source_table || (row.conflict_status || row.review_status ? 'plp_ota_reservation_imports' : 'plp_ota_conflicts');
  return {
    id: `${sourceTable}:${row.id}`,
    sourceTable,
    sourceId: row.id,
    channelKey: pick(row, ['channel_key', 'channelKey'], 'unknown'),
    conflictType: classifyConflict(row),
    accommodationName: pick(row, ['accommodation_name', 'internal_accommodation_name', 'accommodationName'], null),
    startDate: pick(row, ['start_date', 'check_in', 'startDate'], null),
    endDate: pick(row, ['end_date', 'check_out', 'endDate'], null),
    severity: lower(pick(row, ['severity'], 'medium'), 'medium'),
    resolutionStatus: lower(pick(row, ['resolution_status'], row.status || row.review_status || 'open'), 'open'),
    reviewStatus: lower(pick(row, ['review_status'], row.status || 'needs_review'), 'needs_review'),
    resolutionType: lower(pick(row, ['resolution_type'], 'unknown'), 'unknown'),
    operatorNote: pick(row, ['operator_note', 'review_note'], null),
    guestName: pick(row, ['ota_guest_name', 'guest_name', 'guestName'], null),
    otaReservationReference: pick(row, ['ota_reservation_reference', 'otaReservationReference'], null),
    internalBookingReference: pick(row, ['internal_booking_reference', 'booking_reference', 'internalBookingReference'], null),
    summary: pick(row, ['summary', 'conflict_summary'], row.conflict_summary || row.details || null),
    recommendation: buildConflictRecommendation(row),
    createdAt: pick(row, ['created_at', 'createdAt'], null),
    updatedAt: pick(row, ['updated_at', 'updatedAt'], null),
  };
}

function filterRows(rows, filters = {}) {
  const sourceTable = clean(filters.sourceTable);
  const channelKey = clean(filters.channelKey);
  const severity = lower(filters.severity);
  const resolutionStatus = lower(filters.resolutionStatus);
  const reviewStatus = lower(filters.reviewStatus);
  const conflictType = lower(filters.conflictType);
  const accommodationName = clean(filters.accommodationName).toLowerCase();
  return rows.filter((row) => (!sourceTable || row.sourceTable === sourceTable)
    && (!channelKey || row.channelKey === channelKey)
    && (!severity || row.severity === severity)
    && (!resolutionStatus || row.resolutionStatus === resolutionStatus)
    && (!reviewStatus || row.reviewStatus === reviewStatus)
    && (!conflictType || row.conflictType === conflictType)
    && (!accommodationName || String(row.accommodationName || '').toLowerCase().includes(accommodationName)));
}

export async function listOtaConflictConsole(filters = {}) {
  const limit = limitOf(filters.limit);
  const warnings = [];
  let conflicts = [];
  let imports = [];
  try { conflicts = await selectRows('plp_ota_conflicts', `select=*&order=created_at.desc&limit=${limit}`); } catch (error) { warnings.push(`plp_ota_conflicts: ${error.message}`); }
  try { imports = await selectRows('plp_ota_reservation_imports', `select=*&order=created_at.desc&limit=${limit}`); } catch (error) { warnings.push(`plp_ota_reservation_imports: ${error.message}`); }
  const importConflicts = arr(imports).filter((row) => row.conflict_status === 'conflict_detected' || ['high', 'critical'].includes(lower(row.severity)) || (row.review_status === 'needs_review' && hasConflictSummary(row)));
  const rows = [
    ...arr(conflicts).map((row) => normalizeConflictSource({ ...row, sourceTable: 'plp_ota_conflicts' })),
    ...importConflicts.map((row) => normalizeConflictSource({ ...row, sourceTable: 'plp_ota_reservation_imports' })),
  ];
  return { ok: warnings.length === 0, rows: filterRows(rows, filters).slice(0, limit), warnings, reviewOnly: true };
}

export async function getOtaConflictConsoleSummary() {
  const result = await listOtaConflictConsole({ limit: 500 });
  const summary = { total: result.rows.length, open: 0, inReview: 0, waiting: 0, resolved: 0, ignored: 0, critical: 0, high: 0, inventoryConflictCount: 0, reservationImportConflictCount: 0, byChannel: {}, byType: {}, warnings: result.warnings };
  for (const row of result.rows) {
    if (row.resolutionStatus === 'open') summary.open += 1;
    if (row.resolutionStatus === 'in_review') summary.inReview += 1;
    if (WAITING.has(row.resolutionStatus)) summary.waiting += 1;
    if (row.resolutionStatus === 'resolved') summary.resolved += 1;
    if (row.resolutionStatus === 'ignored') summary.ignored += 1;
    if (row.severity === 'critical') summary.critical += 1;
    if (row.severity === 'high') summary.high += 1;
    if (row.sourceTable === 'plp_ota_conflicts') summary.inventoryConflictCount += 1;
    if (row.sourceTable === 'plp_ota_reservation_imports') summary.reservationImportConflictCount += 1;
    summary.byChannel[row.channelKey || 'unknown'] = (summary.byChannel[row.channelKey || 'unknown'] || 0) + 1;
    summary.byType[row.conflictType || 'unknown'] = (summary.byType[row.conflictType || 'unknown'] || 0) + 1;
  }
  return { ok: result.ok, summary, reviewOnly: true };
}

export function createOtaConflictResolutionEvent(payload = {}) {
  return insertRow('plp_ota_conflict_resolution_events', {
    conflict_id: payload.conflictId || null,
    source_table: payload.sourceTable,
    source_id: payload.sourceId || null,
    channel_key: payload.channelKey || null,
    conflict_type: payload.conflictType || null,
    previous_status: payload.previousStatus || null,
    next_status: payload.nextStatus || null,
    resolution_type: payload.resolutionType || null,
    operator_note: payload.operatorNote || null,
    actor: payload.actor || 'staff',
    event_payload: payload.eventPayload || {},
  });
}

async function selectSourceRow(sourceTable, sourceId) {
  const rows = await selectRows(sourceTable, `id=eq.${enc(sourceId)}&select=*&limit=1`);
  return rows?.[0] || null;
}

export async function updateOtaConflictResolution(input = {}) {
  const sourceTable = clean(input.sourceTable || input.source_table);
  const sourceId = clean(input.sourceId || input.source_id);
  const resolutionStatus = lower(input.resolutionStatus || input.resolution_status, 'open');
  const resolutionType = lower(input.resolutionType || input.resolution_type, 'unknown');
  if (!SOURCE_TABLES.has(sourceTable)) throw new Error('Unsupported OTA conflict source table.');
  if (!sourceId) throw new Error('Missing OTA conflict source id.');
  if (!RESOLUTION_STATUSES.has(resolutionStatus)) throw new Error('Unsupported OTA conflict resolution status.');
  if (!RESOLUTION_TYPES.has(resolutionType)) throw new Error('Unsupported OTA conflict resolution type.');

  const now = new Date().toISOString();
  const actor = clean(input.actor, 'staff').slice(0, 120);
  const operatorNote = clean(input.operatorNote || input.operator_note).slice(0, 4000) || null;
  const assignedTo = clean(input.assignedTo || input.assigned_to).slice(0, 160) || null;
  const current = await selectSourceRow(sourceTable, sourceId);
  const previousStatus = current?.resolution_status || current?.status || current?.review_status || null;
  let payload;

  if (sourceTable === 'plp_ota_conflicts') {
    const nextStatus = resolutionStatus === 'resolved' ? 'resolved' : resolutionStatus === 'ignored' ? 'ignored' : resolutionStatus === 'open' ? 'open' : 'in_review';
    payload = { resolution_status: resolutionStatus, resolution_type: resolutionType, operator_note: operatorNote, assigned_to: assignedTo, status: nextStatus, reviewed_by: actor, reviewed_at: now };
    if (resolutionStatus === 'resolved') Object.assign(payload, { resolved_by: actor, resolved_at: now });
    if (resolutionStatus === 'ignored') Object.assign(payload, { ignored_by: actor, ignored_at: now });
    if (current && Array.isArray(current.audit_trail)) payload.audit_trail = [...current.audit_trail, { at: now, actor, previousStatus, nextStatus: resolutionStatus, resolutionType, operatorNote }];
  } else {
    let reviewStatus = current?.review_status || 'needs_review';
    if (resolutionStatus === 'in_review') reviewStatus = 'in_review';
    else if (resolutionStatus === 'resolved' && resolutionType === 'manual_entry_required') reviewStatus = 'approved_for_manual_entry';
    else if (resolutionStatus === 'resolved' && resolutionType === 'reject_ota_import') reviewStatus = 'rejected';
    else if (resolutionStatus === 'ignored') reviewStatus = 'archived';
    payload = { review_status: reviewStatus, review_note: operatorNote, reviewed_by: actor, reviewed_at: now, updated_at: now };
  }

  const updated = await updateRows(sourceTable, `id=eq.${enc(sourceId)}`, payload);
  const row = updated?.[0] || null;
  let event = null;
  let warning = null;
  try {
    event = await createOtaConflictResolutionEvent({ conflictId: sourceTable === 'plp_ota_conflicts' ? sourceId : null, sourceTable, sourceId, channelKey: row?.channel_key || current?.channel_key || null, conflictType: classifyConflict(row || current || {}), previousStatus, nextStatus: resolutionStatus, resolutionType, operatorNote, actor, eventPayload: { reviewOnly: true, noBookingCreated: true, noPaymentChanged: true, noGuestMessageSent: true, noCancellationPerformed: true } });
  } catch (error) {
    warning = `Conflict resolution was saved, but audit event logging failed: ${error.message}`;
  }
  return { ok: true, row, event, warning, reviewOnly: true, message: sourceTable === 'plp_ota_reservation_imports' ? 'Conflict resolution saved. No booking was created.' : 'Conflict resolution saved.' };
}

export async function linkReservationImportConflicts() {
  const result = await listOtaConflictConsole({ sourceTable: 'plp_ota_reservation_imports', limit: 500 });
  return { ok: result.ok, rows: result.rows, warnings: result.warnings };
}
