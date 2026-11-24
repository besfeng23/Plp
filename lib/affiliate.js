import { createHash, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { insertRow, selectRows, updateRows } from '../api/_supabase.js';
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

export async function handleAffiliatePortal(req, input = {}) {
  if (input.action === 'accept') {
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
  if (!session) return [401, { ok: false, error: 'Sign in with your invitation link.' }, null];
  const partners = await selectRows('plp_affiliates', 'id=eq.' + session.uid + '&select=id,name,email,referral_code,tier,rate,rate_approval_status,status&limit=1');
  const partner = partners?.[0];
  if (!partner) return [401, { ok: false, error: 'This partner session is no longer valid.' }, null];
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
