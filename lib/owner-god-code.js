import { plpSupabaseEnv } from './plp-supabase-env.js';
// Node-only helper for the dedicated owner access code on /private-preview.
// The code itself is never stored or logged. Only a SHA-256 hex hash is compared,
// and only a matching, fail-closed configuration can issue owner sessions.

import { canonicalPreviewCode, sha256Hex, timingSafeEqualBytes, header } from './preview-gate.js';
import { ownerCookie, resolveOwnerEmail, validateGodOwner } from './owner-auth.js';
import { staffCookie } from './access-control.js';

const HEX = /^[a-f0-9]{64}$/i;
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const ATTEMPT_LIMIT = 5;
export const GOD_HASH_ENV = 'PLP_OWNER_GOD_CODE_HASH';
const EVENTS_TABLE = 'plp_preview_gate_events';

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function ownerGodCodeConfigured(env = process.env) {
  return HEX.test(String(env[GOD_HASH_ENV] || '').trim().toLowerCase());
}

export async function ownerGodCodeMatches(code, env = process.env) {
  const expected = String(env[GOD_HASH_ENV] || '').trim().toLowerCase();
  if (!HEX.test(expected)) return false;
  const canonical = canonicalPreviewCode(code);
  if (!canonical || canonical.length > 120) return false;
  const actual = await sha256Hex(canonical);
  return timingSafeEqualBytes(hexToBytes(actual), hexToBytes(expected));
}

export function clientIp(req) {
  const forwarded = header(req, 'x-forwarded-for').split(',')[0].trim();
  if (forwarded) return forwarded;
  const real = header(req, 'x-real-ip').trim();
  if (real) return real;
  return '';
}

export async function hashIp(ip) {
  const value = String(ip || '').trim() || 'unknown';
  return sha256Hex(value);
}

export function createMemoryGateStore() {
  const rows = [];
  return {
    async listFails(ipHash, sinceIso) {
      const since = Date.parse(sinceIso);
      return rows.filter((row) => row.kind === 'fail' && row.ip_hash === ipHash && Date.parse(row.created_at) >= since);
    },
    async insert(row) {
      rows.push({ ...row, created_at: row.created_at || new Date().toISOString() });
    },
    rows,
  };
}

export function createSupabaseGateStore(db) {
  return {
    async reserve(ipHash) { return (await db.callRpc('plp_reserve_preview_attempt', { p_ip_hash: ipHash })) === true; },
    async listFails(ipHash, sinceIso) {
      const query = new URLSearchParams({
        select: 'id,created_at',
        kind: 'eq.fail',
        ip_hash: 'eq.' + ipHash,
        created_at: 'gte.' + sinceIso,
      }).toString();
      const rows = await db.selectRows(EVENTS_TABLE, query);
      return Array.isArray(rows) ? rows : [];
    },
    async insert(row) {
      await db.insertRow(EVENTS_TABLE, { kind: row.kind, ip_hash: row.ip_hash });
    },
  };
}

export async function isLockedOut(store, ipHash, now = Date.now()) {
  if (!store) return 'unavailable';
  const sinceIso = new Date(now - ATTEMPT_WINDOW_MS).toISOString();
  try {
    const fails = await store.listFails(ipHash, sinceIso);
    return Array.isArray(fails) && fails.length >= ATTEMPT_LIMIT;
  } catch {
    return 'unavailable';
  }
}

export async function recordFailedAttempt(store, ipHash) {
  if (!store) return;
  await store.insert({ kind: 'fail', ip_hash: ipHash });
}

export async function recordGodSignInAudit(store, ipHash) {
  if (!store) return;
  await store.insert({ kind: 'owner_god_signin', ip_hash: ipHash });
}

export function logGodSignInSuccess() {
  // Structured success audit line. Never include the code, hash, email, or IP.
  console.info(JSON.stringify({ event: 'plp_owner_god_signin', ok: true }));
}

export async function lookupOwnerUser(env = process.env, fetcher = fetch) {
  env = plpSupabaseEnv(env);
  const email = resolveOwnerEmail('', env);
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !base || !key) return null;
  // GoTrue list users is paginated. Match the allow-listed address exactly and
  // revalidate its active, non-banned identity before issuing a code-only session.
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetcher(base + '/auth/v1/admin/users?page=' + page + '&per_page=100', {
      cache: 'no-store',
      headers: { apikey: key, Authorization: 'Bearer ' + key },
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    const users = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
    const user = users.find(item => String(item?.email || '').trim().toLowerCase() === email);
    if (user?.id) return validateGodOwner(user.id, env, fetcher);
    if (users.length < 100) return null;
  }
  return null;
}

export async function issueOwnerGodSession(env = process.env, deps = {}) {
  const staffSecret = env.PLP_STAFF_SESSION_SECRET;
  const ownerSecret = env.PLP_OWNER_SESSION_SECRET;
  if (typeof staffSecret !== 'string' || staffSecret.length < 48) return { ok: false };
  if (typeof ownerSecret !== 'string' || ownerSecret.length < 48) return { ok: false };
  const lookup = deps.lookupOwnerUser || lookupOwnerUser;
  let user = null;
  try { user = await lookup(env, deps.fetcher || fetch); } catch { user = null; }
  if (!user?.id) return { ok: false };
  try {
    return { ok: true, cookies: [ownerCookie(user.id, env, true), staffCookie(user.id, env, true)] };
  } catch {
    return { ok: false };
  }
}
