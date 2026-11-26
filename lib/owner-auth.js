import { godSessionSecret } from './god-session-key.js';
import { plpSupabaseEnv } from './plp-supabase-env.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ownerEmails, isOwnerEmail } from './site-config.js';
import { ownerSignInUrl } from './safe-next-path.js';

export const OWNER_COOKIE = '__Host-plp_owner';
const TTL_SECONDS = 6 * 60 * 60;

export function ownerConfigured(env = process.env) {
  env = plpSupabaseEnv(env);
  return ownerEmails(env).length > 0 &&
    typeof env.PLP_OWNER_SESSION_SECRET === 'string' && env.PLP_OWNER_SESSION_SECRET.length >= 48 &&
    /^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(env.SUPABASE_URL || '') &&
    Boolean(env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function ownerOriginAllowed(req) {
  const host = String(req.headers?.host || '').toLowerCase();
  return host === 'plp-boracay.vercel.app' &&
    req.headers?.origin === 'https://plp-boracay.vercel.app';
}

function digest(value, key) {
  return createHmac('sha256', key).update(value).digest('base64url');
}
export function signOwnerSession(uid, key, now = Date.now()) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(uid) || typeof key !== 'string' || key.length < 48) throw new Error('Invalid owner session');
  const payload = Buffer.from(JSON.stringify({ v: 1, uid, iat: Math.floor(now/1000), exp: Math.floor(now/1000) + TTL_SECONDS })).toString('base64url');
  return payload + '.' + digest(payload, key);
}
export function verifyOwnerSession(token, key, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 700 || typeof key !== 'string' || key.length < 48) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  const expected = Buffer.from(digest(parts[0], key));
  const received = Buffer.from(parts[1]);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const time = Math.floor(now/1000);
    if (value.v !== 1 || typeof value.uid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(value.uid) ||
        !Number.isInteger(value.iat) || !Number.isInteger(value.exp) ||
        value.iat > time + 60 || value.exp <= time || value.exp > value.iat + TTL_SECONDS) return null;
    return value;
  } catch { return null; }
}
export function readOwnerCookie(req, env = process.env) {
  const cookies = String(req.headers?.cookie || '').split(';');
  const raw = cookies.find(item => item.trim().startsWith(OWNER_COOKIE + '='));
  if (!raw) return null;
  const token = raw.trim().slice(OWNER_COOKIE.length + 1);
  return readAuthenticatedSession(token, env.PLP_OWNER_SESSION_SECRET, env);
}
export function readAuthenticatedSession(token, secret, env = process.env) {
  const regular = verifyOwnerSession(token, secret);
  if (regular) return regular;
  const code = verifyOwnerSession(token, godSessionSecret(secret, env));
  return code ? { ...code, authMethod: 'god-code' } : null;
}
export function ownerCookie(uid, env = process.env, godMode = false) {
  return OWNER_COOKIE + '=' + signOwnerSession(uid, godMode ? godSessionSecret(env.PLP_OWNER_SESSION_SECRET, env) : env.PLP_OWNER_SESSION_SECRET) +
    '; Path=/; Max-Age=' + TTL_SECONDS + '; HttpOnly; Secure; SameSite=Strict; Priority=High';
}
export function clearOwnerCookie() {
  return OWNER_COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Priority=High';
}
function validActiveOwner(user, env) {
  return user && typeof user.id === 'string' && /^[0-9a-f-]{36}$/i.test(user.id) &&
    isOwnerEmail(user.email, env) &&
    !user.deleted_at &&
    (!user.banned_until || Date.parse(user.banned_until) < Date.now()) &&
    user.is_anonymous !== true;
}
function validVerifiedOwner(user, env) {
  return validActiveOwner(user, env) && Boolean(user.email_confirmed_at);
}
async function authFetch(path, headers, options = {}, env = process.env, fetcher = fetch) {
  env = plpSupabaseEnv(env);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error('Owner identity provider unavailable');
  const url = String(env.SUPABASE_URL).replace(/\/$/, '') + '/auth/v1/' + path;
  const reply = await fetcher(url, { ...options, cache: 'no-store', headers: { apikey: env.SUPABASE_ANON_KEY, ...headers } });
  const body = await reply.json().catch(() => ({}));
  if (!reply.ok) throw Object.assign(new Error('Owner identity provider rejected request'), { status: reply.status });
  return body;
}
export async function validateOwnerBearer(token, env = process.env, fetcher = fetch) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 8192) return null;
  try {
    const user = await authFetch('user', { Authorization: 'Bearer ' + token }, {}, env, fetcher);
    return validVerifiedOwner(user, env) ? user : null;
  } catch { return null; }
}
async function fetchCurrentOwner(uid, env, fetcher, godMode) {
  env = plpSupabaseEnv(env);
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return null;
  try {
    const user = await authFetch('admin/users/' + encodeURIComponent(uid), {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
    }, {}, env, fetcher);
    const record = user.user || user;
    return record.id === uid && (godMode ? validActiveOwner(record, env) && resolveOwnerEmail(env.PLP_OWNER_EMAIL || '', env) === String(record.email || '').trim().toLowerCase() : validVerifiedOwner(record, env)) ? record : null;
  } catch { return null; }
}
export function validateCurrentOwner(uid, env = process.env, fetcher = fetch) {
  return fetchCurrentOwner(uid, env, fetcher, false);
}
// Only callers holding a separately signed code-session may use this identity check.
export function validateGodOwner(uid, env = process.env, fetcher = fetch) {
  return fetchCurrentOwner(uid, env, fetcher, true);
}
// Resolve which allow-listed owner a sign-in is for. A supplied address must be
// on the allow-list; with a single configured owner it may be omitted.
export function resolveOwnerEmail(supplied, env = process.env) {
  const list = ownerEmails(env);
  const email = String(supplied || '').trim().toLowerCase();
  if (email) return list.includes(email) ? email : null;
  return list.length === 1 ? list[0] : null;
}
export async function requestOwnerEmail(env = process.env, fetcher = fetch, email = resolveOwnerEmail('', env), next) {
  if (!email || !isOwnerEmail(email, env)) throw Object.assign(new Error('Not an owner account'), { status: 403 });
  return authFetch('otp?redirect_to=' + encodeURIComponent(ownerSignInUrl(next)),
    { 'Content-Type': 'application/json' },
    { method: 'POST', body: JSON.stringify({ email, create_user: true }) }, env, fetcher);
}
export async function verifyOwnerOtp(code, env = process.env, fetcher = fetch, email = resolveOwnerEmail('', env)) {
  if (typeof code !== 'string' || !/^\d{6,8}$/.test(code)) return null;
  if (!email || !isOwnerEmail(email, env)) return null;
  try {
    const result = await authFetch('verify', { 'Content-Type': 'application/json' },
      { method: 'POST', body: JSON.stringify({ email, token: code, type: 'email' }) }, env, fetcher);
    return await validateOwnerBearer(result.access_token, env, fetcher);
  } catch { return null; }
}
