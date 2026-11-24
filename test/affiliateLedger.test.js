import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { affiliateCommissionsActive, PROPOSED_AFFILIATE_RATES, signAffiliateSession, verifyAffiliateSession } from '../lib/affiliate.js';
import { captureReferralCode, normalizeReferralCode } from '../lib/referral-capture.js';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('affiliate commissions stay off and proposed rates are flagged pending owner approval', () => {
  assert.equal(affiliateCommissionsActive({}), false);
  assert.equal(affiliateCommissionsActive({ PLP_AFFILIATE_COMMISSIONS_ACTIVE: 'false' }), false);
  assert.equal(affiliateCommissionsActive({ PLP_AFFILIATE_COMMISSIONS_ACTIVE: 'true' }), true);
  assert.equal(PROPOSED_AFFILIATE_RATES.travel_agent.rate, 0.08);
  assert.equal(PROPOSED_AFFILIATE_RATES.influencer.rate, 0.05);
  assert.equal(PROPOSED_AFFILIATE_RATES.referral.rate, 0.05);
  assert.equal(PROPOSED_AFFILIATE_RATES.manager_override.rate, 0.02);
  for (const value of Object.values(PROPOSED_AFFILIATE_RATES)) {
    assert.equal(value.approval, 'pending_owner_approval');
  }
});

test('referral codes are normalised and ?ref= is stored for the guest forms', () => {
  assert.equal(normalizeReferralCode('  Travel-Argie  '), 'travel-argie');
  assert.equal(normalizeReferralCode('no'), '');
  const store = {};
  const previous = globalThis.sessionStorage;
  globalThis.sessionStorage = {
    setItem(key, value) { store[key] = value; },
    getItem(key) { return store[key] || null; },
  };
  try {
    assert.equal(captureReferralCode('?ref=Travel-Argie'), 'travel-argie');
    assert.equal(store.plp_referral_code, 'travel-argie');
    assert.equal(captureReferralCode(''), 'travel-argie');
  } finally {
    if (previous === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previous;
  }
});

test('an affiliate session never looks like a staff or owner ticket', () => {
  const key = 'k'.repeat(48);
  const token = signAffiliateSession('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', key);
  const session = verifyAffiliateSession(token, key);
  assert.equal(session.typ, 'affiliate');
  assert.equal(session.uid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.equal(verifyAffiliateSession(token, 'x'.repeat(48)), null);
});

test('the lean ledger has four tables, settlement fields, and no bank or TIN data', () => {
  const sql = read('supabase/migrations/20261124130000_plp_affiliate_ledger.sql');
  for (const table of ['plp_affiliates', 'plp_affiliate_invites', 'plp_commissions', 'plp_payouts']) {
    assert.match(sql, new RegExp('create table if not exists plp_runtime\\.' + table));
  }
  assert.equal([...sql.matchAll(/create table if not exists/g)].length, 4);
  assert.match(sql, /add column if not exists affiliate_id/);
  assert.match(sql, /add column if not exists referral_code/);
  assert.match(sql, /balance_paid_at/);
  assert.match(sql, /net_room_revenue/);
  assert.match(sql, /currency text(?: not null)? default 'USD'/);
  assert.doesNotMatch(sql, /bank_account|tax_id|routing_number|\biban\b|\bswift\b/i);
  assert.match(sql, /payout_reference text/);
  assert.doesNotMatch(sql, /plp_affiliate_clicks|plp_affiliate_tiers|plp_booking_attributions/);
});

test('booking and enquiry forms expose an editable referral field and the portal has two views', () => {
  assert.match(read('booking.html'), /id="referralCode"/);
  assert.match(read('src/booking.js'), /captureReferralCode|referralCode/);
  assert.match(read('src/ConciergeView.jsx'), /Referral code/);
  assert.match(read('src/admin/ConciergeInbox.jsx'), /Referral code/);
  const portal = read('src/affiliate.js');
  assert.match(portal, /Overview/);
  assert.match(portal, /Referrals &amp; Payouts/);
  assert.match(read('src/admin/adminNavigation.js'), /id: 'partners'/);
  assert.match(read('src/admin/adminNavigation.js'), /id: 'payouts'/);
  assert.match(read('api/admin.js'), /action === 'affiliates'/);
  assert.match(read('api/plp.js'), /action === 'affiliate'/);
  assert.doesNotMatch(read('src/admin/AffiliateAdmin.jsx'), /bank account|\\bTIN\\b|tax id/i);
});
