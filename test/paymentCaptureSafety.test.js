import assert from 'node:assert/strict';
import test from 'node:test';
import { createBookingReference } from '../lib/booking-reference.js';
import { evaluatePayPalCapture } from '../lib/paypal-capture-guard.js';
import { capturePayPalOrder, getBookingReference, SafePayPalError } from '../api/paypal/_paypal.js';
import { isCheckoutAllowed } from '../api/paypal/create-session.js';
import { readFileSync } from 'node:fs';

const ref = 'PLP-0123456789ABCDEF01234567';
const orderToken = 'ORDERTEST1234567890';
const now = Date.parse('2026-11-22T00:00:00Z');
const booking = {
  id: 'booking-uuid', booking_reference: ref, status: 'PAYMENT_PROCESSING',
  payment_status: 'PROCESSING', deposit_amount_php: 300, expires_at: '2026-11-23T00:00:00Z',
};
const payment = {
  booking_id: 'booking-uuid', provider_reference_id: ref,
  provider_session_id: orderToken, currency: 'USD', amount_php: 300,
  status: 'PENDING', verification_status: 'PENDING',
};
const evaluate = (change = {}) => evaluatePayPalCapture({
  booking: { ...booking, ...(change.booking || {}) },
  payment: { ...payment, ...(change.payment || {}) },
  bookingRef: change.bookingRef || ref, orderToken: change.orderToken || orderToken,
  now: change.now || now,
});

test('new booking IDs are high-entropy, unique, non-identifying and legacy-readable', () => {
  const ids = new Set(Array.from({ length: 512 }, () => createBookingReference()));
  assert.equal(ids.size, 512);
  for (const id of ids) assert.match(id, /^PLP-[A-F0-9]{24}$/);
  assert.equal(getBookingReference({ reference: ref }), ref);
  assert.throws(() => getBookingReference({}), e => e instanceof SafePayPalError && e.code === 'INVALID_BOOKING_REFERENCE');
});

test('PayPal capture only proceeds when the stored provider session, booking and amount all match', () => {
  assert.deepEqual(evaluate(), { decision: 'capture', reason: 'matched_pending_order' });
  for (const bad of [
    { orderToken: 'ANOTHERORDER123456' },
    { bookingRef: 'PLP-WRONG' },
    { payment: { booking_id: 'another-booking' } },
    { payment: { provider_reference_id: 'PLP-DIFFERENT' } },
    { payment: { provider_session_id: 'ANOTHERORDER123456' } },
  ]) assert.equal(evaluate(bad).decision, 'reject');
  for (const bad of [
    { payment: { currency: 'PHP' } },
    { payment: { amount_php: 500 } },
    { payment: { amount_php: 0 } },
    { booking: { deposit_amount_php: 250 } },
  ]) assert.deepEqual(evaluate(bad), { decision: 'reject', reason: 'amount_or_currency_mismatch' });
});

test('expired holds, cancelled stays and anomalous payment states cannot be captured', () => {
  assert.deepEqual(evaluate({ now: Date.parse('2026-11-23T00:00:00Z') }), { decision: 'reject', reason: 'hold_expired' });
  assert.equal(evaluate({ booking: { status: 'CANCELLED' } }).decision, 'reject');
  assert.equal(evaluate({ payment: { status: 'FAILED' } }).decision, 'reject');
  assert.equal(evaluate({ payment: { verification_status: 'AMOUNT_MISMATCH' } }).decision, 'reject');
  assert.deepEqual(evaluate({ booking: { status: 'PAYMENT_PROCESSING' }, payment: { status: 'SUCCEEDED', verification_status: 'VERIFIED' } }), { decision: 'reject', reason: 'requires_reconciliation' });
});

test('verified PayPal orders can be acknowledged but must never be captured again', () => {
  assert.deepEqual(evaluate({ booking: { status: 'PAID_DEPOSIT' }, payment: { status: 'SUCCEEDED', verification_status: 'VERIFIED' } }), { decision: 'already_paid', reason: 'previously_verified' });
  assert.deepEqual(evaluate({ booking: { status: 'CONFIRMED' }, payment: { status: 'SUCCEEDED', verification_status: 'VERIFIED' } }), { decision: 'already_paid', reason: 'previously_verified' });
});

test('repeat PayPal capture requests reuse the same idempotency key (no real provider call)', async t => {
  const env = ['PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_MODE'];
  const prior = env.map(key => process.env[key]);
  process.env.PAYPAL_CLIENT_ID = 'fake-client'; process.env.PAYPAL_CLIENT_SECRET = 'fake-secret'; process.env.PAYPAL_MODE = 'sandbox';
  t.after(() => env.forEach((key,i) => prior[i] === undefined ? delete process.env[key] : process.env[key] = prior[i]));
  const keys = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url,opts) => {
    if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'test-only' });
    assert.match(url, /^https:\/\/api-m\.sandbox\.paypal\.com\/v2\/checkout\/orders\//);
    keys.push(opts.headers['PayPal-Request-Id']);
    return Response.json({id:orderToken,status:'COMPLETED',purchase_units:[{payments:{captures:[{id:'fake-capture',status:'COMPLETED',amount:{currency_code:'USD',value:'300.00'}}]}}]});
  });
  const first = await capturePayPalOrder(orderToken);
  const second = await capturePayPalOrder(orderToken);
  assert.equal(first.status, 'COMPLETED');
  assert.equal(second.captureId, 'fake-capture');
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
  assert.match(keys[0], /^PLP-CAPTURE-[a-f0-9]{44}$/);
  assert.equal(fetchMock.mock.callCount(), 4);
});

test('callback rejects mismatched stored order before any provider capture', async t => {
  const env = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_BASE_URL'];
  const prior = env.map(key => process.env[key]);
  process.env.SUPABASE_URL = 'https://test-supabase.example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  process.env.NEXT_PUBLIC_BASE_URL = 'https://plp-boracay.vercel.app';
  t.after(() => env.forEach((key,i) => prior[i] === undefined ? delete process.env[key] : process.env[key] = prior[i]));
  const { default: captureHandler } = await import('../api/paypal/capture.js');
  const mock = t.mock.method(globalThis, 'fetch', async (url,options) => {
    assert.equal(options.method, 'GET');
    assert.match(url, /^https:\/\/test-supabase\.example\.invalid\/rest\/v1\//);
    if (url.includes('plp_bookings')) return Response.json([booking]);
    if (url.includes('plp_payments')) return Response.json([payment]);
    throw new Error('A provider capture must never be attempted');
  });
  const response = { headers:{}, setHeader(k,v){this.headers[k]=v;},end(){this.ended=true;return this;} };
  await captureHandler({ method:'GET',headers:{},query:{bookingRef:ref,token:'ATTACKERORDER123456'}},response);
  assert.equal(response.statusCode,302);
  assert.match(response.headers.Location,/reason=payment-needs-review/);
  assert.equal(response.headers['Cache-Control'],'no-store');
  assert.equal(mock.mock.callCount(),2);
});

test('checkout creation rejects expired or terminal reservation holds before contacting PayPal', () => {
  assert.equal(isCheckoutAllowed({ status:'PAYMENT_PROCESSING', payment_status:'PROCESSING', expires_at:'2026-11-23T00:00:00Z' }, now), true);
  assert.equal(isCheckoutAllowed({ status:'PAYMENT_PROCESSING', payment_status:'PROCESSING', expires_at:'2026-11-21T00:00:00Z' }, now), false);
  assert.equal(isCheckoutAllowed({ status:'CANCELLED', payment_status:'PENDING' }, now), false);
  assert.equal(isCheckoutAllowed({ status:'PAID_DEPOSIT', payment_status:'SUCCEEDED' }, now), false);
});

test('guest checkout retries reuse persisted reservation and canonical PayPal endpoint', () => {
  const bookingScript = readFileSync(new URL('../src/booking.js', import.meta.url),'utf8');
  assert.match(bookingScript, /let booking = pendingBooking/);
  assert.match(bookingScript, /if \(!booking\) \{\s*const response = await fetch\('\/api\/bookings'/);
  assert.match(bookingScript, /pendingBooking = booking;/);
  assert.match(bookingScript, /fetch\('\/api\/paypal\/create-session'/);
  assert.doesNotMatch(bookingScript, /fetch\('\/api\/xendit\/create-session'/);
});
