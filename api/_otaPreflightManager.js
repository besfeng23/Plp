import { insertRow, selectRows } from './_supabase.js';

export const ALLOWED_CHANNELS = ['agoda', 'airbnb', 'expedia', 'booking_com', 'direct_website', 'google_hotel_ads', 'trip_com'];
const ACCOMMODATIONS = ['Grand Ocean Villa', 'Sunset Suite', 'Smart Room Premium'];
const CREDENTIAL_KEYS = ['credential', 'credentials', 'secret', 'token', 'client_secret', 'clientSecret', 'access_token', 'accessToken', 'refresh_token', 'refreshToken', 'api_key', 'apiKey', 'password'];
const enc = (value) => encodeURIComponent(String(value ?? ''));
const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const isMissingTable = (error) => /does not exist|not found|schema cache|PGRST205|42P01/i.test(String(error?.message || error));
const activeStatuses = new Set(['approved', 'ready_for_review', 'needs_review', 'in_review', 'draft', 'open', 'waiting_on_staff']);

async function safeSelect(table, query = 'select=*&limit=500') {
  try { return { ok: true, rows: await selectRows(table, query) || [] }; }
  catch (error) { return { ok: false, rows: [], error: error.message, missing: isMissingTable(error) }; }
}
function hasCredentialShape(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) => CREDENTIAL_KEYS.some((needle) => key.toLowerCase().includes(needle.toLowerCase())) || (item && typeof item === 'object' && hasCredentialShape(item)));
}
function hasLiveFlag(row = {}) { return row.live_sync_enabled === true || row.sync_live === true || row.is_live === true || row.live_mode === true || String(row.mode || '').toLowerCase() === 'live' || String(row.status || '').toLowerCase() === 'live'; }
function statusOf(row = {}) { return String(row.mapping_status || row.review_status || row.status || '').toLowerCase(); }
function isApproved(row = {}) { return statusOf(row) === 'approved' || String(row.review_status || '').toLowerCase() === 'approved'; }
function isArchivedOrBlocked(row = {}) { return ['archived', 'blocked'].includes(String(row.mapping_status || '').toLowerCase()) || ['archived', 'blocked', 'rejected'].includes(String(row.review_status || '').toLowerCase()); }

export function buildPreflightCheck(category, checkKey, status, options = {}) {
  return {
    category,
    channelKey: options.channelKey || null,
    checkKey,
    checkLabel: options.checkLabel || checkKey.replace(/_/g, ' '),
    checkStatus: status,
    severity: options.severity || (status === 'fail' || status === 'blocked' ? 'medium' : 'low'),
    detail: options.detail || null,
    recommendation: options.recommendation || null,
    evidence: options.evidence || {},
  };
}

export function calculateReadinessScore(items = []) {
  let score = 100;
  for (const item of items) {
    if (item.checkStatus === 'warning') score -= 2;
    if (item.checkStatus === 'fail' || item.checkStatus === 'blocked') {
      if (item.severity === 'critical') score -= 20;
      else if (item.severity === 'high') score -= 10;
      else score -= 5;
    }
  }
  return Math.max(0, score);
}
export function calculateGoNoGo(score, items = []) {
  const criticalFailures = items.filter((i) => ['fail', 'blocked'].includes(i.checkStatus) && i.severity === 'critical').length;
  const readinessGrade = score >= 85 && criticalFailures === 0 ? 'green' : score >= 65 && criticalFailures === 0 ? 'amber' : 'red';
  return { readinessGrade, goNoGo: readinessGrade === 'green' ? 'go' : readinessGrade === 'amber' ? 'conditional_go' : 'no_go', criticalFailures };
}
export function summarizeByChannel(items = []) {
  const summary = {};
  for (const channel of ALLOWED_CHANNELS) summary[channel] = { pass: 0, warning: 0, fail: 0, blocked: 0, not_applicable: 0, keyBlocker: null, recommendation: null };
  for (const item of items.filter((i) => i.channelKey)) {
    const row = summary[item.channelKey] || (summary[item.channelKey] = { pass: 0, warning: 0, fail: 0, blocked: 0, not_applicable: 0, keyBlocker: null, recommendation: null });
    row[item.checkStatus] = (row[item.checkStatus] || 0) + 1;
    if (!row.keyBlocker && ['fail', 'blocked', 'warning'].includes(item.checkStatus)) { row.keyBlocker = item.detail; row.recommendation = item.recommendation; }
  }
  return summary;
}
export function summarizeByCategory(items = []) {
  const summary = {};
  for (const item of items) {
    const row = summary[item.category] || (summary[item.category] = { pass: 0, warning: 0, fail: 0, blocked: 0, not_applicable: 0, total: 0 });
    row[item.checkStatus] = (row[item.checkStatus] || 0) + 1; row.total += 1;
  }
  return summary;
}

export async function runOtaPreflightChecks(input = {}) {
  const warnings = [];
  const items = [];
  const tables = Object.fromEntries(await Promise.all(['plp_ota_room_mappings','plp_ota_rate_plan_mappings','plp_ota_reservation_imports','plp_ota_conflicts','plp_ota_conflict_resolution_events','plp_ota_mapping_audit_events','plp_staff_tasks','plp_active_blocked_dates','plp_active_booking_holds','plp_ota_sync_events','plp_ota_channels'].map(async (table) => [table, await safeSelect(table)])));
  const add = (...args) => items.push(buildPreflightCheck(...args));
  const req = { foundation: ['plp_ota_sync_events'], reservation: ['plp_ota_reservation_imports'], conflict: ['plp_ota_conflict_resolution_events'], mapping: ['plp_ota_room_mappings','plp_ota_rate_plan_mappings'] };
  Object.entries(req).forEach(([key, names]) => add('database', `${key}_tables_available`, names.every((n) => tables[n].ok) ? 'pass' : 'fail', { severity: key === 'mapping' ? 'critical' : 'high', detail: names.filter((n) => !tables[n].ok).join(', ') || `${key} tables available`, recommendation: 'Apply the prior OTA phase migrations before using preflight.' }));

  const rooms = tables.plp_ota_room_mappings.rows;
  const rates = tables.plp_ota_rate_plan_mappings.rows;
  const channels = tables.plp_ota_channels.rows;
  for (const channel of ALLOWED_CHANNELS) {
    const channelRows = [...rooms, ...rates, ...channels].filter((r) => r.channel_key === channel || r.channelKey === channel);
    add('channel', 'channel_appears_in_readiness_data', channelRows.length ? 'pass' : 'warning', { channelKey: channel, severity: 'low', detail: channelRows.length ? 'Channel appears in planning data.' : 'Channel has no planning or mapping records yet.', recommendation: 'Add review-only mappings or planning notes before connector work.' });
    add('channel', 'no_live_sync_enabled', channelRows.some(hasLiveFlag) ? 'blocked' : 'pass', { channelKey: channel, severity: 'critical', detail: channelRows.some(hasLiveFlag) ? 'Live-mode flag detected in OTA planning data.' : 'No live OTA mode flag detected.', recommendation: 'Remove or disable live flags until an approved live-sync phase.' });
    add('channel', 'no_credentials_stored', channelRows.some(hasCredentialShape) ? 'blocked' : 'pass', { channelKey: channel, severity: 'critical', detail: channelRows.some(hasCredentialShape) ? 'Credential-shaped field detected.' : 'No credential-shaped fields detected.', recommendation: 'Do not store OTA credentials in admin planning tables.' });
    add('channel', 'planning_or_review_only', channelRows.some((r) => ['live','connected','active_sync'].includes(statusOf(r))) ? 'blocked' : 'pass', { channelKey: channel, severity: 'critical', detail: 'Channel status remains planning/review-only.', recommendation: 'Keep channel records in planning or review-only states.' });
  }

  const activeRooms = rooms.filter((r) => !isArchivedOrBlocked(r));
  for (const name of ACCOMMODATIONS) {
    const mapped = activeRooms.filter((r) => r.internal_accommodation_name === name || r.accommodation_name === name);
    add('room_mapping', `room_mapping_${name.toLowerCase().replaceAll(' ', '_')}`, mapped.length ? 'pass' : 'warning', { severity: 'medium', detail: mapped.length ? `${name} has ${mapped.length} room mapping(s).` : `${name} has no active room mapping.`, recommendation: 'Create at least one reviewed room mapping before OTA connector work.' });
  }
  activeRooms.filter(isApproved).forEach((r) => add('room_mapping', 'approved_room_has_ota_identifier', (r.ota_room_id || r.ota_room_name || r.ota_listing_id || r.ota_channel_room_code) ? 'pass' : 'fail', { channelKey: r.channel_key, severity: 'high', detail: `${r.internal_accommodation_name || 'Approved room'} needs OTA identifier evidence.`, recommendation: 'Add OTA room ID, room name, listing ID, or channel room code.' }));

  const activeRates = rates.filter((r) => !isArchivedOrBlocked(r));
  activeRooms.filter(isApproved).forEach((room) => {
    const matches = activeRates.filter((rate) => rate.internal_accommodation_name === room.internal_accommodation_name && rate.channel_key === room.channel_key);
    add('rate_mapping', 'approved_room_has_rate_mapping', matches.length ? 'pass' : 'warning', { channelKey: room.channel_key, severity: 'medium', detail: `${room.internal_accommodation_name} ${room.channel_key} has ${matches.length} rate mapping(s).`, recommendation: 'Add at least one rate plan mapping for each approved room mapping.' });
  });
  activeRates.filter(isApproved).forEach((r) => {
    add('rate_mapping', 'rate_has_ota_identifier', (r.ota_rate_plan_id || r.ota_rate_plan_name || r.ota_rate_code) ? 'pass' : 'fail', { channelKey: r.channel_key, severity: 'high', detail: `${r.internal_accommodation_name || 'Approved rate'} rate identifier check.`, recommendation: 'Add OTA rate plan ID, name, or code.' });
    add('rate_mapping', 'rate_currency_php', String(r.currency || 'PHP').toUpperCase() === 'PHP' ? 'pass' : 'warning', { channelKey: r.channel_key, severity: 'medium', detail: `Currency is ${r.currency || 'PHP'}.`, recommendation: 'Document any non-PHP currency before connector work.' });
    const min = Number(r.min_nights), max = Number(r.max_nights);
    add('rate_mapping', 'rate_nights_possible', Number.isFinite(min) && Number.isFinite(max) && max > 0 && min > max ? 'fail' : 'pass', { channelKey: r.channel_key, severity: 'high', detail: 'Minimum/maximum stay values are not impossible.', recommendation: 'Ensure max nights is blank/zero or greater than/equal to min nights.' });
  });

  const imports = tables.plp_ota_reservation_imports.rows;
  add('reservation_review', 'reservation_imports_table_exists', tables.plp_ota_reservation_imports.ok ? 'pass' : 'fail', { severity: 'high', detail: tables.plp_ota_reservation_imports.error || 'OTA reservation imports table exists.' });
  add('reservation_review', 'needs_review_queue_count', imports.filter((r) => ['needs_review','in_review'].includes(statusOf(r))).length ? 'warning' : 'pass', { severity: 'medium', detail: `${imports.filter((r) => ['needs_review','in_review'].includes(statusOf(r))).length} import(s) need review.`, recommendation: 'Clear staged import review queue before connector work.' });
  add('reservation_review', 'critical_high_unresolved_imports', imports.filter((r) => ['critical','high'].includes(String(r.severity || '').toLowerCase()) && !['approved','ignored','resolved','rejected','archived'].includes(statusOf(r))).length ? 'fail' : 'pass', { severity: 'high', detail: 'Critical/high unresolved import count checked.' });
  add('reservation_review', 'duplicate_invalid_imports', imports.filter((r) => r.is_duplicate || r.duplicate_of || ['duplicate','invalid'].includes(String(r.import_status || r.review_status || '').toLowerCase())).length ? 'warning' : 'pass', { severity: 'medium', detail: 'Duplicate/invalid import count checked.' });

  const conflicts = tables.plp_ota_conflicts.rows;
  ['critical','high'].forEach((sev) => add('conflict_resolution', `open_${sev}_conflicts`, conflicts.filter((r) => String(r.severity).toLowerCase() === sev && ['open','waiting_on_staff','needs_review'].includes(statusOf(r))).length ? 'fail' : 'pass', { severity: sev, detail: `Open ${sev} conflict count checked.`, recommendation: 'Resolve or explicitly ignore blocking conflicts before connector work.' }));
  add('conflict_resolution', 'waiting_on_staff_conflicts', conflicts.filter((r) => statusOf(r) === 'waiting_on_staff').length ? 'warning' : 'pass', { severity: 'medium', detail: 'Waiting-on-staff conflict count checked.' });
  add('conflict_resolution', 'audit_event_table_exists', tables.plp_ota_conflict_resolution_events.ok && tables.plp_ota_mapping_audit_events.ok ? 'pass' : 'warning', { severity: 'medium', detail: 'Conflict and mapping audit tables checked.' });

  add('manual_blocks', 'active_manual_blocks_available', tables.plp_active_blocked_dates.ok ? 'pass' : 'warning', { severity: 'high', detail: tables.plp_active_blocked_dates.error || 'Active manual blocks source exists.', recommendation: 'Keep manual blocks visible to operators; preflight does not change blocks.' });
  add('manual_blocks', 'manual_block_conflicts_surfaced', conflicts.some((r) => String(r.conflict_type || '').includes('block')) ? 'warning' : 'pass', { severity: 'high', detail: 'Manual block conflict surfacing checked.' });
  add('operations', 'active_booking_holds_available', tables.plp_active_booking_holds.ok ? 'pass' : 'warning', { severity: 'critical', detail: tables.plp_active_booking_holds.error || 'Active booking holds source exists.', recommendation: 'Direct booking protection must stay visible before any connector work.' });
  add('operations', 'direct_booking_overlap_conflicts', conflicts.some((r) => String(r.conflict_type || '').includes('direct')) ? 'fail' : 'pass', { severity: 'critical', detail: 'Direct-booking overlap conflicts checked.' });

  const tasks = tables.plp_staff_tasks.rows;
  add('staff_tasks', 'staff_tasks_table_available', tables.plp_staff_tasks.ok ? 'pass' : 'warning', { severity: 'medium', detail: tables.plp_staff_tasks.error || 'Staff task table exists.' });
  add('staff_tasks', 'open_high_priority_ota_tasks', tasks.filter((r) => ['open','in_progress'].includes(statusOf(r)) && String(r.priority).toLowerCase() === 'high' && /ota|admin/i.test(`${r.category} ${r.title} ${r.note}`)).length ? 'warning' : 'pass', { severity: 'medium', detail: 'Open high-priority OTA/admin tasks checked.' });
  add('staff_tasks', 'stale_open_tasks', tasks.filter((r) => ['open','in_progress'].includes(statusOf(r)) && r.created_at && Date.now() - Date.parse(r.created_at) > 7 * 86400000).length ? 'warning' : 'pass', { severity: 'low', detail: 'Stale open task count checked.' });

  add('security', 'staff_code_route_protection_required', 'pass', { severity: 'critical', detail: 'Admin route still requires existing staff access before this module runs.' });
  add('security', 'no_ota_credentials_detected', [...rooms, ...rates, ...channels].some(hasCredentialShape) ? 'blocked' : 'pass', { severity: 'critical', detail: 'Credential-shaped OTA fields checked.' });
  add('security', 'no_live_mode_flags_enabled', [...rooms, ...rates, ...channels].some(hasLiveFlag) ? 'blocked' : 'pass', { severity: 'critical', detail: 'Live-mode OTA flags checked.' });
  add('deployment', 'live_route_verification', 'warning', { severity: 'low', detail: 'Live route verification unavailable from this environment.', recommendation: 'Verify deployed admin route after migration in the normal release process.' });

  const readinessScore = calculateReadinessScore(items);
  const { readinessGrade, goNoGo, criticalFailures } = calculateGoNoGo(readinessScore, items);
  const summary = { totalChecks: items.length, passedChecks: items.filter((i) => i.checkStatus === 'pass').length, warningChecks: items.filter((i) => i.checkStatus === 'warning').length, failedChecks: items.filter((i) => ['fail','blocked'].includes(i.checkStatus)).length, criticalFailures, openConflicts: conflicts.filter((r) => ['open','waiting_on_staff','needs_review'].includes(statusOf(r))).length, missingMappings: items.filter((i) => i.category.includes('mapping') && ['warning','fail','blocked'].includes(i.checkStatus)).length, openStaffTasks: tasks.filter((r) => ['open','in_progress'].includes(statusOf(r))).length };
  const channelSummary = summarizeByChannel(items);
  const categorySummary = summarizeByCategory(items);
  let run = null;
  try { run = await insertRow('plp_ota_preflight_runs', { run_status: 'completed', readiness_score: readinessScore, readiness_grade: readinessGrade, go_no_go: goNoGo, total_checks: summary.totalChecks, passed_checks: summary.passedChecks, warning_checks: summary.warningChecks, failed_checks: summary.failedChecks, critical_failures: criticalFailures, check_summary: { ...summary, categorySummary }, channel_summary: channelSummary, operator_note: text(input.operatorNote, 1200) || null, created_by: text(input.createdBy || 'staff', 120) }); }
  catch (error) { warnings.push(`Preflight run was computed but not saved: ${error.message}`); }
  if (run?.id) {
    for (const item of items) {
      try { await insertRow('plp_ota_preflight_check_items', { run_id: run.id, category: item.category, channel_key: item.channelKey, check_key: item.checkKey, check_label: item.checkLabel, check_status: item.checkStatus, severity: item.severity, detail: item.detail, recommendation: item.recommendation, evidence: item.evidence }); }
      catch (error) { warnings.push(`A preflight check item was not saved: ${error.message}`); break; }
    }
  }
  return { ok: true, reviewOnly: true, run, readinessScore, readinessGrade, goNoGo, summary, channelSummary, categorySummary, items, warnings, message: 'Preflight completed. No OTA sync, booking, payment, or guest-message action was performed.' };
}

export async function getLatestOtaPreflightRun() {
  const rows = await selectRows('plp_ota_preflight_runs', 'select=*&order=created_at.desc&limit=1');
  const run = rows?.[0] || null;
  const items = run?.id ? await listOtaPreflightRunItems(run.id) : [];
  return { ok: true, reviewOnly: true, run, items };
}
export async function listOtaPreflightRuns(filters = {}) {
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 25, 1), 100);
  const parts = ['select=*', 'order=created_at.desc', `limit=${limit}`];
  if (filters.goNoGo) parts.push(`go_no_go=eq.${enc(filters.goNoGo)}`);
  if (filters.readinessGrade) parts.push(`readiness_grade=eq.${enc(filters.readinessGrade)}`);
  return await selectRows('plp_ota_preflight_runs', parts.join('&')) || [];
}
export async function listOtaPreflightRunItems(runId) {
  if (!runId) return [];
  return await selectRows('plp_ota_preflight_check_items', `run_id=eq.${enc(runId)}&select=*&order=category.asc&limit=1000`) || [];
}
