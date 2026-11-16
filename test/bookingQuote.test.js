import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nightsBetween, shiftMonth, todayAtResort } from '../lib/booking-dates.js';
import { PLP_ROOMS, quoteStay } from '../lib/pricing.js';

test('all booking surfaces use the same PHP rates and 30% deposit calculation', () => {
  assert.deepEqual(PLP_ROOMS.map(room => quoteStay(room, 1)), [
    { amount: 80000, deposit: 24000, balance: 56000 },
    { amount: 60000, deposit: 18000, balance: 42000 },
    { amount: 40000, deposit: 12000, balance: 28000 },
  ]);
  assert.deepEqual(quoteStay(PLP_ROOMS[0], 3), { amount: 240000, deposit: 72000, balance: 168000 });
});

test('the booking day follows Boracay time and invalid calendar dates fail validation', () => {
  assert.equal(todayAtResort(new Date('2026-12-31T16:00:00Z')), '2027-01-01');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(nightsBetween('2026-02-29', '2026-03-02'), 0);
  assert.equal(nightsBetween('2028-02-29', '2028-03-02'), 2);
});

function runRequest(handler, request) {
  const result = { headers: {} };
  return handler(request, {
    setHeader(name, value) { result.headers[name] = value; },
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; },
  }).then(() => result);
}

test('public calendar discloses occupied nights only and distinguishes outages from conflicts', async t => {
  const legacyUrl = process.env.SUPABASE_URL;
  const dedicatedUrl = process.env.plp_SUPABASE_URL;
  const dedicatedServiceKey = process.env.plp_SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://legacy.invalid';
  process.env.plp_SUPABASE_URL = 'https://dedicated.invalid';
  process.env.plp_SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  t.after(() => {
    for (const [key, original] of [
      ['SUPABASE_URL', legacyUrl],
      ['plp_SUPABASE_URL', dedicatedUrl],
      ['plp_SUPABASE_SERVICE_ROLE_KEY', dedicatedServiceKey],
    ]) {
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  });

  const { default: handler } = await import('../api/check-availability.js');
  const { default: bookings } = await import('../api/bookings.js');
  let offline = false;
  const month = String(Number(todayAtResort().slice(0, 4)) + 1) + '-01';
  const nextMonth = shiftMonth(month, 1);
  const previousMonth = shiftMonth(month, -1);
  const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(new URL(url).origin, 'https://dedicated.invalid');
    assert.equal(options.headers['Accept-Profile'], 'plp_runtime');
    assert.equal(options.method, 'GET');
    if (offline) throw new Error('upstream unavailable');
    if (url.includes('/plp_accommodations?')) {
      return Response.json([{ id: 'test-room', name: 'Grand Ocean Villa', is_active: true }]);
    }
    if (url.includes('/plp_active_booking_holds?')) {
      const match = /\bselect=([^&]+)/.exec(url);
      if (match[1] !== '*') assert.equal(match[1], 'check_in,check_out');
      return Response.json([{ check_in: previousMonth + '-28', check_out: month + '-03', booking_reference: 'private' }]);
    }
    assert.match(url, /\/plp_active_blocked_dates\?/);
    return Response.json([{ start_date: month + '-30', end_date: nextMonth + '-02', reason: 'private' }]);
  });

  const calendar = await runRequest(handler, { method: 'GET', query: { room: 'grandOceanVilla', month } });
  assert.equal(calendar.status, 200);
  assert.equal(calendar.headers['Cache-Control'], 'no-store');
  const expectedNights = ['01', '02', '30', '31'].map(day => month + '-' + day);
  assert.deepEqual(calendar.body, { ok: true, room: 'grandOceanVilla', month, unavailableNights: expectedNights });

  const stay = { accommodation: 'Grand Ocean Villa', checkIn: month + '-01', checkOut: month + '-02' };
  const conflict = await runRequest(handler, { method: 'POST', body: stay });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.available, false);

  offline = true;
  const outage = await runRequest(handler, { method: 'GET', query: { room: 'grandOceanVilla', month } });
  assert.equal(outage.status, 503);
  assert.deepEqual(outage.body, { ok: false, error: 'Availability is temporarily unavailable.' });

  const calls = mock.mock.callCount();
  const stale = await runRequest(bookings, {
    method: 'POST',
    body: { ...stay, name: 'Example Guest', email: 'guest@example.test', phone: '000', guests: 2, quote: { amount: 300, deposit: 90 } },
  });
  assert.equal(stale.status, 409);
  assert.equal(mock.mock.callCount(), calls);
});
