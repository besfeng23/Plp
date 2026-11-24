import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sha256Hex, canonicalPreviewCode, PREVIEW_COOKIE, OWNER_COOKIE, STAFF_COOKIE } from '../lib/preview-gate.js';
import { handlePreviewVerify } from '../lib/preview-verify-handler.js';
import {
  ownerGodCodeConfigured, ownerGodCodeMatches, createMemoryGateStore,
  isLockedOut, recordFailedAttempt, ATTEMPT_LIMIT, hashIp,
} from '../lib/owner-god-code.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const SECRET = 'g'.repeat(64);
const UID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OWNER_EMAIL = 'owner@example.test';
const FIXTURE_CODE = 'unit-test-god-code-4400';
const PREVIEW_FIXTURE = 'unit-test-preview-code-9182';

function req({ path = '/api/plp?action=preview-verify', method = 'POST', cookie = '', host = 'plp-boracay.vercel.app', origin, headers = {}, body } = {}) {
  const resolvedOrigin = origin === undefined && method !== 'GET' ? `https://${host}` : origin || '';
  return { method, url: `https://${host}${path}`, headers: { host, origin: resolvedOrigin, cookie, ...headers }, body };
}
function res() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    end(s) { this.body = typeof s === 'string' ? JSON.parse(s) : s; },
  };
}
async function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const saved = {};
  for (const key of keys) saved[key] = Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined;
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function cookiesOf(response) {
  return [].concat(response.headers['Set-Cookie'] || []).join('\n');
}

const ownerEnv = {
  PLP_STAFF_SESSION_SECRET: SECRET,
  PLP_OWNER_SESSION_SECRET: SECRET,
  PLP_OWNER_EMAIL: OWNER_EMAIL,
};

test('god-code path fails closed when the hash env is unset, and leaves the preview path unchanged', async () => {
  const previewHash = await sha256Hex(canonicalPreviewCode(PREVIEW_FIXTURE));
  assert.equal(ownerGodCodeConfigured({}), false);
  assert.equal(await ownerGodCodeMatches(FIXTURE_CODE, {}), false);
  const store = createMemoryGateStore();
  await withEnv({ ...ownerEnv, PLP_OWNER_GOD_CODE_HASH: undefined, PLP_PREVIEW_CODE_HASH: undefined, PLP_PREVIEW_COOKIE_SECRET: SECRET }, async () => {
    const r = res();
    await handlePreviewVerify(req({ body: { code: FIXTURE_CODE } }), r, process.env, { attemptStore: store });
    assert.equal(r.statusCode, 503);
    assert.doesNotMatch(JSON.stringify(r.body), new RegExp(FIXTURE_CODE));
    assert.equal(cookiesOf(r), '');
  });
  await withEnv({ ...ownerEnv, PLP_OWNER_GOD_CODE_HASH: undefined, PLP_PREVIEW_CODE_HASH: previewHash, PLP_PREVIEW_COOKIE_SECRET: SECRET }, async () => {
    const r = res();
    await handlePreviewVerify(req({ body: { code: PREVIEW_FIXTURE, next: '/booking' } }), r, process.env, { attemptStore: store });
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.next, '/booking');
    const cookie = cookiesOf(r);
    assert.match(cookie, new RegExp(PREVIEW_COOKIE + '='));
    assert.doesNotMatch(cookie, new RegExp(OWNER_COOKIE + '='));
    assert.doesNotMatch(cookie, new RegExp(STAFF_COOKIE + '='));
  });
});

test('a matching god-code hash issues owner and staff sessions, not a preview cookie', async () => {
  const hash = await sha256Hex(canonicalPreviewCode(FIXTURE_CODE));
  const previewHash = await sha256Hex(canonicalPreviewCode(PREVIEW_FIXTURE));
  const store = createMemoryGateStore();
  const lookupOwnerUser = async () => ({ id: UID, email: OWNER_EMAIL });
  await withEnv({
    ...ownerEnv,
    PLP_OWNER_GOD_CODE_HASH: hash,
    PLP_PREVIEW_CODE_HASH: previewHash,
    PLP_PREVIEW_COOKIE_SECRET: SECRET,
  }, async () => {
    assert.equal(ownerGodCodeConfigured(process.env), true);
    assert.equal(await ownerGodCodeMatches(FIXTURE_CODE, process.env), true);
    assert.equal(await ownerGodCodeMatches('not-the-god-code', process.env), false);
    const r = res();
    await handlePreviewVerify(req({ body: { code: FIXTURE_CODE, next: '/owner' } }), r, process.env, { attemptStore: store, lookupOwnerUser });
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.next, '/owner');
    const cookie = cookiesOf(r);
    assert.match(cookie, new RegExp(OWNER_COOKIE + '='));
    assert.match(cookie, new RegExp(STAFF_COOKIE + '='));
    assert.doesNotMatch(cookie, new RegExp(PREVIEW_COOKIE + '='));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    const payload = JSON.stringify(r.body) + cookie + JSON.stringify(store.rows);
    assert.doesNotMatch(payload, new RegExp(FIXTURE_CODE));
    assert.equal(store.rows.some((row) => row.kind === 'owner_god_signin'), true);
    assert.equal(store.rows.every((row) => !('code' in row) && !('hash' in row)), true);

    const preview = res();
    await handlePreviewVerify(req({ body: { code: PREVIEW_FIXTURE } }), preview, process.env, { attemptStore: store, lookupOwnerUser });
    assert.equal(preview.statusCode, 200);
    const previewCookie = cookiesOf(preview);
    assert.match(previewCookie, new RegExp(PREVIEW_COOKIE + '='));
    assert.doesNotMatch(previewCookie, new RegExp(OWNER_COOKIE + '='));
  });
});

test('failed attempts are rate-limited per IP and the lockout does not include the code', async () => {
  const hash = await sha256Hex(canonicalPreviewCode(FIXTURE_CODE));
  const store = createMemoryGateStore();
  const ip = '203.0.113.9';
  await withEnv({ ...ownerEnv, PLP_OWNER_GOD_CODE_HASH: hash, PLP_PREVIEW_CODE_HASH: undefined, PLP_PREVIEW_COOKIE_SECRET: SECRET }, async () => {
    for (let i = 0; i < ATTEMPT_LIMIT; i += 1) {
      const r = res();
      await handlePreviewVerify(req({ body: { code: 'wrong' }, headers: { 'x-forwarded-for': ip } }), r, process.env, { attemptStore: store });
      assert.equal(r.statusCode, 401);
    }
    const locked = res();
    await handlePreviewVerify(req({ body: { code: 'wrong' }, headers: { 'x-forwarded-for': ip } }), locked, process.env, { attemptStore: store });
    assert.equal(locked.statusCode, 429);
    assert.doesNotMatch(JSON.stringify(locked.body), /wrong|unit-test-god-code/);
    const other = res();
    await handlePreviewVerify(req({ body: { code: 'wrong' }, headers: { 'x-forwarded-for': '198.51.100.2' } }), other, process.env, { attemptStore: store });
    assert.equal(other.statusCode, 401);
  });
});

test('god sign-in fails closed if the owner session cannot be issued', async () => {
  const hash = await sha256Hex(canonicalPreviewCode(FIXTURE_CODE));
  const store = createMemoryGateStore();
  await withEnv({ ...ownerEnv, PLP_OWNER_GOD_CODE_HASH: hash, PLP_OWNER_SESSION_SECRET: undefined }, async () => {
    const r = res();
    await handlePreviewVerify(req({ body: { code: FIXTURE_CODE } }), r, process.env, {
      attemptStore: store,
      lookupOwnerUser: async () => ({ id: UID, email: OWNER_EMAIL }),
    });
    assert.equal(r.statusCode, 503);
    assert.equal(cookiesOf(r), '');
  });
  await withEnv({ ...ownerEnv, PLP_OWNER_GOD_CODE_HASH: hash }, async () => {
    const r = res();
    await handlePreviewVerify(req({ body: { code: FIXTURE_CODE } }), r, process.env, {
      attemptStore: store,
      lookupOwnerUser: async () => null,
    });
    assert.equal(r.statusCode, 503);
  });
});

test('committed sources keep the god-code helper and migration, and do not use Node crypto in Edge middleware', () => {
  assert.match(read('lib/owner-god-code.js'), /PLP_OWNER_GOD_CODE_HASH/);
  assert.match(read('lib/owner-god-code.js'), /timingSafeEqualBytes/);
  assert.match(read('lib/preview-verify-handler.js'), /issueOwnerGodSession/);
  assert.match(read('api/plp.js'), /preview-verify-handler/);
  assert.match(read('supabase/migrations/20261124160000_plp_preview_gate_events.sql'), /plp_preview_gate_events/);
  assert.doesNotMatch(read('lib/preview-gate.js'), /node:crypto|createHmac|handlePreviewVerify/);
  assert.doesNotMatch(read('middleware.js'), /node:crypto|createHmac|PLP_OWNER_GOD_CODE_HASH/);
});
