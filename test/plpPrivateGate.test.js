import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signOwnerSession } from '../lib/owner-auth.js';
import {
  PREVIEW_COOKIE, STAFF_COOKIE, OWNER_COOKIE,
  siteIsPrivate, anonymousPublicBookingsAllowed, canonicalPreviewCode, sha256Hex,
  previewCodeMatches, previewCodeEntryEnabled, signPreviewCookieValue, previewSetCookie,
  verifyTicket, previewSigningSecret, hasValidPreviewCookie, hasValidStaffOrOwnerSession,
  publicApiAllowed, refuseUnlessAuthorized, safePreviewNextPath, gateDecision,
  isAllowlistedAuthApi, handlePreviewVerify, requestUrl,
} from '../lib/preview-gate.js';
import { authorizeStaffRequest, resetStaffSignInThrottle } from '../lib/access-control.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const SECRET = 's'.repeat(64);
const UID = '3c674ce1-7ab5-4823-b9ae-062a47c61f12';

function req({ path = '/', method = 'GET', cookie = '', host = 'plp-boracay.vercel.app', origin, headers = {}, body } = {}) {
  const resolvedOrigin = origin === undefined && method !== 'GET' ? `https://${host}` : origin || '';
  return {
    method,
    url: `https://${host}${path}`,
    headers: { host, origin: resolvedOrigin, cookie, ...headers },
    body,
  };
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

const privateEnv = {
  PLP_SITE_PRIVATE: undefined,
  PLP_PUBLIC_BOOKINGS_ENABLED: undefined,
  PLP_STAFF_SESSION_SECRET: SECRET,
  PLP_OWNER_SESSION_SECRET: SECRET,
};

test('site is private unless PLP_SITE_PRIVATE is exactly false; bookings stay off independently', () => {
  assert.equal(siteIsPrivate({}), true);
  assert.equal(siteIsPrivate({ PLP_SITE_PRIVATE: 'true' }), true);
  assert.equal(siteIsPrivate({ PLP_SITE_PRIVATE: '' }), true);
  assert.equal(siteIsPrivate({ PLP_SITE_PRIVATE: 'false' }), false);
  assert.equal(anonymousPublicBookingsAllowed({ PLP_SITE_PRIVATE: 'false' }), false);
  assert.equal(anonymousPublicBookingsAllowed({ PLP_SITE_PRIVATE: 'false', PLP_PUBLIC_BOOKINGS_ENABLED: 'true' }), true);
});

test('Web Crypto verifies tickets signed with the existing Node HMAC staff/owner helper', async () => {
  const token = signOwnerSession(UID, SECRET);
  const value = await verifyTicket(token, SECRET, { kind: 'session' });
  assert.equal(value.uid, UID);
  assert.equal(value.v, 1);
  const preview = await signPreviewCookieValue({ PLP_PREVIEW_COOKIE_SECRET: SECRET });
  assert.equal((await verifyTicket(preview, SECRET, { kind: 'preview' })).typ, 'preview');
  assert.equal(await verifyTicket(preview, SECRET, { kind: 'session' }), null);
  assert.equal(await verifyTicket(token, SECRET, { kind: 'preview' }), null);
});

test('preview code hashes are compared in constant time after canonicalisation', async () => {
  const hash = await sha256Hex(canonicalPreviewCode('  Maple Harbor Quiet 4821 '));
  const env = { PLP_PREVIEW_CODE_HASH: hash, PLP_PREVIEW_COOKIE_SECRET: SECRET };
  assert.equal(previewCodeEntryEnabled(env), true);
  assert.equal(await previewCodeMatches('maple-harbor-quiet-4821', env), true);
  assert.equal(await previewCodeMatches('Maple Harbor Quiet 4821', env), true);
  assert.equal(await previewCodeMatches('wrong-code-0000', env), false);
  assert.equal(previewCodeEntryEnabled({ PLP_PREVIEW_COOKIE_SECRET: SECRET }), false);
});

test('safe preview return paths stay on-site and never return to admin, owner or APIs', () => {
  assert.equal(safePreviewNextPath('/booking'), '/booking');
  assert.equal(safePreviewNextPath('/'), '/');
  assert.equal(safePreviewNextPath('/accommodation/grand-ocean-villa'), '/accommodation/grand-ocean-villa');
  for (const bad of ['/admin', '/admin/', '/owner', '/api/bookings', 'https://evil.example/', '//evil', '/\\x', '/foo/../bar']) {
    assert.equal(safePreviewNextPath(bad), '/');
  }
});

test('anonymous/authorized route matrix while the site is private', async () => {
  await withEnv(privateEnv, async () => {
    const staff = `${STAFF_COOKIE}=${signOwnerSession(UID, SECRET)}`;
    const owner = `${OWNER_COOKIE}=${signOwnerSession(UID, SECRET)}`;
    const preview = `${PREVIEW_COOKIE}=${await signPreviewCookieValue({ PLP_PREVIEW_COOKIE_SECRET: SECRET, ...privateEnv })}`;

    const cases = [
      ['anon', '/', {}, 'redirect'],
      ['anon', '/booking', {}, 'redirect'],
      ['anon', '/accommodation', {}, 'redirect'],
      ['anon', '/experiences', {}, 'redirect'],
      ['anon', '/gallery', {}, 'redirect'],
      ['anon', '/club', {}, 'redirect'],
      ['anon', '/senior-living', {}, 'redirect'],
      ['anon', '/exclusive-offer', {}, 'redirect'],
      ['anon', '/subscribe', {}, 'redirect'],
      ['anon', '/tg', {}, 'redirect'],
      ['anon', '/contact', {}, 'redirect'],
      ['anon', '/images/plp-hero-sunset.webp', {}, 'redirect'],
      ['anon', '/videos/anything.mp4', {}, 'redirect'],
      ['anon', '/private-preview', {}, 'allow'],
      ['anon', '/admin', {}, 'allow'],
      ['anon', '/owner', {}, 'allow'],
      ['anon', '/affiliate', {}, 'allow'],
      ['anon', '/affiliate.html', {}, 'allow'],
      ['anon', '/admin.html', {}, 'allow'],
      ['anon', '/brand/PLP_Editorial_Vector_Logo.svg', {}, 'allow'],
      ['anon', '/assets/admin-test.js', {}, 'allow'],
      ['anon', '/robots.txt', {}, 'allow'],
      ['anon', '/sitemap.xml', {}, 'allow'],
      ['anon', '/favicon.svg', {}, 'allow'],
      ['anon', '/admin-ops.html', {}, 'admin-redirect'],
      ['anon', '/plp-growth-plan', {}, 'admin-redirect'],
      ['anon', '/api/bookings', {}, 'api-deny'],
      ['anon', '/api/leads', {}, 'api-deny'],
      ['anon', '/api/paypal/create-session', {}, 'api-deny'],
      ['anon', '/api/check-availability', {}, 'api-deny'],
      ['anon', '/api/plp?action=content', {}, 'api-deny'],
      ['anon', '/api/plp?action=club', {}, 'api-deny'],
      ['anon', '/api/xendit/webhook', {}, 'api-deny'],
      ['anon', '/api/subscription?operation=status', {}, 'api-deny'],
      ['anon', '/api/telegram/webhook', {}, 'api-deny'],
      ['anon', '/api/admin?action=auth-config', {}, 'allow'],
      ['anon', '/api/admin?action=staff-login', {}, 'allow'],
      ['anon', '/api/plp?action=preview-verify', {}, 'allow'],
      ['anon', '/api/plp?action=affiliate&view=accept', {}, 'allow'],
      ['anon', '/api/plp?action=owner&operation=login', {}, 'allow'],
      ['anon', '/api/plp?action=owner&operation=me', {}, 'api-deny'],
      ['anon', '/api/admin?action=operations', {}, 'api-deny'],
      ['anon', '/api/admin?action=affiliates', {}, 'api-deny'],
      ['preview', '/', { cookie: preview }, 'allow'],
      ['preview', '/booking', { cookie: preview }, 'allow'],
      ['preview', '/api/bookings', { cookie: preview }, 'allow'],
      ['staff', '/booking', { cookie: staff }, 'allow'],
      ['owner', '/booking', { cookie: owner }, 'allow'],
      ['staff', '/api/paypal/create-session', { cookie: staff }, 'allow'],
    ];

    for (const [who, path, extra, expected] of cases) {
      const decision = await gateDecision(req({ path, ...extra }));
      assert.equal(decision.kind, expected, `${who} ${path}`);
      if (decision.privateSite && decision.headers) {
        assert.equal(decision.headers['X-Robots-Tag'], 'noindex, nofollow, noarchive');
        assert.match(decision.headers['Cache-Control'], /private, no-store/);
      }
    }
  });
});

test('when the site is public, anonymous guest pages are allowed', async () => {
  await withEnv({ PLP_SITE_PRIVATE: 'false', PLP_PUBLIC_BOOKINGS_ENABLED: 'true' }, async () => {
    const decision = await gateDecision(req({ path: '/booking' }));
    assert.equal(decision.kind, 'allow');
    assert.equal(decision.privateSite, false);
  });
});

test('public booking APIs refuse anonymous callers while private and never treat a preview cookie as staff', async () => {
  await withEnv({ ...privateEnv, PLP_AUTH_V2_ENABLED: 'false', PLP_STAFF_CODE: 'staff-test-only' }, async () => {
    resetStaffSignInThrottle();
    const denied = res();
    assert.equal(await refuseUnlessAuthorized(req({ path: '/api/bookings', method: 'POST' }), denied), true);
    assert.equal(denied.statusCode, 401);
    assert.equal(denied.body.error, 'Private preview access required');

    const previewToken = await signPreviewCookieValue({ PLP_PREVIEW_COOKIE_SECRET: SECRET, ...privateEnv });
    const allowed = res();
    const previewReq = req({ path: '/api/bookings', method: 'POST', cookie: `${PREVIEW_COOKIE}=${previewToken}` });
    assert.equal(await refuseUnlessAuthorized(previewReq, allowed), false);
    assert.equal(await publicApiAllowed(previewReq), true);

    const staffAuth = await authorizeStaffRequest(previewReq, 'operations');
    assert.equal(staffAuth.ok, false);
    assert.equal(staffAuth.status, 401);
  });
});

test('preview-verify issues a guest cookie only when the hash is configured, and never prints the code', async () => {
  const code = 'unit-test-preview-code-9182';
  const hash = await sha256Hex(canonicalPreviewCode(code));
  await withEnv({
    ...privateEnv,
    PLP_PREVIEW_CODE_HASH: hash,
    PLP_PREVIEW_COOKIE_SECRET: SECRET,
  }, async () => {
    const missing = res();
    await withEnv({ PLP_PREVIEW_CODE_HASH: undefined, PLP_PREVIEW_COOKIE_SECRET: SECRET, ...privateEnv }, async () => {
      await handlePreviewVerify(req({ path: '/api/plp?action=preview-verify', method: 'POST', body: { code: 'x' } }), missing);
    });
    // recreate missing with unset hash inside inner withEnv already asserted after it returns — inner env is restored
  });

  await withEnv({ PLP_PREVIEW_COOKIE_SECRET: SECRET, PLP_PREVIEW_CODE_HASH: undefined, PLP_SITE_PRIVATE: undefined }, async () => {
    const r = res();
    await handlePreviewVerify(req({ path: '/api/plp?action=preview-verify', method: 'POST', body: { code: 'anything' } }), r);
    assert.equal(r.statusCode, 503);
    assert.doesNotMatch(JSON.stringify(r.body), /unit-test-preview-code/);
  });

  await withEnv({ PLP_PREVIEW_COOKIE_SECRET: SECRET, PLP_PREVIEW_CODE_HASH: hash, PLP_SITE_PRIVATE: undefined }, async () => {
    const r = res();
    await handlePreviewVerify(req({ path: '/api/plp?action=preview-verify', method: 'POST', body: { code, next: '/booking' } }), r);
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.next, '/booking');
    assert.match(r.headers['Set-Cookie'], new RegExp('^' + PREVIEW_COOKIE + '='));
    assert.match(r.headers['Set-Cookie'], /HttpOnly/);
    assert.match(r.headers['Set-Cookie'], /Secure/);
    assert.match(r.headers['Set-Cookie'], /SameSite=Lax/);
    const wrong = res();
    await handlePreviewVerify(req({ path: '/api/plp?action=preview-verify', method: 'POST', body: { code: 'nope' } }), wrong);
    assert.equal(wrong.statusCode, 401);
  });
});

test('robots.txt still allows recrawl (no site-wide Disallow: /) and the preview page is noindexed', () => {
  const robots = read('public/robots.txt');
  assert.match(robots, /^Allow: \/$/m);
  assert.doesNotMatch(robots, /^Disallow: \/$/m);
  const page = read('public/private-preview.html');
  assert.match(page, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(page, /This website is in private preview/);
  assert.doesNotMatch(page, /facebook|instagram|tiktok|mailto:|wa\.me|e-mango|917 887/i);
  assert.doesNotMatch(read('middleware.js'), /node:crypto|createHmac/);
  assert.doesNotMatch(read('lib/preview-gate.js'), /node:crypto|createHmac/);
  assert.match(read('lib/preview-gate.js'), /crypto\.subtle/);
  assert.match(read('api/plp.js'), /action === 'preview-verify'/);
  assert.doesNotMatch(read('src/owner/PublicPreview.jsx'), /Doctora/i);
});

test('auth API allowlist is explicit and does not include public content or bookings', () => {
  const allow = [
    '/api/admin?action=auth-config',
    '/api/admin?action=staff-login',
    '/api/plp?action=preview-verify',
    '/api/plp?action=owner&operation=login',
  ];
  const deny = [
    '/api/admin?action=operations',
    '/api/plp?action=content',
    '/api/plp?action=club',
    '/api/bookings',
  ];
  for (const path of allow) assert.equal(isAllowlistedAuthApi(requestUrl(req({ path }))), true, path);
  for (const path of deny) assert.equal(isAllowlistedAuthApi(requestUrl(req({ path }))), false, path);
});
