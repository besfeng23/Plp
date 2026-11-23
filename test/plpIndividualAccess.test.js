// Plan PR 5: individual accounts and role permissions behind PLP_AUTH_V2_ENABLED
// (default OFF). With the flag off the shared staff code behaves as before.
import test from 'node:test';
import assert from 'node:assert/strict';

const SUPA = 'https://jcyqixttuebxqqfkjonq.supabase.co';
const ids = { ownerA: '11111111-1111-4111-8111-111111111111', ownerB: '22222222-2222-4222-8222-222222222222',
  manager: '33333333-3333-4333-8333-333333333333', desk: '44444444-4444-4444-8444-444444444444', revoked: '55555555-5555-4555-8555-555555555555' };
const emails = { ownerA: 'owner.a@example.test', ownerB: 'owner.b@example.test', manager: 'manager@example.test', desk: 'desk@example.test', revoked: 'former@example.test' };
Object.assign(process.env, { PLP_STAFF_CODE: 'legacy-shared-code', PLP_OWNER_EMAILS: emails.ownerA + ',' + emails.ownerB,
  PLP_OWNER_SESSION_SECRET: 'o'.repeat(64), PLP_STAFF_SESSION_SECRET: 'k'.repeat(64),
  SUPABASE_URL: SUPA, SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service' });
delete process.env.PLP_AUTH_V2_ENABLED;
const { default: admin } = await import('../api/admin.js');
const { default: ownerHandler } = await import('../lib/owner-handler.js');
const ac = await import('../lib/access-control.js');

let roles, events, inserted, otps;
function reset() {
  roles = { [emails.manager]: { role: 'manager', active: true }, [emails.desk]: { role: 'staff', active: true }, [emails.revoked]: { role: 'staff', active: false } };
  events = []; inserted = []; otps = []; ac.resetStaffSignInThrottle();
}
reset();
const users = Object.fromEntries(Object.keys(ids).map(k => [ids[k], { id: ids[k], email: emails[k], email_confirmed_at: '2026-11-01T00:00:00Z', is_anonymous: false }]));
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url); const method = opts.method || 'GET'; const body = opts.body ? JSON.parse(opts.body) : undefined;
  const json = (code, b) => ({ ok: code < 400, status: code, json: async () => b, text: async () => JSON.stringify(b) });
  if (u.pathname.startsWith('/auth/v1/admin/users/')) { const user = users[u.pathname.split('/').pop()]; return user ? json(200, user) : json(404, {}); }
  if (u.pathname === '/auth/v1/otp') { otps.push(body); return json(200, {}); }
  if (u.pathname === '/auth/v1/verify') { const user = Object.values(users).find(x => x.email === body.email); return body.token === '123456' && user ? json(200, { user }) : json(400, {}); }
  if (u.pathname === '/rest/v1/plp_staff_roles') {
    const email = (u.searchParams.get('email') || '').replace(/^eq\./, '');
    if (method === 'GET' && email) { const r = roles[email]; return json(200, r && (u.searchParams.get('active') !== 'eq.true' || r.active) ? [{ role: r.role }] : []); }
    if (method === 'GET') return json(200, Object.entries(roles).map(([e, r]) => ({ email: e, ...r })));
    if (method === 'POST') { roles[body.email] = { role: body.role, active: true }; return json(201, [body]); }
    if (method === 'PATCH') { if (!roles[email]) return json(200, []); roles[email].active = false; return json(200, [{ email, role: roles[email].role }]); }
  }
  if (u.pathname === '/rest/v1/plp_staff_access_events' && method === 'POST') { events.push(body); return json(201, [body]); }
  if (u.pathname === '/rest/v1/plp_staff_tasks' && method === 'POST') { inserted.push(body); return json(201, [body]); }
  return json(500, { message: 'unexpected ' + method + ' ' + u.pathname });
};

const origin = { host: 'plp-boracay.vercel.app', origin: 'https://plp-boracay.vercel.app' };
const cookieFor = who => ({ ...origin, cookie: ac.staffCookie(ids[who], process.env).split(';')[0] });
function res() { return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { this.body = s ? JSON.parse(s) : null; } }; }
async function call(action, { method = 'GET', headers = {}, body, query = {} } = {}) { const r = res(); await admin({ method, headers, body, query: { action, ...query } }, r); return r; }
const on = () => { process.env.PLP_AUTH_V2_ENABLED = 'true'; };
const off = () => { delete process.env.PLP_AUTH_V2_ENABLED; };
const task = { reference: 'PLP-1', title: 'Check towels' };

test('flag off (production default): shared code unchanged, individual sign-in hidden', async () => {
  off(); reset();
  const cfg = await call('auth-config');
  assert.equal(cfg.statusCode, 200); assert.deepEqual([cfg.body.individualAccounts, cfg.body.sharedCode], [false, true]);
  assert.equal((await call('staff-login', { method: 'POST', headers: origin, body: { email: emails.ownerA } })).statusCode, 404);
  assert.equal(otps.length, 0);
  assert.equal((await call('staff-tasks', { method: 'POST', body: task })).statusCode, 401);
  // A signed staff cookie is ignored while the flag is off.
  assert.equal((await call('staff-tasks', { method: 'POST', headers: cookieFor('ownerA'), body: task })).statusCode, 401);
  const legacy = await call('staff-tasks', { method: 'POST', headers: { 'x-plp-staff-code': 'legacy-shared-code', 'x-plp-staff-name': 'Front desk' }, body: task });
  assert.equal(legacy.statusCode, 200); assert.equal(inserted.at(-1).actor, 'Front desk');
  assert.equal((await call('access', { headers: { 'x-plp-staff-code': 'legacy-shared-code' } })).statusCode, 403);
});

test('two owners from the allow-list sign in independently with their own identity', async () => {
  on(); reset();
  for (const who of ['ownerA', 'ownerB']) {
    const login = await call('staff-login', { method: 'POST', headers: origin, body: { email: emails[who] } });
    assert.equal(login.statusCode, 202);
    assert.equal(otps.at(-1).email, emails[who]); assert.equal(otps.at(-1).create_user, false);
    const verify = await call('staff-verify', { method: 'POST', headers: origin, body: { email: emails[who], code: '123456' } });
    assert.equal(verify.statusCode, 200); assert.equal(verify.body.role, 'owner');
    assert.match(verify.headers['Set-Cookie'], /^__Host-plp_staff=.*HttpOnly; Secure; SameSite=Strict/);
    const r = await call('staff-tasks', { method: 'POST', headers: cookieFor(who), body: task });
    assert.equal(r.statusCode, 200); assert.equal(inserted.at(-1).actor, emails[who]);
  }
  assert.equal((await call('staff-verify', { method: 'POST', headers: origin, body: { email: emails.ownerA, code: '000000' } })).statusCode, 401);
  off();
});

test('unprovisioned emails get the same reply and no code; nobody is auto-created', async () => {
  on(); reset();
  for (const email of ['stranger@example.test', emails.revoked]) {
    const r = await call('staff-login', { method: 'POST', headers: origin, body: { email } });
    assert.equal(r.statusCode, 202); assert.match(r.body.message, /If this email has PLP access/);
  }
  assert.equal(otps.length, 0);
  assert.equal((await call('staff-login', { method: 'POST', headers: { host: 'plp-boracay.vercel.app', origin: 'https://evil.example' }, body: { email: emails.ownerA } })).statusCode, 403);
  off();
});

test('tampered or unknown sessions and unauthenticated requests are rejected', async () => {
  on(); reset();
  assert.equal((await call('staff-tasks', { method: 'POST', body: task })).statusCode, 401);
  const good = cookieFor('desk').cookie; const tampered = good.slice(0, -2) + (good.endsWith('A') ? 'BB' : 'AA');
  assert.equal((await call('staff-tasks', { method: 'POST', headers: { cookie: tampered }, body: task })).statusCode, 401);
  const forged = ac.STAFF_COOKIE + '=' + ac.staffCookie(ids.ownerA, { PLP_STAFF_SESSION_SECRET: 'x'.repeat(64) }).split(';')[0].split('=').slice(1).join('=');
  assert.equal((await call('staff-tasks', { method: 'POST', headers: { cookie: forged }, body: task })).statusCode, 401);
  off();
});

test('front-desk staff cannot reach owner finance, analytics, settings or owner documents', async () => {
  on(); reset();
  const desk = cookieFor('desk');
  for (const action of ['owner-month', 'owner-funnel', 'posthog-analytics', 'booking-status', 'content', 'access', 'health', 'ota-readiness'])
    assert.equal((await call(action, { headers: desk })).statusCode, 403, action);
  assert.equal((await call('staff-tasks', { method: 'POST', headers: desk, body: task })).statusCode, 200);
  // Owner documents live behind the separate owner session; a staff session does not open them.
  const r = res(); await ownerHandler({ method: 'GET', headers: desk, query: { operation: 'documents' } }, r);
  assert.equal(r.statusCode, 401);
  off();
});

test('managers run operations but cannot see finance or change anyone\'s access', async () => {
  on(); reset();
  const mgr = cookieFor('manager');
  assert.equal((await call('staff-tasks', { method: 'POST', headers: mgr, body: task })).statusCode, 200);
  assert.equal((await call('owner-month', { headers: mgr })).statusCode, 403);
  for (const method of ['GET', 'POST', 'PATCH'])
    assert.equal((await call('access', { method, headers: mgr, body: { email: 'new@example.test', role: 'manager' } })).statusCode, 403, method);
  assert.equal(events.length, 0);
  off();
});

test('owners grant and revoke staff with an audit trail; owner role cannot be granted', async () => {
  on(); reset();
  const owner = cookieFor('ownerA');
  assert.equal((await call('access', { method: 'POST', headers: owner, body: { email: 'x@example.test', role: 'owner' } })).statusCode, 400);
  assert.equal((await call('access', { method: 'POST', headers: owner, body: { email: emails.ownerB, role: 'staff' } })).statusCode, 409);
  const grant = await call('access', { method: 'POST', headers: owner, body: { email: 'New.Hire@Example.test', role: 'staff' } });
  assert.equal(grant.statusCode, 201); assert.equal(roles['new.hire@example.test'].role, 'staff');
  assert.deepEqual(events.at(-1), { actor_id: ids.ownerA, actor_email: emails.ownerA, action: 'granted', target_email: 'new.hire@example.test', role: 'staff' });
  // Revocation takes effect on the very next request.
  assert.equal((await call('staff-tasks', { method: 'POST', headers: cookieFor('manager'), body: task })).statusCode, 200);
  const revoke = await call('access', { method: 'PATCH', headers: owner, body: { email: emails.manager } });
  assert.equal(revoke.statusCode, 200); assert.equal(events.at(-1).action, 'revoked');
  assert.equal((await call('staff-tasks', { method: 'POST', headers: cookieFor('manager'), body: task })).statusCode, 401);
  assert.equal((await call('staff-tasks', { method: 'POST', headers: cookieFor('revoked'), body: task })).statusCode, 401);
  off();
});

test('writes record the verified account, not a self-declared name header', async () => {
  on(); reset();
  const r = await call('staff-tasks', { method: 'POST', headers: { ...cookieFor('desk'), 'x-plp-staff-name': 'Doctora' }, body: task });
  assert.equal(r.statusCode, 200); assert.equal(inserted.at(-1).actor, emails.desk);
  off();
});

test('shared code can be retired only when V2 is on; access register fails closed', async () => {
  on(); reset();
  process.env.PLP_LEGACY_STAFF_CODE_ENABLED = 'false';
  assert.equal((await call('staff-tasks', { method: 'POST', headers: { 'x-plp-staff-code': 'legacy-shared-code' }, body: task })).statusCode, 401);
  off();
  assert.equal((await call('staff-tasks', { method: 'POST', headers: { 'x-plp-staff-code': 'legacy-shared-code' }, body: task })).statusCode, 200);
  delete process.env.PLP_LEGACY_STAFF_CODE_ENABLED;
  // Missing table (pending migration) => no non-owner role.
  const failing = async () => ({ ok: false, status: 404, json: async () => ({}) });
  assert.equal(await ac.roleForEmail(emails.manager, process.env, failing), null);
  assert.equal(await ac.roleForEmail(emails.ownerB, process.env, failing), 'owner');
  // V2 needs a strong dedicated secret, otherwise it stays off.
  assert.equal(ac.authV2Enabled({ ...process.env, PLP_AUTH_V2_ENABLED: 'true', PLP_STAFF_SESSION_SECRET: 'short' }), false);
  assert.equal(ac.authV2Enabled({ ...process.env }), false);
});

test('admin UI shows individual sign-in only when the server enables it', async () => {
  const fs = await import('node:fs');
  const ui = fs.readFileSync(new URL('../src/admin/PlpAdminApp.jsx', import.meta.url), 'utf8');
  assert.match(ui, /auth-config/); assert.match(ui, /individualAccounts/); assert.match(ui, /staff-verify/);
  const sql = fs.readFileSync(new URL('../supabase/pending/20261123060000_plp_auth_v2_staff_roles.sql', import.meta.url), 'utf8');
  assert.match(sql, /PENDING OWNER APPROVAL/); assert.match(sql, /role in \('manager','staff'\)/);
  assert.ok(!fs.existsSync(new URL('../supabase/migrations/20261123060000_plp_auth_v2_staff_roles.sql', import.meta.url)));
});
