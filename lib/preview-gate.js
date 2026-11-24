// Private-preview gate helpers. This module is Edge-safe: Web Crypto only, no
// Node crypto or Node fs. Used by Vercel Edge Middleware and by serverless
// handlers. Preview cookies never grant staff or owner access.

export const PREVIEW_COOKIE = '__Host-plp_preview';
export const STAFF_COOKIE = '__Host-plp_staff';
export const OWNER_COOKIE = '__Host-plp_owner';
export const PREVIEW_TTL_SECONDS = 7 * 24 * 3600;
export const PRIVATE_ROBOTS = 'noindex, nofollow, noarchive';
export const PRIVATE_CACHE = 'private, no-store, max-age=0';

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i;
const HEX = /^[0-9a-f]{64}$/i;

export function siteIsPrivate(env = process.env) {
  return env.PLP_SITE_PRIVATE !== 'false';
}

export function anonymousPublicBookingsAllowed(env = process.env) {
  return env.PLP_SITE_PRIVATE === 'false' && env.PLP_PUBLIC_BOOKINGS_ENABLED === 'true';
}

export function header(req, name) {
  const key = name.toLowerCase();
  const headers = req?.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(name) || headers.get(key) || '');
  const raw = headers[key] ?? headers[name];
  if (Array.isArray(raw)) return String(raw[0] || '');
  return String(raw || '');
}

export function requestUrl(req) {
  const raw = String(req?.url || '/');
  if (/^https?:\/\//i.test(raw)) return new URL(raw);
  const host = header(req, 'host') || 'plp-boracay.vercel.app';
  return new URL(raw, `https://${host}`);
}

export function requestOriginAllowed(req, env = process.env) {
  const host = header(req, 'host').toLowerCase().split(':')[0];
  const origin = header(req, 'origin').toLowerCase();
  if (host === 'plp-boracay.vercel.app' && origin === 'https://plp-boracay.vercel.app') return true;
  const vercel = String(env.VERCEL_URL || '').replace(/^https?:\/\//i, '').toLowerCase().split(':')[0];
  if (vercel && host === vercel && origin === `https://${vercel}`) return true;
  return false;
}

export function canonicalPreviewCode(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
}

export function timingSafeEqualBytes(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const base64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  if (typeof atob === 'function') {
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

function utf8(value) {
  return new TextEncoder().encode(String(value || ''));
}

async function hmacSha256(secret, value) {
  const key = await crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8(value)));
}

export async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(value)));
  return bytesToHex(digest);
}

export function previewSigningSecret(env = process.env) {
  for (const key of ['PLP_PREVIEW_COOKIE_SECRET', 'PLP_STAFF_SESSION_SECRET', 'PLP_OWNER_SESSION_SECRET']) {
    const value = env[key];
    if (typeof value === 'string' && value.length >= 48) return value;
  }
  return '';
}

export async function previewCodeMatches(code, env = process.env) {
  const expected = String(env.PLP_PREVIEW_CODE_HASH || '').trim().toLowerCase();
  if (!HEX.test(expected)) return false;
  const canonical = canonicalPreviewCode(code);
  if (!canonical || canonical.length > 120) return false;
  const actual = await sha256Hex(canonical);
  return timingSafeEqualBytes(hexToBytes(actual), hexToBytes(expected));
}

export function previewCodeEntryEnabled(env = process.env) {
  return HEX.test(String(env.PLP_PREVIEW_CODE_HASH || '').trim().toLowerCase()) && Boolean(previewSigningSecret(env));
}

// No durable attempt limiter is used. A limiter that only lives in a serverless
// or Edge isolate is not real protection, and a new production table or paid
// KV store is out of scope. The preview code is high-entropy; guessing it is
// not practical. Rotate PLP_PREVIEW_CODE_HASH if a code is ever exposed.

export async function signTicket(payload, secret) {
  if (typeof secret !== 'string' || secret.length < 48) throw new Error('Invalid preview signing secret');
  const encoded = bytesToBase64Url(utf8(JSON.stringify(payload)));
  const mac = bytesToBase64Url(await hmacSha256(secret, encoded));
  return `${encoded}.${mac}`;
}

export async function verifyTicket(token, secret, { kind } = {}, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 700 || typeof secret !== 'string' || secret.length < 48) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  const expected = await hmacSha256(secret, parts[0]);
  const received = base64UrlToBytes(parts[1]);
  if (!timingSafeEqualBytes(expected, received)) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])));
    const time = Math.floor(now / 1000);
    if (value.v !== 1 || !Number.isInteger(value.iat) || !Number.isInteger(value.exp)) return null;
    if (value.iat > time + 60 || value.exp <= time) return null;
    if (kind === 'preview') {
      if (value.typ !== 'preview' || value.exp > value.iat + PREVIEW_TTL_SECONDS) return null;
      return value;
    }
    if (value.typ) return null;
    if (typeof value.uid !== 'string' || !UUID.test(value.uid) || value.exp > value.iat + 8 * 3600) return null;
    return value;
  } catch {
    return null;
  }
}

export async function signPreviewCookieValue(env = process.env, now = Date.now()) {
  const secret = previewSigningSecret(env);
  const iat = Math.floor(now / 1000);
  return signTicket({ v: 1, typ: 'preview', iat, exp: iat + PREVIEW_TTL_SECONDS }, secret);
}

export function previewSetCookie(token) {
  return `${PREVIEW_COOKIE}=${token}; Path=/; Max-Age=${PREVIEW_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax; Priority=High`;
}

function cookieValue(req, name) {
  const raw = header(req, 'cookie');
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) return trimmed.slice(name.length + 1);
  }
  return '';
}

export async function hasValidPreviewCookie(req, env = process.env) {
  const secret = previewSigningSecret(env);
  if (!secret) return false;
  return Boolean(await verifyTicket(cookieValue(req, PREVIEW_COOKIE), secret, { kind: 'preview' }));
}

export async function hasValidStaffOrOwnerSession(req, env = process.env) {
  const staffSecret = env.PLP_STAFF_SESSION_SECRET;
  const ownerSecret = env.PLP_OWNER_SESSION_SECRET;
  if (typeof staffSecret === 'string' && staffSecret.length >= 48) {
    if (await verifyTicket(cookieValue(req, STAFF_COOKIE), staffSecret, { kind: 'session' })) return true;
  }
  if (typeof ownerSecret === 'string' && ownerSecret.length >= 48) {
    if (await verifyTicket(cookieValue(req, OWNER_COOKIE), ownerSecret, { kind: 'session' })) return true;
  }
  return false;
}

function hasLegacyStaffHeader(req, env = process.env) {
  const configured = env.PLP_STAFF_CODE;
  const supplied = header(req, 'x-plp-staff-code');
  if (typeof configured !== 'string' || !configured || typeof supplied !== 'string' || !supplied || supplied.length > 256) return false;
  return timingSafeEqualBytes(utf8(configured), utf8(supplied)) && configured.length === supplied.length;
}

export async function isPreviewOrStaffAuthorized(req, env = process.env) {
  if (await hasValidStaffOrOwnerSession(req, env)) return true;
  if (hasLegacyStaffHeader(req, env)) return true;
  return hasValidPreviewCookie(req, env);
}

export async function publicApiAllowed(req, env = process.env) {
  if (anonymousPublicBookingsAllowed(env)) return true;
  return isPreviewOrStaffAuthorized(req, env);
}

export async function refuseUnlessAuthorized(req, res, env = process.env) {
  if (await publicApiAllowed(req, env)) return false;
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', PRIVATE_CACHE);
  res.setHeader('X-Robots-Tag', PRIVATE_ROBOTS);
  res.end(JSON.stringify({ ok: false, error: 'Private preview access required' }));
  return true;
}

export function safePreviewNextPath(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { return '/'; }
  if (decoded.includes('://') || decoded.startsWith('//') || decoded.includes('\\') || decoded.includes('..')) return '/';
  const path = raw.split('?')[0].split('#')[0];
  if (path.length > 180 || !/^\/[A-Za-z0-9/_-]*$/.test(path)) return '/';
  if (path === '/admin' || path.startsWith('/admin/') || path === '/admin.html') return '/';
  if (path === '/owner' || path.startsWith('/owner/') || path === '/owner.html') return '/';
  if (path.startsWith('/api/')) return '/';
  return path || '/';
}

const ASSET_EXACT = new Set([
  '/favicon.ico', '/favicon.svg', '/favicon-16.png', '/favicon-32.png', '/favicon-64.png',
  '/apple-touch-icon.png', '/site.webmanifest', '/og-image.svg',
  '/robots.txt', '/sitemap.xml',
  '/private-preview', '/private-preview/', '/private-preview.html',
]);

const RETIRED_TO_ADMIN = new Set([
  '/admin-ops', '/admin-ops/', '/admin-ops.html',
  '/content-ops', '/content-ops/', '/content-ops.html',
  '/availability-ops', '/availability-ops/', '/availability-ops.html',
  '/photo-library', '/photo-library/', '/photo-library.html',
  '/plp-growth-plan', '/plp-growth-plan/', '/plp-growth-plan.html',
  '/growth-plan', '/growth-plan/',
]);

function isAdminPath(path) {
  return path === '/admin' || path.startsWith('/admin/') || path === '/admin.html';
}

function isOwnerPath(path) {
  return path === '/owner' || path.startsWith('/owner/') || path === '/owner.html';
}

function isAffiliatePath(path) {
  return path === '/affiliate' || path.startsWith('/affiliate/') || path === '/affiliate.html';
}

export function isAllowlistedAuthApi(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const action = String(url.searchParams.get('action') || url.searchParams.get('route') || '').trim().toLowerCase();
  const operation = String(url.searchParams.get('operation') || '').trim().toLowerCase();
  if (path === '/api/admin') return ['auth-config', 'staff-login', 'staff-verify', 'staff-logout'].includes(action);
  if (path === '/api/plp') {
    if (action === 'preview-verify' || action === 'affiliate') return true;
    return action === 'owner' && ['login', 'session', 'verify', 'logout'].includes(operation);
  }
  return false;
}

export function isAllowlistedPublicAsset(path) {
  if (ASSET_EXACT.has(path)) return true;
  if (path.startsWith('/brand/') || path.startsWith('/assets/')) return true;
  return false;
}

// Decision used by Edge Middleware and by the route-matrix test.
// kind: 'allow' | 'redirect' | 'admin-redirect' | 'api-deny'
export async function gateDecision(req, env = process.env) {
  const privateSite = siteIsPrivate(env);
  const url = requestUrl(req);
  const path = url.pathname;
  const api = path === '/api' || path.startsWith('/api/');

  if (!privateSite) {
    return { kind: 'allow', privateSite, path, robots: null, cache: null };
  }

  const headers = { 'X-Robots-Tag': PRIVATE_ROBOTS, 'Cache-Control': PRIVATE_CACHE };

  if (RETIRED_TO_ADMIN.has(path)) return { kind: 'admin-redirect', privateSite, path, headers };
  if (isAdminPath(path) || isOwnerPath(path) || isAffiliatePath(path) || isAllowlistedPublicAsset(path) || isAllowlistedAuthApi(url)) {
    return { kind: 'allow', privateSite, path, headers };
  }
  if (await hasValidStaffOrOwnerSession(req, env) || hasLegacyStaffHeader(req, env)) {
    return { kind: 'allow', privateSite, path, headers };
  }
  if (await hasValidPreviewCookie(req, env)) {
    return { kind: 'allow', privateSite, path, headers };
  }
  if (api) return { kind: 'api-deny', privateSite, path, headers };
  const next = path + url.search;
  return { kind: 'redirect', privateSite, path, headers, next: safePreviewNextPath(next) };
}

export async function handlePreviewVerify(req, res, env = process.env) {
  const send = (status, body, cookie) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', PRIVATE_CACHE);
    res.setHeader('X-Robots-Tag', PRIVATE_ROBOTS);
    if (cookie) res.setHeader('Set-Cookie', cookie);
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'POST') return send(405, { ok: false, error: 'Method not allowed' });
  if (!requestOriginAllowed(req, env)) return send(403, { ok: false, error: 'Request origin not allowed' });
  if (!previewCodeEntryEnabled(env)) {
    return send(503, { ok: false, error: 'Code entry is not available. Use a staff or owner sign-in.' });
  }
  let body = {};
  try { body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}'); } catch { body = {}; }
  if (!(await previewCodeMatches(body.code, env))) {
    return send(401, { ok: false, error: 'That code was not accepted.' });
  }
  const token = await signPreviewCookieValue(env);
  return send(200, { ok: true, next: safePreviewNextPath(body.next) }, previewSetCookie(token));
}
