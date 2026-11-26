import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewCommission, reviewSettlement } from '../lib/affiliate-financial-review.js';
const p={id:'partner',name:'Partner',status:'active',rate:'0.0800',rate_approval_status:'pending_owner_approval'};
const b={id:'booking',booking_reference:'QA',affiliate_id:p.id,status:'CHECKED_OUT',payment_status:'PAID',balance_paid_at:'2026-11-25',net_room_revenue:'999.99',currency:'USD'};
test('planning review uses exact decimal arithmetic and never posts pending rates',()=>{
  const r=reviewCommission(b,p);
  assert.equal(r.illustrativeAmount,'80.00');
  assert.equal(r.postingAllowed,false);
  assert.deepEqual(r.reasons,['Rate not approved']);
  assert.equal(reviewCommission({...b,status:'CONFIRMED',payment_status:'PARTIAL'},p).reasons.includes('Stay must be checked out'),true);
  assert.equal(reviewCommission({...b,currency:null},p).illustrativeAmount,null);
  assert.equal(reviewCommission({...b,net_room_revenue:null},p).illustrativeAmount,null);
  const approved=reviewCommission(b,{...p,rate_approval_status:'approved'});
  assert.deepEqual(approved.reasons,[]);assert.equal(approved.postingAllowed,false);
  assert.ok(reviewCommission(b,p,[{booking_id:b.id,affiliate_id:p.id,commission_type:'referral'}]).reasons.includes('Commission already recorded'));
});
test('settlement review separates currencies, excludes allocated and nonpayable records',()=>{
  const row={affiliate_id:p.id,commission_amount:'0.10',status:'approved',currency:'USD',payout_id:null};
  const sums=reviewSettlement([row,{...row,commission_amount:'0.20',status:'payable'},{...row,currency:'PHP',commission_amount:'500.00'},{...row,status:'pending'},{...row,payout_id:'already-paid'}]);
  assert.deepEqual(sums.map(r=>[r.currency,r.amount,r.records,r.postingAllowed]),[['USD','0.30',2,false],['PHP','500.00',1,false]]);
});
test('production stay reporting recognizes checked-out stays',()=>{
  const source=readFileSync(new URL('../src/affiliate.js',import.meta.url),'utf8');
  assert.equal((source.match(/\['checked_out','completed'\]\.includes\(String\(r\.status\)\.toLowerCase\(\)\)/g)||[]).length,2);
});
