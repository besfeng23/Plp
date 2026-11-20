import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calendarFile } from '../lib/club-calendar.js';
import { inquiryContext, requestedGuests } from '../lib/guest-journey.js';
import { monthBounds, websiteBookingMonth } from '../lib/owner-month.js';
import clubHandler from '../lib/club-handler.js';
import leads from '../api/leads.js';

function response() {
  return {
    headers: {},
    setHeader(key,value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end(text) { this.body = JSON.parse(text); },
  };
}

test('only catalog rooms and public topic or activity choices prefill an enquiry', () => {
  assert.deepEqual(inquiryContext('?topic=club-activity&program=culture'), { topic: 'club-activity', program: 'culture', room: '' });
  assert.deepEqual(inquiryContext('?topic=constructor&program=island&room=not-a-room'), { topic: 'stay', program: '', room: '' });
  assert.equal(inquiryContext('?room=sunset-suite').room, 'sunset-suite');
});

test('booking handoff preserves a valid guest count within the selected room capacity', () => {
  assert.equal(requestedGuests('4', 4), 4);
  for (const input of [null, '', '0', '-1', '2.5', '5', '2x', '100000000000000000']) assert.equal(requestedGuests(input, 4), null);
});

test('public experience and room entries carry their context to concierge', () => {
  const source = file => readFileSync(new URL('../public/' + file, import.meta.url), 'utf8');
  const experiences = source('experiences.html');
  for (const topic of ['water', 'wellness', 'dining']) assert.ok(experiences.includes('/contact?topic=' + topic));
  const rooms = source('accommodation.html');
  for (const slug of ['grand-ocean-villa','sunset-suite','smart-room-premium']) assert.ok(rooms.includes('/contact?topic=stay&amp;room=' + slug));
});

test('published calendar download uses UTC, folds multibyte text and omits private fields', () => {
  const file = calendarFile({ id: 'activity-1', title: 'Coffee, music; friends', summary: 'é'.repeat(100) + '\nSecond line',
    starts_at: '2027-01-02T10:00:00+08:00', ends_at: '2027-01-02T11:00:00+08:00', location_note: 'Terrace', member_email: 'private@example.invalid' },
    new Date('2026-12-20T03:00:00Z'));
  assert.match(file, /DTSTART:20270102T020000Z/);
  assert.ok(file.includes('SUMMARY:Coffee\\, music\\; friends'));
  assert.ok(file.replace(/\r\n /g, '').includes('é'.repeat(100) + '\\nSecond line'));
  assert.ok(file.split('\r\n').every(line => Buffer.byteLength(line) <= 75));
  assert.doesNotMatch(file, /private@example/);
});

test('Manila reporting month uses exclusive boundaries across the year', () => {
  assert.deepEqual(monthBounds('2026-12'), { start: '2026-11-30T16:00:00.000Z', end: '2026-12-31T16:00:00.000Z' });
  for (const month of ['2026-13','2026-00','2026-2','bad',null]) assert.equal(monthBounds(month), null);
});

test('owner month pages past shortened provider results and excludes test and refunded confirmations', async () => {
  const pages = [
    [{id:'a',booking_reference:'QA-1',status:'CONFIRMED'}, {id:'b',accommodation_name:'Villa',status:'CONFIRMED'}],
    [{id:'c',accommodation_name:'Suite',status:'CHECKED_OUT'}, {id:'d',guest:{email:'someone@example.invalid'},status:'CONFIRMED'}],
    [{id:'e',accommodation_name:'Villa',status:'CONFIRMED',payment_status:'REFUNDED'}, {id:'f',accommodation_name:'Villa',status:'PENDING_PAYMENT'}], [],
  ];
  const cursors = [];
  const report = await websiteBookingMonth('2026-12', async (table, raw) => {
    assert.equal(table, 'plp_bookings');
    const query = new URLSearchParams(raw);
    assert.equal(query.get('source'), 'eq.website');
    assert.deepEqual(query.getAll('created_at'), ['gte.2026-11-30T16:00:00.000Z','lt.2026-12-31T16:00:00.000Z']);
    cursors.push(query.get('id'));
    return pages.shift();
  });
  assert.deepEqual(cursors, [null,'gt.b','gt.d','gt.f']);
  assert.deepEqual(report, {requests:4,confirmed:2,closed:1,other:1,rooms:[{name:'Villa',requests:3},{name:'Suite',requests:1}]});
});

test('attendance read and write are staff-only', async () => {
  for (const method of ['GET','POST']) {
    const res = response();
    await clubHandler({ method, headers:{}, query:{ operation:'attendance' } }, res);
    assert.equal(res.statusCode,403);
    assert.equal(res.headers['Cache-Control'],'no-store');
    assert.equal(res.body.attendees,undefined);
  }
});

test('concierge enquiry offers email draft mode without a configured sender', async t => {
  const original = process.env.LEADS_FROM_EMAIL;
  t.after(() => { if (original !== undefined) process.env.LEADS_FROM_EMAIL=original; else delete process.env.LEADS_FROM_EMAIL; });
  delete process.env.LEADS_FROM_EMAIL;
  const res = response(); await leads({method:'GET'},res);
  assert.deepEqual(res.body,{available:false});
  assert.equal(res.headers['Cache-Control'],'no-store');
  const post = response(); await leads({method:'POST',body:{name:'Test',email:'guest@example.invalid',interest:'Club'}},post);
  assert.equal(post.statusCode,503); assert.equal(post.body.emailDelivered,false);
});

test('concierge accepts a real send only on provider acceptance and reuses the submission identity', async t => {
  const before = { RESEND_API_KEY:process.env.RESEND_API_KEY, LEADS_FROM_EMAIL:process.env.LEADS_FROM_EMAIL };
  t.after(() => { for (const [key,value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key]=value; } });
  process.env.RESEND_API_KEY='test'; process.env.LEADS_FROM_EMAIL='sender@example.invalid';
  let captured;
  const outgoing = t.mock.method(globalThis,'fetch',async (_,options) => { captured=options; return {ok:true}; });
  const request = {method:'POST',body:{name:'Guest',email:'guest@example.invalid',interest:'PLP Club',requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}};
  const res = response(); await leads(request,res);
  assert.equal(res.body.emailDelivered,true);
  assert.equal(captured.headers['Idempotency-Key'],'plp-enquiry/' + request.body.requestId);
  assert.equal(JSON.parse(captured.body).reply_to,request.body.email);
  outgoing.mock.mockImplementation(async () => ({ok:false}));
  const failed=response(); await leads(request,failed);
  assert.equal(failed.statusCode,503); assert.equal(failed.body.ok,false);
});

test('desk intake rejects invalid topics and missing messages before contacting storage', async () => {
  for (const fields of [{topic:'singapore'},{message:'  '},{requestId:'bad'},{email:'invalid'},{name:'x'.repeat(121)}]) {
    const res=response();
    await leads({method:'POST',body:{requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',channel:'desk',topic:'club',
      name:'Test',email:'test@example.invalid',message:'Please explain the pilot.',...fields}},res);
    assert.equal(res.statusCode,400);
    assert.equal(res.body.received,undefined);
  }
});

test('the staff inbox and owner report use the existing authentication gate', async () => {
  const { default: admin } = await import('../api/admin.js');
  for (const [action,method] of [['concierge-inbox','GET'],['concierge-inbox','PATCH'],['owner-month','GET']]) {
    const res=response(); await admin({method,query:{action},headers:{}},res);
    assert.equal(res.statusCode,401);assert.equal(res.body.rows,undefined);
  }
});
