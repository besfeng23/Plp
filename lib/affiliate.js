import { createHash, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { insertRow, selectRows, updateRows, callRpc } from '../api/_supabase.js';
import { plpSupabaseEnv } from './plp-supabase-env.js';
import { PROPOSED_AFFILIATE_RATES } from './affiliate-rates.js';
import { normalizeReferralCode } from './referral-capture.js';
import { reviewCommission, reviewSettlement } from './affiliate-financial-review.js';

export { PROPOSED_AFFILIATE_RATES };

export const AFFILIATE_COOKIE = '__Host-plp_affiliate';
const SESSION_TTL = 12 * 60 * 60;
const ENROLL_COOKIE = '__Host-plp_affiliate_enroll';
const ENROLL_TTL = 15 * 60;
const AFFILIATE_REDIRECT = 'https://plp-boracay.vercel.app/affiliate';

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
    v: 2, typ: 'affiliate', uid: affiliateId,
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
    if (value.v !== 2 || value.typ !== 'affiliate' || typeof value.uid !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(value.uid) || !Number.isInteger(value.iat) || !Number.isInteger(value.exp) ||
        value.iat > time + 60 || value.exp <= time || value.exp > value.iat + SESSION_TTL) return null;
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
  if (!['plp_bookings', 'plp_concierge_enquiries'].includes(table) || !/^[0-9a-f-]{36}$/i.test(String(id))) throw new Error('Invalid referral target');
  const code = normalizeReferralCode(referralCode);
  const partner = code ? await findAffiliateByCode(code) : null;
  const audit = Array.isArray(previousAudit) ? previousAudit.slice(-20) : [];
  audit.push({ at: new Date().toISOString(), actor, referral_code: code || null, affiliate_id: partner?.id || null });
  const patch = { referral_code: code || null, affiliate_id: partner?.id || null };
  if (table === 'plp_concierge_enquiries') patch.referral_audit = audit;
  const fields = table === 'plp_concierge_enquiries' ? 'id,referral_code,affiliate_id,referral_audit' : 'id,referral_code,affiliate_id';
  const rows = await updateRows(table, 'id=eq.' + id + '&select=' + fields, patch);
  return { ok: Boolean(rows?.[0]), row: rows?.[0] || null, partner, code };
}

export async function handleAffiliateAdmin(method, input = {}, actor = '') {
  if(method==='GET'&&input.view==='financial-review'){
    if(!actor)return [403,{ok:false,error:'Individual owner verification required.'}];
    const [bookings,partners,commissions]=await Promise.all([
      selectRows('plp_bookings','affiliate_id=not.is.null&select=id,affiliate_id,booking_reference,status,payment_status,balance_paid_at,net_room_revenue,currency&order=created_at.desc,id.desc&limit=201'),
      selectRows('plp_affiliates','select=id,name,rate,rate_approval_status,status&order=id.asc&limit=201'),
      selectRows('plp_commissions','select=id,booking_id,affiliate_id,commission_type,commission_amount,currency,status,payout_id&order=created_at.desc,id.desc&limit=201'),
    ]);
    if(![bookings,partners,commissions].every(Array.isArray))return [503,{ok:false,error:'Financial review is unavailable.'}];
    const truncated=[bookings,partners,commissions].some(rows=>rows.length>200);
    if(truncated)return [409,{ok:false,error:'Review exceeds its safe 200-record limit. A paginated reconciliation export is required.'}];
    const byId=new Map(partners.map(p=>[p.id,p]));
    return [200,{ok:true,previewOnly:true,postingAllowed:false,proposedBasis:'Net room revenue after checkout and verified full payment; subject to explicit commercial approval.',reviews:bookings.map(b=>reviewCommission(b,byId.get(b.affiliate_id),commissions)),settlements:reviewSettlement(commissions)},null];
  }

  if (method === 'GET' && (input.view || 'partners') === 'payouts') {
    const rows = await selectRows('plp_payouts', 'select=id,affiliate_id,amount,currency,payout_reference,status,recorded_by,created_at&order=created_at.desc&limit=100');
    const partners = await selectRows('plp_affiliates', 'select=id,name,referral_code,status&order=name.asc&limit=200');
    return [200, { ok: true, rows: rows || [], partners: partners || [], commissionsActive: affiliateCommissionsActive(), payoutRecordingActive: false }];
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
    if (!validEnrollmentEmail(email) || !name) return [400, { ok: false, error: 'Add the partner name and email.' }];
    const token = newInviteToken();
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const saved = await insertRow('plp_affiliate_invites', {
      email, name, tier, token_hash: hashInviteToken(token), invited_by: actor || null, expires_at: expires,
    });
    if (!saved) return [503, { ok: false, error: 'The invitation could not be saved.' }];
    return [200, { ok: true, invite: { id: saved.id, email, expires_at: expires, path: '/affiliate?invite=' + token } }];
  }
  if (method === 'POST' && input.action === 'payout') {
    // Historical records remain readable, but an arbitrary amount is not a
    // reconciled settlement. New entries require an owner-approved settlement workflow.
    return [409, { ok: false, error: 'Payout recording is locked pending owner-approved commission reconciliation.' }];
  }
  if (method === 'PATCH' && input.id && input.status) {
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(input.id))) return [400,{ok:false,error:'Invalid partner ID.'}];
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

// Exchange only a verification hash issued by this project's Auth service;
// never fetch a user-supplied URL or honor its redirect destination.
export function parseAffiliateVerificationLink(value, env = process.env) {
  try {
    const url = new URL(String(value || '').trim());
    const auth = new URL(plpSupabaseEnv(env).SUPABASE_URL || '');
    if (url.protocol !== 'https:' || url.origin !== auth.origin || url.username || url.password ||
        url.pathname !== '/auth/v1/verify' || url.hash) return null;
    const token_hash = url.searchParams.get('token') || '';
    const type = url.searchParams.get('type') || '';
    if (!/^[A-Za-z0-9_-]{16,512}$/.test(token_hash) || !['email','signup','magiclink'].includes(type)) return null;
    return { token_hash, type };
  } catch { return null; }
}

function enrollmentCookie(details, env = process.env, now = Date.now()) {
  const key = affiliateSessionSecret(env);
  if (key.length < 48) throw new Error('Enrollment unavailable');
  const payload = Buffer.from(JSON.stringify({ v: 1, typ: 'affiliate-enrollment', ...details,
    exp: Math.floor(now / 1000) + ENROLL_TTL })).toString('base64url');
  return ENROLL_COOKIE + '=' + payload + '.' + digest(payload, key) +
    '; Path=/; Max-Age=' + ENROLL_TTL + '; HttpOnly; Secure; SameSite=Lax';
}

function readEnrollment(req, env = process.env, now = Date.now()) {
  const key = affiliateSessionSecret(env);
  const raw = String(req.headers?.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(ENROLL_COOKIE + '='));
  if (!raw || key.length < 48) return null;
  const token = raw.slice(ENROLL_COOKIE.length + 1);
  if (token.length > 1600) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const a = Buffer.from(digest(parts[0], key)), b = Buffer.from(parts[1]);
  if (a.length !== b.length || !timingSafeEqual(a,b)) return null;
  try {
    const x = JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    if (x.v !== 1 || x.typ !== 'affiliate-enrollment' || !validEnrollmentEmail(x.email) ||
        !Number.isInteger(x.exp) || x.exp <= Math.floor(now/1000) ||
        x.exp > Math.floor(now/1000) + ENROLL_TTL) return null;
    return x;
  } catch { return null; }
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
  // Do not create an account unless the session can actually be issued.
  if (affiliateSessionSecret().length < 48) return [503, { ok: false, error: 'Partner access is temporarily unavailable.' }, null];
  const action = input.action;
  const pending = ['enroll-start','accept'].includes(action) ? null : readEnrollment(req);
  if (action !== 'accept' && !pending?.inviteId && !affiliatePublicEnrollment()) return [403, {ok:false,error:'Public enrollment is currently closed.'},null];
  if (action === 'accept') {
    const token = String(input.invite || input.token || '');
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return [400,{ok:false,error:'This invitation link is incomplete or invalid.'},null];
    const invite = (await selectRows('plp_affiliate_invites','token_hash=eq.'+hashInviteToken(token)+'&select=id,email,name,tier,accepted_at,expires_at&limit=1'))?.[0];
    if (!invite || invite.accepted_at || Date.parse(invite.expires_at) <= Date.now()) return [400,{ok:false,error:'This invitation is not valid or has already been used.'},null];
    const email = validEnrollmentEmail(invite.email);
    if (!email) return [400,{ok:false,error:'The invitation is invalid.'},null];
    if (!await enrollmentAllowed(req,email,'enroll-start')) return [429,{ok:false,error:'Too many attempts. Try again later.'},null];
    const sent = await authRequest('otp?redirect_to='+encodeURIComponent(AFFILIATE_REDIRECT),{email,create_user:true});
    if (!sent) return [503,{ok:false,error:'Email verification is temporarily unavailable.'},null];
    return [200,{ok:true,verificationRequired:true},enrollmentCookie({email,name:invite.name,tier:invite.tier,inviteId:invite.id})];
  }
  const email = action === 'enroll-start' ? validEnrollmentEmail(input.email) : pending?.email;
  if (!email) return [400, { ok: false, error: action === 'enroll-start' ? 'Enter a valid email address.' : 'Start verification again in this browser.' }, null];
  if (action === 'enroll-start') {
    if (!await enrollmentAllowed(req, email, action)) return [429, { ok: false, error: 'Too many attempts. Try again later.' }, null];
    const name = String(input.name || '').trim().slice(0, 120);
    const tier = ['travel_agent','influencer','referral'].includes(input.tier) ? input.tier : 'referral';
    const sent = await authRequest('otp?redirect_to=' + encodeURIComponent(AFFILIATE_REDIRECT), { email, create_user: true });
    return sent
      ? [200, { ok: true, message: 'Check your email for your secure sign-in link or verification code.' }, enrollmentCookie({email,name,tier})]
      : [503, { ok: false, error: 'Email verification is temporarily unavailable. You can still explore the demo.' }, null];
  }
  let accessToken;
  if (action === 'enroll-link') {
    accessToken = typeof input.accessToken === 'string' && input.accessToken.length <= 8192 ? input.accessToken : '';
    if (!accessToken) return [400,{ok:false,error:'The email sign-in link is invalid.'},null];
  } else {
    const code = String(input.code || '').trim();
    const proof = /^\d{6,8}$/.test(code) ? {email,token:code,type:'email'} : parseAffiliateVerificationLink(code);
    if (!proof) return [400,{ok:false,error:'Enter the code or copy the secure verification link from your email.'},null];
    if (!await enrollmentAllowed(req,email,action)) return [429,{ok:false,error:'Too many attempts. Try again later.'},null];
    const verified = await authRequest('verify',proof);
    accessToken = verified?.access_token;
  }
  if (action === 'enroll-link' && !await enrollmentAllowed(req,email,action)) return [429,{ok:false,error:'Too many attempts. Try again later.'},null];
  const user = accessToken ? await authRequest('user',null,accessToken) : null;
  if (!user?.id || !user.email_confirmed_at || user.is_anonymous === true || user.deleted_at || validEnrollmentEmail(user.email) !== email || user.banned_until && Date.parse(user.banned_until) > Date.now()) {
    return [401,{ok:false,error:'The email verification is invalid or expired.'},null];
  }
  let invite = null;
  if (pending.inviteId) {
    if (!/^[0-9a-f-]{36}$/i.test(pending.inviteId)) return [400,{ok:false,error:'Invalid invitation.'},null];
    invite=(await selectRows('plp_affiliate_invites','id=eq.'+pending.inviteId+'&select=id,email,accepted_at,expires_at&limit=1'))?.[0];
    if (!invite || invite.accepted_at || Date.parse(invite.expires_at)<=Date.now() || validEnrollmentEmail(invite.email)!==email) return [400,{ok:false,error:'This invitation is no longer valid.'},null];
  }
  let partner = (await selectRows('plp_affiliates', 'email=eq.' + encodeURIComponent(email) + '&select=*&limit=1'))?.[0];
  if (partner && ['paused', 'declined'].includes(partner.status)) return [403, { ok: false, error: 'This partner account is not active. Contact PLP sales.' }, null];
  if (!partner) {
    const name = String(pending.name || '').trim().slice(0,120) || email.split('@')[0].slice(0,120);
    const tier = ['travel_agent','influencer','referral'].includes(pending.tier) ? pending.tier : 'referral';
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
  if (invite) {
    const accepted=await updateRows('plp_affiliate_invites','id=eq.'+invite.id+'&accepted_at=is.null&select=id',{accepted_at:new Date().toISOString(),affiliate_id:partner.id});
    if (!accepted?.length) return [409,{ok:false,error:'This invitation has already been used. Sign in with your verified email.'},null];
  }
  return [200, { ok: true, partner: publicPartner(partner), commissionsActive: affiliateCommissionsActive() }, [affiliateCookie(partner.id), ENROLL_COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax']];
}

// Stable cursor pagination. Only these projections are ever returned to partners.
const LEDGERS = Object.freeze({
  referrals: {table:'plp_bookings',fields:'booking_reference,status,check_in,check_out,currency,created_at',map:r=>({reference:r.booking_reference,status:r.status,check_in:r.check_in,check_out:r.check_out,currency:r.currency,created_at:r.created_at})},
  enquiries: {table:'plp_concierge_enquiries',fields:'status,created_at',map:r=>({status:r.status,created_at:r.created_at})},
  payouts: {table:'plp_payouts',fields:'amount,currency,payout_reference,status,created_at',map:r=>({amount:r.amount,currency:r.currency,payout_reference:r.payout_reference,status:r.status,created_at:r.created_at})},
  commissions: {table:'plp_commissions',fields:'commission_type,commission_amount,currency,status,created_at',map:r=>({commission_type:r.commission_type,commission_amount:r.commission_amount,currency:r.currency,status:r.status,created_at:r.created_at})},
});
const LEDGER_PAGE_SIZE=50;
export function decodeLedgerCursor(value){
  if(typeof value!=='string'||value.length>256||!(/^[A-Za-z0-9_-]+$/.test(value)))return null;
  try{
    const c=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
    if(!c||typeof c.at!=='string'||!(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(c.at))||!Number.isFinite(Date.parse(c.at))||!(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(c.id)))return null;
    return c;
  }catch{return null;}
}
async function partnerLedgerPage(partnerId,kind,cursor=null){
  const definition=LEDGERS[kind];
  if(!definition)throw Error('Unknown ledger');
  if(kind==='commissions'&&!affiliateCommissionsActive())return {rows:[],next:null};
  const q=new URLSearchParams({affiliate_id:'eq.'+partnerId,select:'id,'+definition.fields,order:'created_at.desc,id.desc',limit:String(LEDGER_PAGE_SIZE+1)});
  if(cursor)q.set('or','(created_at.lt.'+cursor.at+',and(created_at.eq.'+cursor.at+',id.lt.'+cursor.id+'))');
  const result=await selectRows(definition.table,q.toString());
  if(!Array.isArray(result))throw Error('Ledger unavailable');
  const visible=result.slice(0,LEDGER_PAGE_SIZE), last=visible.at(-1);
  const next=result.length>LEDGER_PAGE_SIZE&&last?Buffer.from(JSON.stringify({at:last.created_at,id:last.id})).toString('base64url'):null;
  return {rows:visible.map(definition.map),next};
}

export async function handleAffiliatePortal(req, input = {}) {
  if (['enroll-start', 'enroll-verify', 'enroll-link', 'accept'].includes(input.action)) return handlePublicEnrollment(req, input);
  if (input.action === 'logout' && req.method === 'POST') return [200, { ok: true }, AFFILIATE_COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'];

  const session = readAffiliateCookie(req);
  if (!session) return [401, { ok: false, error: 'Sign in or create your partner account.' }, null];
  const partners = await selectRows('plp_affiliates', 'id=eq.' + session.uid + '&select=id,name,email,referral_code,tier,rate,rate_approval_status,status&limit=1');
  const partner = partners?.[0];
  if (!partner || partner.status !== 'active') return [401, { ok: false, error: 'This partner session is no longer valid.' }, null];
  if(req.method!=='GET')return [405,{ok:false,error:'Method not allowed.'},null];
  if(input.action==='ledger'){
    const kind=String(input.kind||''), cursor=decodeLedgerCursor(input.cursor);
    if(!Object.hasOwn(LEDGERS,kind)||!cursor)return [400,{ok:false,error:'Invalid ledger page.'},null];
    const page=await partnerLedgerPage(partner.id,kind,cursor);
    return [200,{ok:true,kind,...page},null];
  }
  if(input.action!=='me')return [400,{ok:false,error:'Unknown partner action.'},null];
  // Fail closed on financial or booking read failures. Enquiries may explicitly be unavailable.
  const [referrals,enquiries,payouts,commissions]=await Promise.all([
    partnerLedgerPage(partner.id,'referrals'),
    partnerLedgerPage(partner.id,'enquiries').catch(()=>({rows:null,next:null})),
    partnerLedgerPage(partner.id,'payouts'),
    partnerLedgerPage(partner.id,'commissions'),
  ]);
  return [200,{
    ok:true,partner:publicPartner(partner),link:'/?ref='+partner.referral_code,
    referrals:referrals.rows,enquiries:enquiries.rows,payouts:payouts.rows,commissions:commissions.rows,
    ledgerNext:{referrals:referrals.next,enquiries:enquiries.next,payouts:payouts.next,commissions:commissions.next},
    commissionsActive:affiliateCommissionsActive(),
  },null];
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
