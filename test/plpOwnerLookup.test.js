import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupOwnerUser } from '../lib/owner-god-code.js';

const EMAIL = 'owner@x.com';
const UID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const BASE = 'https://fixture.supabase.co';
const env = {
  SUPABASE_URL: BASE,
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-role',
  SUPABASE_ANON_KEY: 'fixture-anon',
  PLP_OWNER_EMAIL: EMAIL,
};
const owner = {
  id: UID,
  email: EMAIL,
  email_confirmed_at: '2026-01-01T00:00:00Z',
  is_anonymous: false,
};
const substring = { ...owner, email: EMAIL + '.evil' };

function mockFetch(...replies) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: new URL(url), options });
    assert.ok(replies.length, 'Unexpected HTTP request');
    const { ok = true, body } = replies.shift();
    return { ok, json: async () => body };
  };
  return { fetcher, calls };
}

function assertListRequest(call, page) {
  assert.equal(call.url.origin, BASE);
  assert.equal(call.url.pathname, '/auth/v1/admin/users');
  assert.deepEqual(Object.fromEntries(call.url.searchParams), {
    filter: EMAIL, page: String(page), per_page: '100',
  });
  assert.equal(call.url.searchParams.has('email'), false);
  assert.equal(call.options.cache, 'no-store');
}

test('owner lookup filters by email and validates an exact match by ID', async () => {
  const { fetcher, calls } = mockFetch(
    { body: { users: [substring, owner] } },
    { body: { user: owner } },
  );
  assert.deepEqual(await lookupOwnerUser(env, fetcher), owner);
  assert.equal(calls.length, 2);
  assertListRequest(calls[0], 1);
  assert.equal(calls[1].url.href, BASE + '/auth/v1/admin/users/' + UID);
});

test('owner lookup rejects a substring-only email match', async () => {
  const { fetcher, calls } = mockFetch({ body: { users: [substring] } });
  assert.equal(await lookupOwnerUser(env, fetcher), null);
  assert.equal(calls.length, 1);
  assertListRequest(calls[0], 1);
});

test('owner lookup continues after a full page and stops at a short page', async () => {
  const fullPage = Array.from({ length: 100 }, (_, i) => ({
    ...substring, email: EMAIL + '.evil' + i,
  }));
  const { fetcher, calls } = mockFetch(
    { body: { users: fullPage } },
    { body: { users: [substring] } },
  );
  assert.equal(await lookupOwnerUser(env, fetcher), null);
  assert.equal(calls.length, 2);
  assertListRequest(calls[0], 1);
  assertListRequest(calls[1], 2);
});

test('owner lookup returns null on a non-OK list response', async () => {
  const { fetcher, calls } = mockFetch({
    ok: false, body: { users: [owner] },
  });
  assert.equal(await lookupOwnerUser(env, fetcher), null);
  assert.equal(calls.length, 1);
  assertListRequest(calls[0], 1);
});

test('owner lookup selects the designated owner but main still rejects multi-owner sessions', async () => {
  const { fetcher, calls } = mockFetch(
    { body: { users: [owner] } },
    { body: owner },
  );
  const multiOwnerEnv = { ...env, PLP_OWNER_EMAILS: 'other@x.com,' + EMAIL };
  // bbe099c6: validateGodOwner still resolves an empty supplied email.
  // Preserve fail-closed behavior until owner-auth.js also honors the designation.
  assert.equal(await lookupOwnerUser(multiOwnerEnv, fetcher), null);
  assert.equal(calls.length, 2);
  assertListRequest(calls[0], 1);
  assert.equal(calls[1].url.href, BASE + '/auth/v1/admin/users/' + UID);
});

test.todo('multi-owner god sign-in succeeds once validateGodOwner honors PLP_OWNER_EMAIL');

test('owner lookup rejects a designated email outside the allow-list', async () => {
  const { fetcher, calls } = mockFetch();
  const multiOwnerEnv = { ...env, PLP_OWNER_EMAILS: 'a@x.com,b@x.com' };
  assert.equal(await lookupOwnerUser(multiOwnerEnv, fetcher), null);
  assert.equal(calls.length, 0);
});
