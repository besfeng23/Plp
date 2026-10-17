import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ACCESS_COOKIE = 'plp_site_access';
const STATE_COOKIE = 'plp_subscription_state';
// Short signed sessions limit stale access after cancellation. Successful
// server-side PayPal checks refresh this cookie on each page load.
const ACCESS_TTL_SECONDS = 30 * 60;
const STATE_TTL_SECONDS = 10 * 60;

function sessionSecret() {
  return process.env.PLP_SUBSCRIPTION_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function signature(payload) {
  const secret = sessionSecret();
  if (!secret) throw new Error('Subscription session signing is not configured.');
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function newSubscriptionState() {
  return randomBytes(32).toString('base64url');
}

export function readCookie(req, name) {
  const header = String(req?.headers?.cookie || '');
  for (const segment of header.split(';')) {
    const divider = segment.indexOf('=');
    if (divider < 0) continue;
    const key = segment.slice(0, divider).trim();
    if (key === name) return segment.slice(divider + 1).trim();
  }
  return '';
}

export function getStateCookie(req) {
  return readCookie(req, STATE_COOKIE);
}

export function stateCookie(value, maxAge = STATE_TTL_SECONDS) {
  return cookie(STATE_COOKIE, value, maxAge);
}

export function clearStateCookie() {
  return cookie(STATE_COOKIE, '', 0);
}

function cookie(name, value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAge))}${secure}`;
}

export function createAccessToken(subscriptionId, expiresAt = Date.now() + ACCESS_TTL_SECONDS * 1000) {
  const payload = Buffer.from(JSON.stringify({
    purpose: 'plp-site-access',
    subscriptionId: String(subscriptionId || ''),
    expiresAt: Number(expiresAt),
  })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifyAccessToken(token, now = Date.now()) {
  const [payload, providedSignature, extra] = String(token || '').split('.');
  if (!payload || !providedSignature || extra !== undefined) return null;
  try {
    const expected = signature(payload);
    const provided = Buffer.from(providedSignature);
    const wanted = Buffer.from(expected);
    if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data?.purpose !== 'plp-site-access' || !data.subscriptionId || !Number.isFinite(data.expiresAt) || data.expiresAt <= now) return null;
    return { subscriptionId: String(data.subscriptionId), expiresAt: Number(data.expiresAt) };
  } catch {
    return null;
  }
}

export function accessCookie(subscriptionId) {
  const expiresAt = Date.now() + ACCESS_TTL_SECONDS * 1000;
  const token = createAccessToken(subscriptionId, expiresAt);
  return {
    value: token,
    cookie: cookie(ACCESS_COOKIE, token, ACCESS_TTL_SECONDS),
  };
}

export function clearAccessCookie() {
  return cookie(ACCESS_COOKIE, '', 0);
}

export function getAccessSession(req) {
  return verifyAccessToken(readCookie(req, ACCESS_COOKIE));
}

export function safeReturnPath(value) {
  const candidate = String(value || '/').trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return '/';
  if (candidate.startsWith('/api/') || candidate.startsWith('/subscribe') || candidate.length > 700) return '/';
  return candidate;
}

export function setCookies(res, cookies) {
  const existing = res.getHeader?.('Set-Cookie');
  const previous = Array.isArray(existing) ? existing : (existing ? [String(existing)] : []);
  res.setHeader('Set-Cookie', [...previous, ...cookies.filter(Boolean)]);
}
