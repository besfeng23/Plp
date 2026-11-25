import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewAffiliateBooking } from '../lib/affiliate-financial-review.js';

const partner={id:'partner',name:'QA fixture',status:'active',rate:'0.0750',rate_approval_status:'approved'};
const booking={id:'booking',booking_reference:'QA',affiliate_id:partner.id,status:'CHECKED_OUT',payment_status:'PAID',net_room_revenue:'1000.10',currency:'USD'};

test('owner review computes rounded decimal draft without generating an obligation',()=>{
 const result=reviewAffiliateBooking(booking,partner);
 assert.equal(result.eligibleAmount,'1000.10');
 assert.equal(result.proposedAmount,'75.01');
 assert.deepEqual(result.reasons,[]);
 assert.equal(result.requiresReconciliation,true);
});
test('review never substitutes gross revenue, currency or unapproved rates',()=>{
 for(const [b,p,reason] of [
  [{...booking,net_room_revenue:null,total_amount_php:1000},partner,'Net room revenue missing or invalid'],
  [{...booking,currency:null},partner,'Currency missing or invalid'],
  [{...booking,status:'CANCELLED'},partner,'Stay not completed'],
  [{...booking,payment_status:'PARTIAL'},partner,'Payment not fully recorded'],
  [booking,{...partner,rate_approval_status:'pending_owner_approval'},'Owner-approved rate required'],
  [booking,{...partner,rate:'1.0001'},'Owner-approved rate required'],
  [booking,{...partner,id:'other'},'Active attributed partner required'],
  [booking,{...partner,status:'paused'},'Active attributed partner required'],
 ]){
   const result=reviewAffiliateBooking(b,p);
   assert.equal(result.proposedAmount,null);
   assert.ok(result.reasons.includes(reason));
 }
});
test('an existing booking commission is never presented as a new draft',()=>{
 const result=reviewAffiliateBooking(booking,partner,[{booking_id:booking.id,affiliate_id:partner.id,commission_type:'referral'}]);
 assert.equal(result.proposedAmount,null);
 assert.ok(result.reasons.includes('Commission already recorded'));
});
