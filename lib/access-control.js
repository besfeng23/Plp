// Individual accounts and role permissions (plan PR 5), behind
// PLP_AUTH_V2_ENABLED (default OFF). With the flag off every function here is
// inert and the legacy shared staff code behaves exactly as before.
import { signOwnerSession, verifyOwnerSession, ownerOriginAllowed } from './owner-auth.js';
import { ownerEmails, isOwnerEmail } from './site-config.js';
import { hasLegacyStaffAccess } from './staff-access.js';

export const STAFF_COOKIE = '__Host-plp_staff';
export const ROLES = Object.freeze(['owner', 'manager', 'staff']);
// Roles grantable through the access register. Owners come only from the
// PLP_OWNER_EMAILS allow-list, so nobody can grant or self-promote to owner.
export const GRANTABLE_ROLES = Object.freeze(['manager', 'staff']);

export const ROLE_PERMISSIONS = Object.freeze({
  owner: Object.freeze(['session', 'growth', 'office', 'access.manage', 'finance.read', 'analytics.read', 'reservations', 'guests', 'concierge', 'tasks', 'availability', 'availability.read', 'content', 'club', 'ota', 'system', 'notifications']),
  manager: Object.freeze(['session', 'reservations', 'guests', 'concierge', 'tasks', 'availability', 'availability.read', 'content', 'club', 'ota', 'notifications']),
  staff: Object.freeze(['session', 'concierge', 'tasks', 'availability.read', 'notifications']),
});

export function can(role, permission) {
  return Boolean(ROLE_PERMISSIONS[role]?.includes(permission));
}

// What the signed-in person may see. The legacy shared code keeps today's
// full operational view, except access management (owners only).
export function permissionsFor(role) {
  if (role === 'legacy') return ROLE_PERMISSIONS.owner.filter(item => item !== 'access.manage');
  return [...(ROLE_PERMISSIONS[role] || [])];
}

// Permission required for each /api/admin action. Unknown actions need the
// broadest operational permission (reservations) — never less.
export function requiredPermission(action, method = 'GET') {
  const write = method !== 'GET';
  const map = {
    health: 'system', operations: 'reservations', notifications: 'notifications', 'booking-status': 'reservations',
    'staff-tasks': 'tasks', 'staff-task': 'tasks', 'internal-notes': 'tasks',
    'date-blocks': write ? 'availability' : 'availability.read', content: 'content',
    'concierge-inbox': 'concierge',
    'owner-month': 'finance.read', 'owner-funnel': 'analytics.read', 'owner-behavior': 'analytics.read', 'posthog-analytics': 'analytics.read',
    access: 'access.manage', club: 'club', session: 'session',
  };
  if (map[action]) return map[action];
  if (String(action).startsWith('ota-')) return 'ota';
  return 'reservations';
}

const STAFF_SECRET = env => env.PLP_STAFF_SESSION_SECRET;
export function authV2Enabled(env = process.env) {
  return env.PLP_AUTH_V2_ENABLED === 'true' &&
    typeof STAFF_SECRET(env) === 'string' && STAFF_SECRET(env).length >= 48 &&
    /^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(env.SUPABASE_URL || '') &&
    Boolean(env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
}
// While V2 is being proven, the shared code keeps working unless explicitly retired.
export function legacyStaffCodeAllowed(env = process.env) {
  return !(authV2Enabled(env) && env.PLP_LEGACY_STAFF_CODE_ENABLED === 'false');
}

export function staffCookie(uid, env = process.env) {
  return STAFF_COOKIE + '=' + signOwnerSession(uid, STAFF_SECRET(env)) +
    '; Path=/; Max-Age=' + 8 * 3600 + '; HttpOnly; Secure; SameSite=Strict; Priority=High';
}
export function clearStaffCookie() {
  return STAFF_COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Priority=High';
}
export function readStaffTicket(req, env = process.env) {
  const raw = String(req.headers?.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(STAFF_COOKIE + '='));
  if (!raw) return null;
  return verifyOwnerSession(raw.slice(STAFF_COOKIE.length + 1), STAFF_SECRET(env));
}

function base(env) { return String(env.SUPABASE_URL).replace(/\/$/, ''); }
async function json(response) { return response.json().catch(() => null); }

// Supabase Auth identity, re-read on every request so deleted/banned users lose access.
async function authUser(uid, env, fetcher) {
  if (!/^[0-9a-f-]{36}$/i.test(uid || '')) return null;
  const r = await fetcher(base(env) + '/auth/v1/admin/users/' + encodeURIComponent(uid), { cache: 'no-store',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY } });
  if (!r.ok) return null;
  const data = await json(r); const user = data?.user || data;
  if (!user || user.id !== uid || !user.email || !user.email_confirmed_at || user.deleted_at || user.is_anonymous === true) return null;
  if (user.banned_until && Date.parse(user.banned_until) > Date.now()) return null;
  return user;
}

async function rest(path, env, fetcher, { method = 'GET', body, prefer = 'return=representation' } = {}) {
  const r = await fetcher(base(env) + '/rest/v1/' + path, { method, body, cache: 'no-store', headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json', 'Accept-Profile': 'plp_runtime', 'Content-Profile': 'plp_runtime', Prefer: prefer } });
  const data = await json(r);
  if (!r.ok) throw Object.assign(new Error('Access register unavailable'), { status: r.status });
  return data;
}

// Role for a verified email. Owners: allow-list only. Others: active row in the
// access register (pending migration; if the table is absent, nobody but the
// owners can sign in — fail closed).
export async function roleForEmail(email, env = process.env, fetcher = fetch) {
  const normal = String(email || '').trim().toLowerCase();
  if (!normal) return null;
  if (isOwnerEmail(normal, env)) return 'owner';
  try {
    const rows = await rest('plp_staff_roles?' + new URLSearchParams({ email: 'eq.' + normal, active: 'eq.true', select: 'role', limit: '1' }), env, fetcher);
    const role = rows?.[0]?.role;
    return GRANTABLE_ROLES.includes(role) ? role : null;
  } catch { return null; }
}

export async function resolveStaffActor(req, env = process.env, fetcher = fetch) {
  if (!authV2Enabled(env)) return null;
  const ticket = readStaffTicket(req, env);
  if (!ticket) return null;
  const user = await authUser(ticket.uid, env, fetcher);
  if (!user) return null;
  const role = await roleForEmail(user.email, env, fetcher);
  return role ? { id: user.id, email: String(user.email).toLowerCase(), role, verified: true } : null;
}

// One authorization decision for every staff API call.
export async function authorizeStaffRequest(req, action, env = process.env, fetcher = fetch) {
  const permission = requiredPermission(action, req.method);
  const actor = await resolveStaffActor(req, env, fetcher);
  if (actor) {
    if (!can(actor.role, permission)) return { ok: false, status: 403, error: 'Your role does not allow this action.' };
    return { ok: true, actor, permission };
  }
  if (legacyStaffCodeAllowed(env) && hasLegacyStaffAccess(req, env.PLP_STAFF_CODE)) {
    if (permission === 'access.manage') return { ok: false, status: 403, error: 'Access management requires an individual owner account.' };
    return { ok: true, actor: { id: null, email: null, role: 'legacy', verified: false }, permission };
  }
  return { ok: false, status: 401, error: 'Staff access required' };
}

// Audit label: verified actor when present; the unverified x-plp-staff-name
// header is used only on the legacy path (unchanged behaviour while V2 is off).
export function auditActor(req, auth) {
  if (auth?.actor?.verified) return auth.actor.email;
  return String(req.headers?.['x-plp-staff-name'] || 'staff').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 120) || 'staff';
}

// ---- Sign-in (V2 only) ----
const signInHits = [];
function signInAllowed(now = Date.now()) {
  while (signInHits.length && now - signInHits[0] > 15 * 60 * 1000) signInHits.shift();
  if (signInHits.length >= 20) return false;
  signInHits.push(now); return true;
}
export function resetStaffSignInThrottle() { signInHits.length = 0; }

export async function handleStaffAuth(req, res, action, env = process.env, fetcher = fetch) {
  const send = (status, body, cookie) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); if (cookie) res.setHeader('Set-Cookie', cookie); res.end(JSON.stringify(body)); };
  if (action === 'auth-config') {
    if (req.method !== 'GET') return send(405, { ok: false, error: 'Method not allowed' });
    return send(200, { ok: true, individualAccounts: authV2Enabled(env), sharedCode: legacyStaffCodeAllowed(env) });
  }
  if (!authV2Enabled(env)) return send(404, { ok: false, error: 'Unknown admin action' });
  if (req.method !== 'POST') return send(405, { ok: false, error: 'Method not allowed' });
  if (!ownerOriginAllowed(req)) return send(403, { ok: false, error: 'Request origin not allowed' });
  if (action === 'staff-logout') return send(200, { ok: true }, clearStaffCookie());
  if (!signInAllowed()) return send(429, { ok: false, error: 'Please retry sign-in later.' });
  let body = {};
  try { body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}'); } catch {}
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 180) return send(400, { ok: false, error: 'Enter your work email address.' });
  const role = await roleForEmail(email, env, fetcher);
  if (action === 'staff-login') {
    // Same reply either way; only provisioned people receive a code. No user creation.
    if (role) await fetcher(base(env) + '/auth/v1/otp', { method: 'POST', cache: 'no-store',
      headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, create_user: false }) }).catch(() => null);
    return send(202, { ok: true, message: 'If this email has PLP access, a sign-in code has been sent.' });
  }
  if (action === 'staff-verify') {
    const code = String(body.code || '');
    if (!role || !/^\d{6,8}$/.test(code)) return send(401, { ok: false, error: 'Sign-in could not be verified.' });
    const r = await fetcher(base(env) + '/auth/v1/verify', { method: 'POST', cache: 'no-store',
      headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token: code, type: 'email' }) }).catch(() => null);
    const data = r && r.ok ? await json(r) : null;
    const user = data?.user;
    if (!user?.id || String(user.email || '').toLowerCase() !== email || !(await authUser(user.id, env, fetcher))) return send(401, { ok: false, error: 'Sign-in could not be verified.' });
    return send(200, { ok: true, role, email }, staffCookie(user.id, env));
  }
  return send(404, { ok: false, error: 'Unknown admin action' });
}

// ---- Access register (owners only, V2 only) ----
export async function handleAccessRegister(req, res, auth, env = process.env, fetcher = fetch) {
  const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(body)); };
  if (!auth?.actor?.verified || auth.actor.role !== 'owner') return send(403, { ok: false, error: 'Access management requires an individual owner account.' });
  let body = {};
  try { body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}'); } catch {}
  const audit = (action, target, role) => rest('plp_staff_access_events', env, fetcher, { method: 'POST',
    body: JSON.stringify({ actor_id: auth.actor.id, actor_email: auth.actor.email, action, target_email: target, role: role || null }) });
  try {
    if (req.method === 'GET') {
      const rows = await rest('plp_staff_roles?select=email,display_name,role,active,granted_by_email,granted_at,revoked_at&order=email.asc&limit=200', env, fetcher);
      const history = await rest('plp_staff_access_events?select=actor_email,action,target_email,role,created_at&order=created_at.desc&limit=50', env, fetcher).catch(() => []);
      return send(200, { ok: true, owners: ownerEmails(env), people: rows || [], history: history || [] });
    }
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(400, { ok: false, error: 'Enter a valid email address.' });
    if (isOwnerEmail(email, env)) return send(409, { ok: false, error: 'Owner access is managed through the owner allow-list.' });
    if (req.method === 'POST') {
      const role = String(body.role || '');
      if (!GRANTABLE_ROLES.includes(role)) return send(400, { ok: false, error: 'Role must be manager or staff.' });
      const name = String(body.display_name || '').replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 120) || null;
      const rows = await rest('plp_staff_roles?on_conflict=email', env, fetcher, { method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation', body: JSON.stringify({ email, display_name: name, role, active: true, granted_by: auth.actor.id, granted_by_email: auth.actor.email, granted_at: new Date().toISOString(), revoked_at: null, revoked_by: null }) });
      await audit('granted', email, role);
      return send(201, { ok: true, person: rows?.[0] || null });
    }
    if (req.method === 'PATCH') {
      const rows = await rest('plp_staff_roles?' + new URLSearchParams({ email: 'eq.' + email }), env, fetcher, { method: 'PATCH',
        body: JSON.stringify({ active: false, revoked_at: new Date().toISOString(), revoked_by: auth.actor.id }) });
      if (!rows?.length) return send(404, { ok: false, error: 'No access found for that email.' });
      await audit('revoked', email, rows[0].role);
      return send(200, { ok: true, revoked: email });
    }
    return send(405, { ok: false, error: 'Method not allowed' });
  } catch {
    return send(503, { ok: false, error: 'The access register is unavailable.' });
  }
}
