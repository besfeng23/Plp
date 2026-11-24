import { createHash, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { insertRow, selectRows, updateRows, callRpc } from '../api/_supabase.js';
import { plpSupabaseEnv } from './plp-supabase-env.js';
import { PROPOSED_AFFILIATE_RATES } from './affiliate-rates.js';
import { normalizeReferralCode } from './referral-capture.js';

export { PROPOSED_AFFILIATE_RATES };

export const AFFILIATE_COOKIE = '__Host-plp_affiliate';
const SESSION_TTL = 12 * 60 * 60;

export function affiliateCommissionsActive(env = process.env) {
  return env.PLP_AFFILIATE_COMMISSIONS_ACTIVE === 'true';
}

export function proposedRateFor(tier) {
  return PROPOSED_AFFILIATE_RATES[tier] || PROPOSED_AFFILIATE_RATES.referral;
}

export function affiliateSessionSecret(env = process.env) {
  return env.PLP_AFFILIATE_SESSION_SECRET || env.PLP_OWNER_SESSION_SECRET || env.PLP_STAFF_SESSION_SECRET || '';
}

function digest(value, key) {
  return createHmac('sha256', key).update(value).digest('base64url');
}

export function signAffiliateSession(affiliateId, key, now = Date.now()) {
  if (!/^[0-9a-f-]{36}$/i.test(affiliateId) || typeof key !== 'string' || key.length < 48) throw new Error('Invalid affiliate session');
  const payload = Buffer.from(JSON.stringify({
    v: 1, typ: 'affiliate', uid: affiliateId,
    iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + SESSION_TTL,
  })).toString('base64url');
  return payload + '.' + digest(payload, key);
}

export function verifyAffiliateSession(token, key, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 700 || typeof key !== 'string' || key.length < 48) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = Buffer.from(digest(parts[0], key));
  const received = Buffer.from(parts[1]);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const time = Math.floor(now / 1000);
    if (value.v !== 1 || value.typ !== 'affiliate' || typeof value.uid !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(value.uid) || value.exp <= time) return null;
    return value;
  } catch { return null; }
}

export function readAffiliateCookie(req, env = process.env) {
  const raw = String(req.headers?.cookie || '').split(';').find((item) => item.trim().startsWith(AFFILIATE_COOKIE + '='));
  if (!raw) return null;
  return verifyAffiliateSession(raw.trim().slice(AFFILIATE_COOKIE.length + 1), affiliateSessionSecret(env));
}

export function affiliateCookie(affiliateId, env = process.env) {
  return AFFILIATE_COOKIE + '=' + signAffiliateSession(affiliateId, affiliateSessionSecret(env)) +
    '; Path=/; Max-Age=' + SESSION_TTL + '; HttpOnly; Secure; SameSite=Lax; Priority=High';
}

export function hashInviteToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function newInviteToken() {
  return randomBytes(24).toString('base64url');
}

export async function findAffiliateByCode(code) {
  const referralCode = normalizeReferralCode(code);
  if (!referralCode) return null;
  const rows = await selectRows('plp_affiliates', 'referral_code=eq.' + encodeURIComponent(referralCode) + '&status=eq.active&select=id,name,referral_code,tier,rate,rate_approval_status,manager_affiliate_id,override_rate&limit=1');
  return rows?.[0] || null;
}

export async function attachReferral({ table, id, referralCode, actor = 'guest', previousAudit = [] }) {
  const code = normalizeReferralCode(referralCode);
  const partner = code ? await findAffiliateByCode(code) : null;
  const audit = Array.isArray(previousAudit) ? previousAudit.slice(-20) : [];
  audit.push({ at: new Date().toISOString(), actor, referral_code: code || null, affiliate_id: partner?.id || null });
  const patch = { referral_code: code || null, affiliate_id: partner?.id || null };
  if (table === 'plp_concierge_enquiries') patch.referral_audit = audit;
  const rows = await updateRows(table, 'id=eq.' + id + '&select=id,referral_code,affiliate_id,referral_audit', patch);
  return { ok: Boolean(rows?.[0]), row: rows?.[0] || null, partner, code };
}

export async function handleAffiliateAdmin(method, input = {}, actor = '') {
  if (method === 'GET' && (input.view || 'partners') === 'payouts') {
    const rows = await selectRows('plp_payouts', 'select=id,affiliate_id,amount,currency,payout_reference,status,recorded_by,created_at&order=created_at.desc&limit=100');
    const partners = await selectRows('plp_affiliates', 'select=id,name,referral_code,status&order=name.asc&limit=200');
    return [200, { ok: true, rows: rows || [], partners: partners || [], commissionsActive: affiliateCommissionsActive() }];
  }
  if (method === 'GET') {
    const partners = await selectRows('plp_affiliates', 'select=id,name,email,referral_code,tier,rate,rate_approval_status,manager_affiliate_id,override_rate,status,created_at&order=created_at.desc&limit=200');
    const invites = await selectRows('plp_affiliate_invites', 'select=id,email,name,tier,expires_at,accepted_at,created_at&order=created_at.desc&limit=100');
    return [200, { ok: true, partners: partners || [], invites: invites || [], rates: PROPOSED_AFFILIATE_RATES, commissionsActive: affiliateCommissionsActive() }];
  }
  if (method === 'POST' && input.action === 'invite') {
    const email = String(input.email || '').trim().toLowerCase();
    const name = String(input.name || '').trim().slice(0, 120);
    const tier = Object.hasOwn(PROPOSED_AFFILIATE_RATES, input.tier) && input.tier !== 'manager_override' ? input.tier : 'referral';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) return [400, { ok: false, error: 'Add the partner name and email.' }];
    const token = newInviteToken();
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const saved = await insertRow('plp_affiliate_invites', {
      email, name, tier, token_hash: hashInviteToken(token), invited_by: actor || null, expires_at: expires,
    });
    if (!saved) return [503, { ok: false, error: 'The invitation could not be saved.' }];
    return [200, { ok: true, invite: { id: saved.id, email, expires_at: expires, path: '/affiliate?invite=' + token } }];
  }
  if (method === 'POST' && input.action === 'payout') {
    const amount = Number(input.amount);
    if (!input.affiliate_id || !Number.isFinite(amount) || amount < 0) return [400, { ok: false, error: 'Choose a partner and a payout amount.' }];
    const saved = await insertRow('plp_payouts', {
      affiliate_id: input.affiliate_id,
      amount,
      currency: String(input.currency || 'USD').slice(0, 8),
      payout_reference: String(input.payout_reference || '').slice(0, 180) || null,
      notes: String(input.notes || '').slice(0, 500) || null,
      recorded_by: actor || null,
      status: 'recorded',
    });
    return saved ? [200, { ok: true, payout: saved }] : [503, { ok: false, error: 'The payout record could not be saved.' }];
  }
  if (method === 'PATCH' && input.id && input.status) {
    if (!['pending', 'active', 'paused', 'declined'].includes(input.status)) return [400, { ok: false, error: 'Choose a valid partner status.' }];
    const rows = await updateRows('plp_affiliates', 'id=eq.' + input.id + '&select=id,status', { status: input.status, updated_at: new Date().toISOString() });
    if (!rows?.length) return [409, { ok: false, error: 'That partner could not be updated.' }];
    return [200, { ok: true, partner: rows[0] }];
  }
  return [405, { ok: false, error: 'Method not allowed' }];
}

// Public enrollment uses verified email ownership, not an invitation or staff approval.
export function affiliatePublicEnrollment(env = process.env) {
  return env.PLP_AFFILIATE_PUBLIC_ENROLLMENT !== 'false';
}

function validEnrollmentEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 180 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

async function authRequest(path, body, token) {
  const env = plpSupabaseEnv(process.env);
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const response = await fetch(url + '/auth/v1/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: key, Authorization: 'Bearer ' + (token || key), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

async function enrollmentAllowed(req, email, action) {
  // Separate durable rate-limit buckets from the owner gate. Fail closed.
  const ip = String(req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || 'unknown').split(',')[0].trim();
  for (const key of ['ip:' + ip, 'email:' + email]) {
    const hashed = createHash('sha256').update('affiliate:' + action + ':' + key).digest('hex');
    if (await callRpc('plp_reserve_preview_attempt', { p_ip_hash: hashed }) !== true) return false;
  }
  return true;
}

async function handlePublicEnrollment(req, input) {
  if (req.method !== 'POST') return [405, { ok: false, error: 'Method not allowed.' }, null];
  if (!affiliatePublicEnrollment()) return [403, { ok: false, error: 'Public enrollment is currently closed.' }, null];
  // Do not create an account unless the session can actually be issued.
  if (affiliateSessionSecret().length < 48) return [503, { ok: false, error: 'Partner access is temporarily unavailable.' }, null];
  const email = validEnrollmentEmail(input.email);
  if (!email) return [400, { ok: false, error: 'Enter a valid email address.' }, null];
  const action = input.action;
  if (action === 'enroll-verify' && !/^\d{6,8}$/.test(String(input.code || ''))) {
    return [400, { ok: false, error: 'Enter the verification code from your email.' }, null];
  }
  if (!await enrollmentAllowed(req, email, action)) return [429, { ok: false, error: 'Too many attempts. Try again later.' }, null];
  if (action === 'enroll-start') {
    const sent = await authRequest('otp', { email, create_user: true });
    return sent
      ? [200, { ok: true, message: 'Check your email for your verification code.' }, null]
      : [503, { ok: false, error: 'Email verification is temporarily unavailable. You can still explore the demo.' }, null];
  }
  const verified = await authRequest('verify', { email, token: String(input.code), type: 'email' });
  const user = verified?.access_token ? await authRequest('user', null, verified.access_token) : null;
  if (!user?.id || !user.email_confirmed_at || validEnrollmentEmail(user.email) !== email || user.banned_until && Date.parse(user.banned_until) > Date.now()) {
    return [401, { ok: false, error: 'The verification code is invalid or expired.' }, null];
  }
  let partner = (await selectRows('plp_affiliates', 'email=eq.' + encodeURIComponent(email) + '&select=*&limit=1'))?.[0];
  if (partner && ['paused', 'declined'].includes(partner.status)) return [403, { ok: false, error: 'This partner account is not active. Contact PLP sales.' }, null];
  if (!partner) {
    const name = String(input.name || '').trim().slice(0, 120) || email.split('@')[0].slice(0, 120);
    const tier = ['travel_agent', 'influencer', 'referral'].includes(input.tier) ? input.tier : 'referral';
    const proposed = proposedRateFor(tier);
    const referralCode = 'plp-' + randomBytes(10).toString('hex');
    try {
      partner = await insertRow('plp_affiliates', { name, email, referral_code: referralCode, tier, rate: proposed.rate, rate_approval_status: 'pending_owner_approval', override_rate: 0, status: 'active' });
    } catch {
      // Unique email protects concurrent registration; only the verified email can recover the record.
      partner = (await selectRows('plp_affiliates', 'email=eq.' + encodeURIComponent(email) + '&select=*&limit=1'))?.[0];
    }
  }
  if (partner?.status === 'pending') {
    partner = (await updateRows('plp_affiliates', 'id=eq.' + partner.id + '&status=eq.pending&select=*', { status: 'active', updated_at: new Date().toISOString() }))?.[0];
  }
  if (!partner?.id || partner.status !== 'active') return [403, { ok: false, error: 'Partner activation is unavailable.' }, null];
  return [200, { ok: true, partner: publicPartner(partner), commissionsActive: affiliateCommissionsActive() }, affiliateCookie(partner.id)];
}

export async function handleAffiliatePortal(req, input = {}) {
  if (['enroll-start', 'enroll-verify'].includes(input.action)) return handlePublicEnrollment(req, input);
  if (input.action === 'logout' && req.method === 'POST') return [200, { ok: true }, AFFILIATE_COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'];
  if (input.action === 'accept') {
    if (req.method !== 'POST') return [405, { ok: false, error: 'Method not allowed.' }, null];
    const token = String(input.invite || input.token || '');
    if (!token) return [400, { ok: false, error: 'This invitation link is incomplete.' }, null];
    const rows = await selectRows('plp_affiliate_invites', 'token_hash=eq.' + hashInviteToken(token) + '&select=*&limit=1');
    const invite = rows?.[0];
    if (!invite || invite.accepted_at || new Date(invite.expires_at).getTime() <= Date.now()) {
      return [400, { ok: false, error: 'This invitation is not valid or has already been used.' }, null];
    }
    const proposed = proposedRateFor(invite.tier);
    const baseCode = normalizeReferralCode((invite.name || invite.email).split('@')[0].replace(/[^a-z0-9]+/gi, '-')) || 'partner';
    let referralCode = baseCode.slice(0, 28);
    for (let i = 0; i < 5; i += 1) {
      const existing = await selectRows('plp_affiliates', 'referral_code=eq.' + referralCode + '&select=id&limit=1');
      if (!existing?.length) break;
      referralCode = (baseCode.slice(0, 24) + '-' + randomBytes(2).toString('hex')).slice(0, 32);
    }
    const partner = await insertRow('plp_affiliates', {
      name: invite.name || invite.email,
      email: invite.email,
      referral_code: referralCode,
      tier: invite.tier,
      rate: proposed.rate,
      rate_approval_status: proposed.approval,
      override_rate: 0,
      status: 'pending',
    });
    if (!partner?.id) return [503, { ok: false, error: 'The partner record could not be created.' }, null];
    await updateRows('plp_affiliate_invites', 'id=eq.' + invite.id, { accepted_at: new Date().toISOString(), affiliate_id: partner.id });
    return [200, { ok: true, partner: publicPartner(partner), commissionsActive: affiliateCommissionsActive() }, affiliateCookie(partner.id)];
  }

  const session = readAffiliateCookie(req);
  if (!session) return [401, { ok: false, error: 'Sign in or create your partner account.' }, null];
  const partners = await selectRows('plp_affiliates', 'id=eq.' + session.uid + '&select=id,name,email,referral_code,tier,rate,rate_approval_status,status&limit=1');
  const partner = partners?.[0];
  if (!partner || ['paused', 'declined'].includes(partner.status)) return [401, { ok: false, error: 'This partner session is no longer valid.' }, null];
  const referrals = await selectRows('plp_bookings', 'affiliate_id=eq.' + partner.id + '&select=booking_reference,status,check_in,check_out,currency,created_at&order=created_at.desc&limit=50');
  const payouts = await selectRows('plp_payouts', 'affiliate_id=eq.' + partner.id + '&select=amount,currency,payout_reference,status,created_at&order=created_at.desc&limit=50');
  const commissions = affiliateCommissionsActive()
    ? await selectRows('plp_commissions', 'affiliate_id=eq.' + partner.id + '&select=commission_type,commission_amount,currency,status,created_at&order=created_at.desc&limit=50')
    : [];
  return [200, {
    ok: true,
    partner: publicPartner(partner),
    link: '/?ref=' + partner.referral_code,
    referrals: (referrals || []).map((row) => ({ reference: row.booking_reference, status: row.status, check_in: row.check_in, check_out: row.check_out, currency: row.currency, created_at: row.created_at })),
    payouts: payouts || [],
    commissions: commissions || [],
    commissionsActive: affiliateCommissionsActive(),
  }, null];
}

function publicPartner(partner) {
  return {
    name: partner.name,
    referral_code: partner.referral_code,
    tier: partner.tier,
    rate: partner.rate,
    rate_approval_status: partner.rate_approval_status,
    status: partner.status,
  };
}
