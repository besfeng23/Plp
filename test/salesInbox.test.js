import test from 'node:test';
import assert from 'node:assert/strict';
import { inquiryMailReady, inquiryRecipient, sendInquiryAlert } from '../lib/inquiry-alert.js';

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function withEnv(t, values) {
  const keys = Object.keys(values);
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test('inquiry alerts prefer LEADS_TO_EMAIL then BOOKINGS_TO_EMAIL', () => {
  const env = { LEADS_TO_EMAIL: 'leads@example.invalid', BOOKINGS_TO_EMAIL: 'bookings@example.invalid', PLP_ADMIN_EMAIL: 'admin@example.invalid' };
  assert.equal(inquiryRecipient(env), 'leads@example.invalid');
  assert.equal(inquiryRecipient({ BOOKINGS_TO_EMAIL: 'bookings@example.invalid', PLP_ADMIN_EMAIL: 'admin@example.invalid' }), 'bookings@example.invalid');
  assert.equal(inquiryRecipient({ PLP_ADMIN_EMAIL: 'not-an-email' }), '');
  assert.equal(inquiryMailReady({ RESEND_API_KEY: 're_test', LEADS_FROM_EMAIL: 'from@example.invalid', LEADS_TO_EMAIL: 'leads@example.invalid' }), true);
  assert.equal(inquiryMailReady({ RESEND_API_KEY: 're_test', LEADS_FROM_EMAIL: 'from@example.invalid' }), false);
});

test('sendInquiryAlert posts once to Resend when configured', async t => {
  const env = { RESEND_API_KEY: 're_test', LEADS_FROM_EMAIL: 'from@example.invalid', LEADS_TO_EMAIL: 'leads@example.invalid' };
  const outgoing = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(body.to, ['leads@example.invalid']);
    assert.equal(body.reply_to, 'guest@example.invalid');
    assert.match(body.subject, /Sunset Suite/);
    return { ok: true };
  });
  assert.equal(await sendInquiryAlert({ name: 'Guest', email: 'guest@example.invalid', interest: 'Sunset Suite', message: 'Dates in May.' }, env), true);
  assert.equal(outgoing.mock.callCount(), 1);
});

test('staff can advance an enquiry and save a follow-up without a new function file', async t => {
  withEnv(t, { SUPABASE_URL: 'https://desk.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-fixture' });
  const { staffEnquiries } = await import('../lib/concierge-desk.js');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), method: options.method, body: options.body ? JSON.parse(options.body) : null });
    if (options.method === 'PATCH') return Response.json([{ id: ID, status: 'CONTACTED', assignee: 'Argie', follow_up_on: '2026-12-01' }]);
    return Response.json([]);
  });
  const [okStatus, ok] = await staffEnquiries('PATCH', { id: ID, previous: 'NEW', status: 'CONTACTED', assignee: 'Argie', follow_up_on: '2026-12-01' });
  assert.equal(okStatus, 200);
  assert.equal(ok.row.status, 'CONTACTED');
  assert.equal(calls[0].method, 'PATCH');
  assert.match(calls[0].url, /plp_concierge_enquiries/);
  assert.equal(calls[0].body.status, 'CONTACTED');
  assert.equal(calls[0].body.assignee, 'Argie');
  assert.equal(calls[0].body.follow_up_on, '2026-12-01');

  const [bad] = await staffEnquiries('PATCH', { id: ID, previous: 'NEW', status: 'IN_PROGRESS' });
  assert.equal(bad, 400);
  const [due] = await staffEnquiries('PATCH', { id: ID, previous: 'CONTACTED', status: 'CONTACTED', follow_up_on: 'tomorrow' });
  assert.equal(due, 400);
});

test('a new desk enquiry alerts once and a retry with the same receipt does not resend', async t => {
  withEnv(t, {
    SUPABASE_URL: 'https://desk.example.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'test-fixture',
    RESEND_API_KEY: 're_test',
    LEADS_FROM_EMAIL: 'from@example.invalid',
    LEADS_TO_EMAIL: 'leads@example.invalid',
  });
  const { receiveEnquiry } = await import('../lib/concierge-desk.js');
  let alerted = false;
  const emails = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const href = String(url);
    if (href.includes('/rpc/receive_concierge_enquiry')) return Response.json(ID);
    if (href.includes('api.resend.com')) {
      emails.push(JSON.parse(options.body));
      return { ok: true };
    }
    if (href.includes('plp_concierge_enquiries') && (!options.method || options.method === 'GET')) {
      return Response.json([{ id: ID, alerted_at: alerted ? '2026-11-24T00:00:00.000Z' : null }]);
    }
    if (options.method === 'PATCH') {
      alerted = true;
      return Response.json([{ id: ID, alerted_at: '2026-11-24T00:00:00.000Z' }]);
    }
    throw new Error('unexpected ' + href);
  });
  const request = { requestId: ID, topic: 'stay', name: 'Guest', email: 'guest@example.invalid', message: 'May dates please.' };
  const first = await receiveEnquiry(request);
  assert.equal(first[0], 200);
  assert.equal(first[1].received, true);
  assert.equal(first[1].emailDelivered, true);
  const second = await receiveEnquiry(request);
  assert.equal(second[1].received, true);
  assert.equal(second[1].emailDelivered, true);
  assert.equal(emails.length, 1);
});
