import test from 'node:test';
import assert from 'node:assert/strict';
import clubHandler from '../lib/club-handler.js';
import plpHandler from '../api/plp.js';

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(text) { this.body = JSON.parse(text); },
  };
}

function request(method, operation, { body, code } = {}) {
  return { method, query: { operation }, body, headers: { ...(code ? { 'x-plp-staff-code': code } : {}) } };
}

async function withEnv(overrides, fn) {
  const before = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await fn();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test('public calendar is empty without database config; no anonymous PII access', async () => {
  await withEnv({ SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined, PLP_STAFF_CODE: 'staff-test-only' }, async () => {
    const publicResult = response();
    await clubHandler(request('GET', 'activities'), publicResult);
    assert.equal(publicResult.statusCode, 200);
    assert.deepEqual(publicResult.body.activities, []);

    const protectedResult = response();
    await clubHandler(request('GET', 'members'), protectedResult);
    assert.equal(protectedResult.statusCode, 403);
    assert.equal(protectedResult.body.members, undefined);
  });
});

test('club endpoint dispatches through existing PLP function without a thirteenth Vercel function', async () => {
  await withEnv({ SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    const result = response();
    await plpHandler({ method: 'GET', query: { action: 'club', operation: 'activities' }, headers: {} }, result);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.activities, []);
  });
});

test('staff consent and senior declaration are mandatory for intake', async () => {
  await withEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key', PLP_STAFF_CODE: 'staff-test-only' }, async () => {
    const result = response();
    await clubHandler(request('POST', 'members', { code: 'staff-test-only', body: { full_name: 'Example Person', email: 'person@example.test', age_declared_60plus: true } }), result);
    assert.equal(result.statusCode, 400);
    assert.match(result.body.error, /consent/i);
  });
});

test('staff intake stores pending status and restricts member data to server-only Supabase', async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, options) => {
    seen.push({ url, options });
    return { ok: true, text: async () => JSON.stringify([{ id: 'id', status: 'PENDING' }]) };
  };
  try {
    await withEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-secret', PLP_STAFF_CODE: 'staff-test-only' }, async () => {
      const result = response();
      await clubHandler(request('POST', 'members', { code: 'staff-test-only', body: { full_name: 'Example Person', email: 'Person@Example.Test', phone: '', age_declared_60plus: true, consent_recorded: true } }), result);
      assert.equal(result.statusCode, 201);
      assert.equal(result.body.member.status, 'PENDING');
      assert.match(seen[0].url, /\/rest\/v1\/plp_club_members$/);
      assert.equal(seen[0].options.headers['Content-Profile'], 'public');
      const saved = JSON.parse(seen[0].options.body);
      assert.equal(saved.email, 'person@example.test');
      assert.equal(saved.status, 'PENDING');
      assert.equal(saved.chapter_code, 'boracay');
      assert.equal(saved.consent_source, 'staff_recorded');
    });
  } finally { globalThis.fetch = originalFetch; }
});

test('public calendar only queries future published Boracay activities', async () => {
  const originalFetch = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url) => { requested = url; return { ok: true, text: async () => '[]' }; };
  try {
    await withEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key' }, async () => {
      const result = response();
      await clubHandler(request('GET', 'activities'), result);
      assert.equal(result.statusCode, 200);
      assert.match(requested, /status=eq.PUBLISHED/);
      assert.match(requested, /chapter_code=eq.boracay/);
      assert.match(requested, /starts_at=gte./);
      assert.doesNotMatch(requested, /email|phone/);
    });
  } finally { globalThis.fetch = originalFetch; }
});

test('activity creation stays draft and validates event times', async () => {
  await withEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key', PLP_STAFF_CODE: 'staff-test-only' }, async () => {
    const result = response();
    await clubHandler(request('POST', 'admin-activities', { code: 'staff-test-only', body: { title: 'Coffee', summary: 'Conversation', category: 'connection', starts_at: '2026-12-12T12:00:00Z', ends_at: '2026-12-12T11:00:00Z' } }), result);
    assert.equal(result.statusCode, 400);
    assert.match(result.body.error, /start and end/i);
  });
});
