import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { affiliateCommissionsActive, affiliatePublicEnrollment, PROPOSED_AFFILIATE_RATES, signAffiliateSession, verifyAffiliateSession } from '../lib/affiliate.js';
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


test('public enrollment is available with explicit off switch and requires verified email', () => {
  assert.equal(affiliatePublicEnrollment({}), true);
  assert.equal(affiliatePublicEnrollment({ PLP_AFFILIATE_PUBLIC_ENROLLMENT: 'false' }), false);
  const backend = read('lib/affiliate.js');
  assert.match(backend, /email_confirmed_at/);
  assert.match(backend, /plp_reserve_preview_attempt/);
  assert.match(backend, /status: 'active'/);
  assert.match(backend, /rate_approval_status: 'pending_owner_approval'/);
  const portal = read('src/affiliate.js');
  assert.match(portal, /TEST DASHBOARD/);
  assert.match(portal, /No live referrals, payments or accounts/);
  assert.match(portal, /enroll-verify/);
});

test('professional dashboard renders six views, separates demo from live and escapes records', () => {
  const fakeNode = () => ({hidden:false,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){return true}},addEventListener(){},setAttribute(){},focus(){},querySelector(){return fakeNode()},querySelectorAll(){return []}});
  const nodes = Object.fromEntries(['status','app','loading'].map(k=>[k,fakeNode()]));
  const ctx = vm.createContext({document:{getElementById:k=>nodes[k]},location:{origin:'https://plp.example',search:''},URL,URLSearchParams,Intl,window:{scrollTo(){}},fetch(){throw Error('No network allowed in rendering test')}});
  // Strip only the final automatic startup call; render real functions with a DOM stub.
  vm.runInContext(read('src/affiliate.js').replace(/start\(\);\s*$/,''),ctx);
  vm.runInContext('demoDashboard()',ctx);
  assert.match(nodes.app.innerHTML,/TEST DASHBOARD/);
  assert.match(nodes.app.innerHTML,/DEMO-1003/);
  assert.match(nodes.app.innerHTML,/USD\s*200/);
  for (const view of ['referrals','commissions','payouts','resources','account']) {
    vm.runInContext('render({partner:{name:"<script>unsafe</script>",referral_code:"demo-preview",status:"active"},referrals:[],payouts:[],commissions:[],commissionsActive:false},'+JSON.stringify(view)+')',ctx);
    assert.match(nodes.app.innerHTML,new RegExp('data-view="'+view+'" aria-current="page"'));
    assert.doesNotMatch(nodes.app.innerHTML,/<script>unsafe/);
  }
  vm.runInContext('demo=false; render({partner:{name:"Live Partner",referral_code:"live-code",status:"active"},referrals:[],payouts:[],commissions:[],commissionsActive:false})',ctx);
  assert.doesNotMatch(nodes.app.innerHTML,/DEMO-1003|TEST DASHBOARD/);
  assert.match(nodes.app.innerHTML,/Private pre-launch/);
  assert.match(nodes.app.innerHTML,/Earnings are not currently accruing/);
});


test('affiliate record tables include mobile labels and exports guard spreadsheet formulas', () => {
  const fakeNode = () => ({hidden:false,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){return true}},addEventListener(){},setAttribute(){},focus(){},querySelector(){return fakeNode()},querySelectorAll(){return []}});
  const nodes = Object.fromEntries(['status','app','loading'].map(k=>[k,fakeNode()]));
  const ctx = vm.createContext({document:{getElementById:k=>nodes[k]},location:{origin:'https://plp.example',search:''},URL,URLSearchParams,Intl,window:{scrollTo(){}},fetch(){throw Error('No network allowed in rendering test')}});
  vm.runInContext(read('src/affiliate.js').replace(/start\(\);\s*$/,''),ctx);
  const markup=vm.runInContext('referralTable([{reference:"DEMO-1001",status:"COMPLETED",check_in:"2026-11-10"}])',ctx);
  assert.match(markup,/data-label="Booking reference"/);
  assert.match(markup,/data-label="Status"/);
  assert.match(markup,/DEMO-1001/);
  for (const value of ['=1+1','+1','-1','@SUM(1)','\t123','  =1+1']) {
    assert.ok(vm.runInContext('csvCell('+JSON.stringify(value)+')',ctx).startsWith("\"'"));
  }
  assert.equal(vm.runInContext('csvCell("Normal, value")',ctx),'"Normal, value"');
  assert.equal(vm.runInContext('csvCell(\'a"b\')',ctx),'"a""b"');
  vm.runInContext('demoDashboard(); render({partner:{name:"Partner",referral_code:"sample",status:"active"},referrals:[],commissions:[],payouts:[],commissionsActive:false},"commissions")',ctx);
  assert.match(nodes.app.innerHTML,/id="recordStatus"/);
  assert.match(nodes.app.innerHTML,/id="exportRecords"/);
  assert.match(nodes.app.innerHTML,/No commission records/);
});


test('affiliate reporting uses UTC date windows, preserves missing enquiries, and reads only scoped safe fields', () => {
  const fakeNode = () => ({hidden:false,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){return true}},addEventListener(){},setAttribute(){},focus(){},querySelector(){return fakeNode()},querySelectorAll(){return []}});
  const nodes=Object.fromEntries(['status','app','loading'].map(k=>[k,fakeNode()]));
  const ctx=vm.createContext({document:{getElementById:k=>nodes[k]},location:{origin:'https://plp.example',search:''},URL,URLSearchParams,Intl,window:{scrollTo(){}},fetch(){throw Error('No network allowed')}});
  vm.runInContext(read('src/affiliate.js').replace(/start\(\);\s*$/,''),ctx);
  assert.equal(vm.runInContext('reportWindow([{created_at:"2026-11-19T00:00:00Z"},{created_at:"2026-11-18T23:59:59Z"},{created_at:"2026-11-26T00:00:00Z"},{created_at:"bad"}],7,new Date("2026-11-25T12:00:00Z")).length',ctx),1);
  assert.equal(vm.runInContext('activitySeries([{created_at:"2026-11-24"}],null,7,new Date("2026-11-25")).reduce((n,r)=>n+r.bookings,0)',ctx),1);
  assert.equal(vm.runInContext('activitySeries([],null,7,new Date("2026-11-25"))[0].enquiries',ctx),null);
  vm.runInContext('demoDashboard()',ctx);
  assert.match(nodes.app.innerHTML,/Partner performance/);
  assert.match(nodes.app.innerHTML,/Referred enquiries/);
  assert.match(nodes.app.innerHTML,/id="reportPeriod"/);
  assert.match(nodes.app.innerHTML,/TEST DASHBOARD/);
  assert.match(nodes.app.innerHTML,/aria-label="Financial position and partner details"/);
  assert.match(nodes.app.innerHTML,/View chart data/);
  assert.match(nodes.app.innerHTML,/data-label="Enquiries"/);
  assert.match(nodes.app.innerHTML,/data-label="Bookings"/);
  assert.match(nodes.app.innerHTML,/Illustrative · Not payable/);
  vm.runInContext('demo=false; render({partner:{name:"Verified partner",status:"active"},enquiries:null,referrals:[],commissions:[],payouts:[],commissionsActive:false})',ctx);
  assert.match(nodes.app.innerHTML,/Enquiry activity unavailable/);
  assert.doesNotMatch(nodes.app.innerHTML,/DEMO-1003/);
  const source=read('lib/affiliate.js');
  assert.match(source,/selectRows\('plp_concierge_enquiries', 'affiliate_id=eq\.' \+ partner\.id \+ '&select=status,created_at&order=created_at\.desc&limit=50'\)/);
  assert.match(source,/enquiries: enquiries === null \? null : enquiries\.map\(row => \(\{ status: row\.status, created_at: row\.created_at \}\)\)/);
});
