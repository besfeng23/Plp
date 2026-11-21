import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import clubHandler from '../lib/club-handler.js';

const src = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const response = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(data) { this.body = JSON.parse(data); } });
const request = (operation, method = 'GET', body = {}, headers = {}) => ({ query: { operation }, method, body, headers });
const applicant = { full_name: 'Sample Applicant', email: 'Applicant@Example.Test', phone: '09123456789', age_declared_60plus: true, consent_recorded: true };

async function withEnv(t, fn) {
  const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const previous = keys.map(key => process.env[key]);
  process.env.SUPABASE_URL = 'https://test-only.supabase.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-only';
  t.after(() => keys.forEach((key, i) => previous[i] === undefined ? delete process.env[key] : process.env[key] = previous[i]));
  return fn();
}

test('public application verifies 60+ declaration and consent before touching storage', async t => {
  await withEnv(t, async () => {
    const fake = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Invalid application may not reach storage'); });
    for (const fields of [
      { ...applicant, age_declared_60plus: false },
      { ...applicant, consent_recorded: false },
      { ...applicant, full_name: 'A' },
      { ...applicant, email: 'not-an-email' },
      { ...applicant, full_name: 'A'.repeat(141) },
      { ...applicant, phone: '1'.repeat(51) },
    ]) {
      const res = response();
      await clubHandler(request('apply', 'POST', fields), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.received, undefined);
    }
    assert.equal(fake.mock.callCount(), 0);
  });
});

test('online applicant is stored once, as pending, with applicant consent and no public record disclosure', async t => {
  await withEnv(t, async () => {
    const urls = [];
    const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
      urls.push({ url, options });
      if (url.includes('/plp_club_chapters')) return Response.json([{ status: 'OPEN' }]);
      if (options.method === 'GET') return Response.json([]);
      return Response.json([{ id: 'private-member-id', full_name: applicant.full_name, status: 'PENDING' }]);
    });
    const res = response();
    await clubHandler(request('apply', 'POST', applicant, { 'content-length': '235' }), res);
    assert.equal(res.statusCode, 202);
    assert.deepEqual(res.body, { ok: true, received: true, reviewRequired: true });
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.doesNotMatch(JSON.stringify(res.body), /private-member-id|Sample Applicant|example.test/);
    assert.equal(mock.mock.callCount(), 3);
    assert.match(urls[1].url, /consent_source=eq.applicant_web/);
    const saved = JSON.parse(urls[2].options.body);
    assert.equal(saved.consent_source, 'applicant_web');
    assert.equal(saved.chapter_code, 'boracay');
    assert.equal(saved.status, 'PENDING');
    assert.equal(saved.email, 'applicant@example.test');
    assert.ok(saved.consent_at);
    assert.equal(saved.age_declared_60plus, true);
    assert.ok(!('medical' in saved));
  });
});

test('no login is needed for a pending application, but roster and decisions remain staff-only', async t => {
  await withEnv(t, async () => {
    const res = response();
    await clubHandler(request('members'), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.members, undefined);
    const decision = response();
    await clubHandler(request('members', 'PATCH', { status: 'ACTIVE' }), decision);
    assert.equal(decision.statusCode, 403);
  });
});

test('paused chapter closes public applications and exposes no private details', async t => {
  await withEnv(t, async () => {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json([{ status: 'PILOT' }]));
    const status = response();
    await clubHandler(request('application-status'), status);
    assert.deepEqual(status.body, { ok: true, applicationsOpen: false });
    const applied = response();
    await clubHandler(request('apply', 'POST', applicant), applied);
    assert.equal(applied.statusCode, 503);
    assert.equal(applied.body.received, undefined);
    assert.equal(mock.mock.callCount(), 2);
  });
});

test('duplicate email cannot be enumerated; spam honeypot never saves data', async t => {
  await withEnv(t, async () => {
    const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (url.includes('plp_club_chapters')) return Response.json([{ status: 'OPEN' }]);
      if (options.method === 'GET') return Response.json([]);
      return Response.json({ code: '23505', message: 'private duplicate database detail' }, { status: 409 });
    });
    const res = response();
    await clubHandler(request('apply', 'POST', applicant), res);
    assert.equal(res.statusCode, 202);
    assert.deepEqual(res.body, { ok: true, received: true, reviewRequired: true });
    assert.doesNotMatch(JSON.stringify(res.body), /duplicate|private/);
    const hidden = response();
    await clubHandler(request('apply', 'POST', { ...applicant, company_website: 'bot.example' }), hidden);
    assert.equal(hidden.statusCode, 202);
    assert.equal(mock.mock.callCount(), 3);
  });
});

test('application intake has a bounded payload and a public daily acceptance cap', async t => {
  await withEnv(t, async () => {
    const tooBig = response();
    await clubHandler(request('apply', 'POST', applicant, { 'content-length': '5000' }), tooBig);
    assert.equal(tooBig.statusCode, 413);
    const mock = t.mock.method(globalThis, 'fetch', async (url) => {
      if (url.includes('plp_club_chapters')) return Response.json([{ status: 'OPEN' }]);
      return Response.json(Array.from({ length: 300 }, (_,i) => ({ id: String(i) })));
    });
    const limit = response();
    await clubHandler(request('apply', 'POST', applicant), limit);
    assert.equal(limit.statusCode, 429);
    assert.equal(mock.mock.callCount(), 2);
  });
});

test('public membership UI and senior-living page lead to a genuine private review workflow', () => {
  const club = src('src/ClubView.jsx');
  const form = src('src/ClubApplyForm.jsx');
  const senior = src('src/SeniorLivingView.jsx');
  const migration = src('supabase/migrations/20261122060000_pearl_club_boracay_web_applications.sql');
  assert.match(club, /<ClubApplyForm\s*\/>/);
  assert.match(form, /operation=apply/);
  assert.match(form, /operation=application-status/);
  assert.match(form, /consent_recorded/);
  assert.match(form, /age_declared_60plus/);
  assert.match(form, /reviewRequired|review/);
  assert.match(senior, /href="\/club#club-application"/);
  assert.match(migration, /consent_source in \('staff_recorded', 'applicant_web'\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public.plp_club_members from anon, authenticated/);
  assert.doesNotMatch(migration, /status = 'OPEN'/); // Explicit post-release owner-authorized go-live gate.
  const app = src('src/App.jsx');
  assert.match(app, /view === 'club' \|\| view === 'senior-living'/);
  assert.match(app, /Apply to Pearl Club/);
});
