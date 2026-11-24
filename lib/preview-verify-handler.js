// Node-only preview-code verification. Kept out of Edge middleware so this
// file may use owner/staff session helpers and a durable attempt store.

import {
  previewCodeEntryEnabled, previewCodeMatches, signPreviewCookieValue, previewSetCookie,
  requestOriginAllowed, safePreviewNextPath, PRIVATE_CACHE, PRIVATE_ROBOTS,
} from './preview-gate.js';
import {
  ownerGodCodeConfigured, ownerGodCodeMatches, clientIp, hashIp,
  createSupabaseGateStore, isLockedOut, recordFailedAttempt, recordGodSignInAudit,
  logGodSignInSuccess, issueOwnerGodSession,
} from './owner-god-code.js';

async function productionStore() {
  try {
    const db = await import('../api/_supabase.js');
    if (!db.isSupabaseConfigured()) return null;
    return createSupabaseGateStore(db);
  } catch {
    return null;
  }
}

export async function handlePreviewVerify(req, res, env = process.env, deps = {}) {
  const send = (status, body, cookies) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', PRIVATE_CACHE);
    res.setHeader('X-Robots-Tag', PRIVATE_ROBOTS);
    if (cookies) res.setHeader('Set-Cookie', Array.isArray(cookies) ? cookies : [cookies]);
    res.end(JSON.stringify(body));
  };

  if (req.method !== 'POST') return send(405, { ok: false, error: 'Method not allowed' });
  if (!requestOriginAllowed(req, env)) return send(403, { ok: false, error: 'Request origin not allowed' });

  const godConfigured = ownerGodCodeConfigured(env);
  const previewEnabled = previewCodeEntryEnabled(env);
  if (!godConfigured && !previewEnabled) {
    return send(503, { ok: false, error: 'Code entry is not available. Use a staff or owner sign-in.' });
  }

  let body = {};
  try { body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}'); } catch { body = {}; }

  const store = deps.attemptStore !== undefined ? deps.attemptStore : await productionStore();
  const ipHash = await hashIp(clientIp(req));
  // Atomically reserve an attempt before comparing either code (per-IP and global).
  // The fallback exists for injected legacy unit-test stores only.
  let locked;
  let reserved = false;
  try {
    if (store?.reserve) { reserved = await store.reserve(ipHash); locked = !reserved; }
    else locked = await isLockedOut(store, ipHash);
  } catch { locked = 'unavailable'; }

  if (locked === true) {
    return send(429, { ok: false, error: 'Please retry later.' });
  }

  const godMatch = godConfigured ? await ownerGodCodeMatches(body.code, env) : false;
  if (godMatch) {
    if (locked === 'unavailable' && deps.allowGodWithoutStore !== true) {
      return send(503, { ok: false, error: 'Owner sign-in is temporarily unavailable.' });
    }
    const issued = await issueOwnerGodSession(env, deps);
    if (!issued.ok) return send(503, { ok: false, error: 'Owner sign-in is temporarily unavailable.' });
    try { await recordGodSignInAudit(store, ipHash); } catch { return send(503, { ok: false, error: 'Owner sign-in is temporarily unavailable.' }); }
    logGodSignInSuccess();
    return send(200, { ok: true, next: safePreviewNextPath(body.next, { allowStaffPortals: true }) }, issued.cookies);
  }

  if (previewEnabled && await previewCodeMatches(body.code, env)) {
    const token = await signPreviewCookieValue(env);
    return send(200, { ok: true, next: safePreviewNextPath(body.next) }, previewSetCookie(token));
  }

  if (store && locked !== 'unavailable' && !reserved) {
    try { await recordFailedAttempt(store, ipHash); } catch { /* ordinary preview path still returns 401 */ }
  }
  return send(401, { ok: false, error: 'That code was not accepted.' });
}

