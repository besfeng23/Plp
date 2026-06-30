import { insertRow, selectRows } from './_supabase.js';
import { assertLiveSyncDisabled } from './otaAdapters.js';

const MAX_DAYS = 120;
const CHANNEL_KEYS = ['agoda', 'airbnb', 'expedia', 'booking_com', 'direct_website', 'google_hotel_ads', 'trip_com'];
const DEFAULT_ROOMS = ['Grand Ocean Villa', 'Sunset Suite', 'Smart Room Premium'];

const enc = (value) => encodeURIComponent(String(value ?? ''));
const ymd = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const dayMs = 24 * 60 * 60 * 1000;

function eachDate(startDate, endDate) {
  const days = [];
  for (let t = Date.parse(`${startDate}T00:00:00Z`); t < Date.parse(`${endDate}T00:00:00Z`); t += dayMs) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

function nextDate(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + dayMs).toISOString().slice(0, 10);
}

function validateRange(startDate, endDate) {
  if (!ymd(startDate) || !ymd(endDate)) return { ok: false, error: 'startDate and endDate must be YYYY-MM-DD.' };
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const count = Math.round((end - start) / dayMs);
  if (!Number.isFinite(count) || count <= 0) return { ok: false, error: 'endDate must be after startDate.' };
  if (count > MAX_DAYS) return { ok: false, error: 'Date range may not exceed 120 days.' };
  return { ok: true, count };
}

function rowDate(row, keys) {
  for (const key of keys) if (row?.[key]) return String(row[key]).slice(0, 10);
  return null;
}

function overlapsDate(row, date) {
  const start = rowDate(row, ['date', 'blocked_date', 'calendar_date', 'check_in', 'start_date']);
  const end = rowDate(row, ['check_out', 'end_date']);
  if (!start) return false;
  return end ? start <= date && date < end : start === date;
}

function sameRoom(row, room) {
  return String(row?.accommodation_name || row?.internal_accommodation_name || row?.accommodation || '').trim() === room;
}

async function safeSelect(table, query, warnings) {
  try { return await selectRows(table, query); } catch (error) { warnings.push(`${table}: ${error.message}`); return []; }
}

export async function getOtaReadinessSnapshot() {
  const warnings = [];
  const channels = await safeSelect('plp_ota_channels', 'select=*&order=channel_key.asc', warnings);
  const conflicts = await safeSelect('plp_ota_conflicts', 'status=eq.open&select=id,severity,channel_key', warnings);
  return {
    ok: warnings.length === 0,
    channels,
    summary: {
      channelCount: channels.length,
      configuredCredentialCount: channels.filter((c) => c.credential_state === 'configured').length,
      enabledInventorySyncCount: channels.filter((c) => c.inventory_sync_enabled).length,
      openConflictCount: conflicts.length,
    },
    planningStatus: 'dry_run_only',
    warnings,
  };
}

export async function getOtaMappingSnapshot() {
  const warnings = [];
  const mappings = await safeSelect('plp_ota_room_mappings', 'select=*&order=channel_key.asc,internal_accommodation_name.asc', warnings);
  return {
    ok: warnings.length === 0,
    mappings,
    summary: {
      mappingCount: mappings.length,
      readyMappingCount: mappings.filter((m) => m.mapping_status === 'ready' && m.sync_enabled && m.ota_room_id && m.ota_rate_plan_id).length,
      incompleteMappingCount: mappings.filter((m) => !(m.mapping_status === 'ready' && m.sync_enabled && m.ota_room_id && m.ota_rate_plan_id)).length,
    },
    warnings,
  };
}

export function detectOtaInventoryConflicts(input) {
  const conflicts = [];
  const add = (type, severity, details = {}) => conflicts.push({ type, conflictType: type, severity, status: 'open', ...details });
  const channels = input?.channels || [];
  const mappings = input?.mappings || [];
  for (const channel of channels) {
    if (!channel.inventory_sync_enabled) add('channel_disabled', 'medium', { channelKey: channel.channel_key });
    if (channel.credential_state !== 'configured') add('channel_credentials_missing', 'medium', { channelKey: channel.channel_key });
  }
  const seen = new Set();
  for (const m of mappings) {
    const key = `${m.channel_key}|${m.internal_accommodation_name}`;
    if (seen.has(key)) add('duplicate_mapping', 'high', { channelKey: m.channel_key, accommodationName: m.internal_accommodation_name });
    seen.add(key);
    if (m.sync_enabled && !m.ota_room_id) add('mapping_missing_ota_room', 'high', { channelKey: m.channel_key, accommodationName: m.internal_accommodation_name });
    if (m.sync_enabled && !m.ota_rate_plan_id) add('mapping_missing_rate_plan', 'high', { channelKey: m.channel_key, accommodationName: m.internal_accommodation_name });
  }
  return conflicts;
}

export async function createOtaSyncEvent(payload) {
  return insertRow('plp_ota_sync_events', payload);
}

export async function createOtaConflict(payload) {
  return insertRow('plp_ota_conflicts', { status: 'open', ...payload });
}

function normalizeConflict(candidate, options = {}) {
  return {
    channel_key: candidate.channelKey || candidate.channel_key || options.channelKey || 'all',
    conflict_type: candidate.conflictType || candidate.type || 'ota_dry_run_conflict',
    internal_booking_reference: candidate.internalBookingReference || null,
    ota_reservation_reference: candidate.otaReservationReference || null,
    accommodation_name: candidate.accommodationName || null,
    start_date: candidate.startDate || options.startDate || null,
    end_date: candidate.endDate || options.endDate || null,
    severity: candidate.severity || 'medium',
    status: 'open',
    details: {
      phase: '2A',
      mode: 'dry_run',
      generatedAt: new Date().toISOString(),
      ...candidate,
    },
  };
}

async function persistConflictCandidates(candidates, warnings, options) {
  let logged = 0;
  const seen = new Set();
  for (const candidate of candidates.slice(0, 250)) {
    const row = normalizeConflict(candidate, options);
    const key = [row.channel_key, row.conflict_type, row.accommodation_name, row.start_date, row.end_date].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      await createOtaConflict(row);
      logged += 1;
    } catch (error) {
      warnings.push(`Dry-run calculated but conflict logging failed: ${error.message}`);
      break;
    }
  }
  return logged;
}

export async function buildOtaInventoryDryRun(options = {}) {
  assertLiveSyncDisabled();
  const mode = options.mode || 'dry_run';
  if (mode === 'live') throw new Error('Live OTA sync is not supported in Phase 2A.');
  if (!['planning', 'dry_run'].includes(mode)) throw new Error('Unsupported OTA sync mode.');
  const range = validateRange(options.startDate, options.endDate);
  if (!range.ok) throw new Error(range.error);
  const warnings = [];
  const channelQuery = options.channelKey ? `channel_key=eq.${enc(options.channelKey)}&select=*` : 'select=*&order=channel_key.asc';
  const mappingQuery = options.accommodationName ? `internal_accommodation_name=eq.${enc(options.accommodationName)}&select=*` : 'select=*';
  const [channelsRaw, mappingsRaw, holds, blocks] = await Promise.all([
    safeSelect('plp_ota_channels', channelQuery, warnings),
    safeSelect('plp_ota_room_mappings', mappingQuery, warnings),
    safeSelect('plp_active_booking_holds', `select=*&check_in=lt.${enc(options.endDate)}&check_out=gt.${enc(options.startDate)}`, warnings),
    safeSelect('plp_active_blocked_dates', `select=*&start_date=lt.${enc(options.endDate)}&end_date=gt.${enc(options.startDate)}`, warnings),
  ]);
  const selectedChannels = (channelsRaw.length ? channelsRaw : []).filter((c) => !options.channelKey || c.channel_key === options.channelKey);
  const channels = selectedChannels.length ? selectedChannels : CHANNEL_KEYS.filter((key) => !options.channelKey || key === options.channelKey).map((key) => ({ channel_key: key, channel_name: key, connection_state: 'not_connected', credential_state: 'missing', inventory_sync_enabled: false }));
  const days = eachDate(options.startDate, options.endDate);
  const summary = { channelsChecked: channels.length, mappingsChecked: 0, daysChecked: 0, availableDays: 0, blockedDays: 0, directHoldDays: 0, conflictDays: 0, skippedDays: 0 };
  const conflictCandidates = detectOtaInventoryConflicts({ channels, mappings: mappingsRaw });
  const resultChannels = channels.map((channel) => {
    const channelMappings = mappingsRaw.filter((m) => m.channel_key === channel.channel_key && (!options.accommodationName || m.internal_accommodation_name === options.accommodationName));
    const mapped = channelMappings.length ? channelMappings : (options.accommodationName ? [options.accommodationName] : DEFAULT_ROOMS).map((room) => ({ channel_key: channel.channel_key, internal_accommodation_name: room, mapping_status: 'draft', sync_enabled: false }));
    summary.mappingsChecked += mapped.length;
    return { channelKey: channel.channel_key, channelName: channel.channel_name, connectionState: channel.connection_state, inventorySyncEnabled: Boolean(channel.inventory_sync_enabled), dryRunAllowed: true, mappings: mapped.map((m) => {
      const ready = m.mapping_status === 'ready' && m.sync_enabled && m.ota_room_id && m.ota_rate_plan_id;
      const dayRows = days.map((date) => {
        const manualBlockCount = blocks.filter((b) => sameRoom(b, m.internal_accommodation_name) && overlapsDate(b, date)).length;
        const directBookingHoldCount = holds.filter((h) => sameRoom(h, m.internal_accommodation_name) && overlapsDate(h, date)).length;
        let available = true, reason = 'open', proposedAction = 'would_open_inventory', conflicts = [];
        if (!channel.inventory_sync_enabled) { proposedAction = 'skip_channel_disabled'; summary.skippedDays += 1; }
        else if (!ready) { proposedAction = 'skip_mapping_not_ready'; summary.skippedDays += 1; }
        else if (manualBlockCount && directBookingHoldCount) {
          available = false;
          reason = 'conflict_manual_block_and_booking';
          proposedAction = 'needs_review';
          conflicts = ['manual_block_overlaps_booking'];
          summary.conflictDays += 1;
          conflictCandidates.push({
            type: 'manual_block_overlaps_booking',
            conflictType: 'manual_block_overlaps_booking',
            severity: 'critical',
            channelKey: channel.channel_key,
            accommodationName: m.internal_accommodation_name,
            startDate: date,
            endDate: nextDate(date),
            manualBlockCount,
            directBookingHoldCount,
          });
        }
        else if (manualBlockCount) { available = false; reason = 'manual_block'; proposedAction = 'would_close_inventory'; summary.blockedDays += 1; }
        else if (directBookingHoldCount) { available = false; reason = 'direct_booking_hold'; proposedAction = 'would_close_inventory'; summary.directHoldDays += 1; }
        else { summary.availableDays += 1; }
        summary.daysChecked += 1;
        return { date, available, reason, directBookingHoldCount, manualBlockCount, conflicts, proposedAction };
      });
      return { internalAccommodationName: m.internal_accommodation_name, otaRoomId: m.ota_room_id || null, otaRoomName: m.ota_room_name || null, otaRatePlanId: m.ota_rate_plan_id || null, otaRatePlanName: m.ota_rate_plan_name || null, mappingStatus: m.mapping_status || 'draft', syncEnabled: Boolean(m.sync_enabled), days: dayRows };
    })};
  });
  const output = { ok: true, mode: 'dry_run', generatedAt: new Date().toISOString(), range: { startDate: options.startDate, endDate: options.endDate }, channels: resultChannels, summary, warnings };
  const conflictLoggedCount = await persistConflictCandidates(conflictCandidates, output.warnings, options);
  try { await createOtaSyncEvent({ channel_key: options.channelKey || 'all', event_type: 'inventory_dry_run', mode: 'dry_run', status: 'succeeded', payload: options, result: { summary, conflictCandidateCount: conflictCandidates.length, conflictLoggedCount }, created_by: options.createdBy || 'staff' }); }
  catch (error) { output.warnings.push('Dry-run calculated but event logging failed.'); output.warnings.push(error.message); }
  return output;
}
