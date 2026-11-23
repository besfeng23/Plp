// PR 3 — Booking and payment integrity. All PayPal and Supabase traffic is
// mocked: this suite can never create a real order, capture or refund.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { todayAtResort, shiftMonth } from '../lib/booking-dates.js';

Object.assign(process.env,{SUPABASE_URL:'https://active.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only',PLP_SUPABASE_SCHEMA:'plp_runtime',
 PAYPAL_MODE:'sandbox',PAYPAL_CLIENT_ID:'test-client',PAYPAL_CLIENT_SECRET:'test-secret',NEXT_PUBLIC_BASE_URL:'https://plp-boracay.vercel.app'});
delete process.env.RESEND_API_KEY;
const { PLP_ROOMS, authoritativeQuote, bookingAmounts, formatUsd, quoteStay } = await import('../lib/pricing.js');
const { evaluatePayPalCapture } = await import('../lib/paypal-capture-guard.js');
const { default: bookings } = await import('../api/bookings.js');
const { default: createSession } = await import('../api/paypal/create-session.js');
const { recordPayPalCapture } = await import('../api/paypal/_db.js');
const { recordMoney } = await import('../lib/admin-records.js');

const month=shiftMonth(todayAtResort().slice(0,7),2);
const ref='PLP-0123456789ABCDEF01234567';
let calls=[],persisted=null;
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});}
globalThis.fetch=async(url,opts={})=>{
 const u=new URL(String(url));const method=opts.method||'GET';const body=opts.body&&typeof opts.body==='string'&&opts.body.startsWith('{')?JSON.parse(opts.body):opts.body;
 calls.push({host:u.host,path:u.pathname,search:u.search,method,body});
 if(u.host==='api-m.sandbox.paypal.com'){
  if(u.pathname==='/v1/oauth2/token')return reply({access_token:'test-token'});
  if(u.pathname==='/v2/checkout/orders')return reply({id:'ORDERTEST1234567890',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=ORDERTEST1234567890'}]},201);
  return reply({message:'unexpected'},500);
 }
 assert.equal(u.host,'active.invalid','no network outside mocks');
 if(u.pathname.endsWith('/plp_accommodations'))return reply([{id:'room-1',name:'Grand Ocean Villa',is_active:true}]);
 if(u.pathname.endsWith('/rpc/create_booking_atomic'))return reply({id:'booking-1'});
 if(u.pathname.endsWith('/plp_bookings')&&method==='GET')return reply(persisted?[persisted]:[]);
 if(u.pathname.endsWith('/plp_guests'))return reply([{email:'guest@example.test',normalized_email:'guest@example.test'}]);
 if(u.pathname.endsWith('/plp_payments')&&method==='POST')return reply([{id:'pay-1',provider:'PAYPAL',provider_session_id:body.provider_session_id,status:'PENDING',verification_status:'PENDING'}]);
 return reply([]);
};
function run(handler,req){const r={headers:{}};return Promise.resolve(handler(req,{setHeader(k,v){r.headers[k]=v},status(s){r.status=s;return this},json(b){r.body=b;return this},end(){}})).then(()=>r);}
const guest={name:'Example Guest',email:'guest@example.test',phone:'000',accommodation:'Grand Ocean Villa',guests:2};
const stay=n=>({checkIn:month+'-01',checkOut:month+'-0'+(1+n)});

test('authoritative quotes: USD 1,000 per night, 30% deposit',()=>{
 for(const room of PLP_ROOMS){
  assert.deepEqual([1,2,3].map(n=>quoteStay(room,n).amount),[1000,2000,3000]);
  assert.equal(quoteStay(room,1).deposit,300);assert.equal(quoteStay(room,2).deposit,600);
 }
 assert.deepEqual(authoritativeQuote('Sunset Suite',2),{currency:'USD',rate:1000,nights:2,amount:2000,deposit:600,balance:1400});
 assert.equal(authoritativeQuote('Unknown',2),null);
 assert.equal(formatUsd(1000),'USD 1,000');
});

test('server ignores browser-submitted amounts and rejects a tampered quote',async()=>{
 calls=[];
 const ok=await run(bookings,{method:'POST',body:{...guest,...stay(2),amount:1,deposit:1,rate:1,paymentDue:1}});
 assert.equal(ok.status,200,JSON.stringify(ok.body));
 assert.equal(ok.body.currency,'USD');
 assert.equal(ok.body.booking.amount,2000);assert.equal(ok.body.booking.deposit,600);assert.equal(ok.body.booking.rate,1000);
 const rpc=calls.find(c=>c.path.endsWith('/rpc/create_booking_atomic'));
 assert.equal(rpc.body.p_booking.deposit,600);assert.equal(rpc.body.p_booking.amount,2000);
 assert.equal('currency' in rpc.body.p_booking,false,'RPC payload shape unchanged');
 calls=[];
 const tampered=await run(bookings,{method:'POST',body:{...guest,...stay(1),quote:{amount:1,deposit:1}}});
 assert.equal(tampered.status,409);
 assert.equal(calls.some(c=>c.path.endsWith('/rpc/create_booking_atomic')),false);
});

const persistedRow=(over={})=>({id:'booking-1',booking_reference:ref,guest_id:'guest-1',accommodation_name:'Grand Ocean Villa',check_in:month+'-01',check_out:month+'-03',nights:2,
 rate_per_night_php:1000,total_amount_php:2000,deposit_amount_php:600,balance_amount_php:1400,status:'PENDING_PAYMENT',payment_status:'PENDING',expires_at:new Date(Date.now()+3600e3).toISOString(),...over});

test('checkout charges the server-computed USD deposit, never a client or tampered amount',async()=>{
 calls=[];persisted=persistedRow();
 const r=await run(createSession,{method:'POST',headers:{host:'plp-boracay.vercel.app'},body:{booking:{reference:ref,name:'Example Guest',email:'guest@example.test',deposit:1,paymentDue:1}}});
 assert.equal(r.status,201,JSON.stringify(r.body));
 assert.equal(r.body.amount,600);assert.equal(r.body.currency,'USD');
 const order=calls.find(c=>c.path==='/v2/checkout/orders');
 const unit=order.body.purchase_units[0];
 assert.equal(unit.amount.value,'600.00');assert.equal(unit.amount.currency_code,'USD');
 // A persisted record that disagrees with the catalog stops before PayPal.
 for(const bad of [{deposit_amount_php:60},{total_amount_php:200},{rate_per_night_php:100},{accommodation_name:'Unknown'}]){
  calls=[];persisted=persistedRow(bad);
  const x=await run(createSession,{method:'POST',headers:{host:'plp-boracay.vercel.app'},body:{booking:{reference:ref,name:'Example Guest',email:'guest@example.test'}}});
  assert.equal(x.status,409,JSON.stringify(bad));assert.equal(x.body.code,'PRICE_MISMATCH');
  assert.equal(calls.some(c=>c.host.includes('paypal')),false,'PayPal never contacted');
 }
 persisted=null;
});

test('duplicate capture never charges twice; failed capture is never marked paid',async()=>{
 const booking={id:'b',booking_reference:ref,status:'PAID_DEPOSIT',payment_status:'SUCCEEDED',deposit_amount_php:300};
 const payment={booking_id:'b',provider_reference_id:ref,provider_session_id:'ORDERTEST1234567890',currency:'USD',amount_php:300,status:'SUCCEEDED',verification_status:'VERIFIED'};
 assert.equal(evaluatePayPalCapture({booking,payment,bookingRef:ref,orderToken:'ORDERTEST1234567890'}).decision,'already_paid');
 // failed capture
 calls=[];persisted=persistedRow({status:'PAYMENT_PROCESSING',deposit_amount_php:600});
 const orig=globalThis.fetch;
 globalThis.fetch=async(url,opts={})=>{const u=new URL(String(url));calls.push({path:u.pathname,method:opts.method||'GET',body:opts.body?JSON.parse(opts.body):null});
  if(u.pathname.endsWith('/plp_payments')&&(opts.method||'GET')==='GET')return reply([{id:'pay-1',booking_id:'booking-1',provider_session_id:'ORDERTEST1234567890',amount_php:600,currency:'USD',status:'PENDING',verification_status:'PENDING'}]);
  return orig(url,opts);};
 try{
  const failed=await recordPayPalCapture({bookingReference:ref,orderId:'ORDERTEST1234567890',captureId:'CAP1',amount:'600.00',currency:'USD',status:'DECLINED',payload:{}});
  assert.notEqual(failed.verificationStatus,'VERIFIED');
  assert.equal(calls.some(c=>c.path.endsWith('/plp_bookings')&&c.method==='PATCH'),false,'booking not marked paid');
  const paymentPatch=calls.find(c=>c.path.endsWith('/plp_payments')&&c.method==='PATCH');
  assert.equal(paymentPatch.body.status,undefined,'payment status not advanced');
  calls=[];
  const ok=await recordPayPalCapture({bookingReference:ref,orderId:'ORDERTEST1234567890',captureId:'CAP1',amount:'600.00',currency:'USD',status:'COMPLETED',payload:{}});
  assert.equal(ok.verificationStatus,'VERIFIED');
  assert.equal(calls.find(c=>c.path.endsWith('/plp_payments')&&c.method==='PATCH').body.currency,'USD');
  calls=[];
  const wrongCurrency=await recordPayPalCapture({bookingReference:ref,orderId:'ORDERTEST1234567890',captureId:'CAP1',amount:'600.00',currency:'PHP',status:'COMPLETED',payload:{}});
  assert.equal(wrongCurrency.verificationStatus,'CURRENCY_MISMATCH');
 }finally{globalThis.fetch=orig;persisted=null;}
 assert.doesNotMatch(readFileSync(new URL('../api/paypal/_db.js',import.meta.url),'utf8'),/currency \|\| 'PHP'/);
});

test('currency reporting identifies USD correctly and never relabels legacy *_php columns as pesos',()=>{
 const usd=bookingAmounts(persistedRow());
 assert.equal(usd.currency,'USD');assert.equal(usd.deposit,600);
 const legacy=bookingAmounts(persistedRow({rate_per_night_php:25000,total_amount_php:50000,deposit_amount_php:15000}));
 assert.equal(legacy.currency,'','unknown historical currency stays unrecorded, not PHP or USD');
 assert.match(recordMoney(600,{payment_currency:'USD'}),/USD/);
 const booking=readFileSync(new URL('../booking.html',import.meta.url),'utf8');
 assert.match(booking,/Estimate in US dollars \(USD\)/);
 const src=readFileSync(new URL('../src/booking.js',import.meta.url),'utf8');
 assert.match(src,/element\('estDeposit'\)\.textContent = formatUsd\(deposit\)/);
});

test('an unsaved booking is never reported as accepted',async()=>{
 const saved=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const src=readFileSync(new URL('../api/bookings.js',import.meta.url),'utf8');
 assert.doesNotMatch(src,/Booking request accepted but not persisted/);
 assert.match(src,/return res\.status\(503\)\.json\(\{ ok: false, error: 'Your request could not be saved/);
 assert.equal(saved,'test-only');
});
