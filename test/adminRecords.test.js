import test from 'node:test';
import assert from 'node:assert/strict';
import { isTestRecord, recordMoney, totalsByCurrency } from '../lib/admin-records.js';
import { summarizeRecords } from '../src/admin/plpAdminModel.js';

test('only explicit test markers classify a reservation as a test', () => {
  for (const row of [{ booking_reference: 'MOCK-PLP-001' }, { guest_email: 'qa@example.invalid' }, { is_test: true }, { subject: '[MOCK QA] Arrival' }]) assert.equal(isTestRecord(row), true);
  for (const row of [{ booking_reference: 'PLP-TESTER' }, { guest_name: 'Testa' }, { guest_email: 'jane@example.com' }, {}]) assert.equal(isTestRecord(row), false);
});

test('business counts and amounts exclude test fixtures even when loaded for inspection', () => {
  const base = { booking_status: 'CONFIRMED', payment_verification_status: 'VERIFIED', payment_currency: 'USD', total_amount_php: 1000, deposit_amount_php: 300, check_in: '2026-11-17', check_out: '2026-11-18' };
  const summary = summarizeRecords([{ ...base, booking_reference: 'MOCK-PLP-1', total_amount_php: 240000 }, { ...base, booking_reference: 'PLP-1' }], [{ reference: 'MOCK-PLP-1' }], [{ notification_key: 'MOCK-notification' }], [], '2026-11-17');
  assert.equal(summary.arrivals.length, 1);
  assert.equal(summary.inHouse.length, 1);
  assert.equal(summary.exceptionCount, 0);
  assert.equal(summary.notificationCount, 0);
  assert.deepEqual(summary.confirmedTotals, [{ currency: 'USD', amount: 1000 }]);
  assert.deepEqual(summary.depositTotals, [{ currency: 'USD', amount: 300 }]);
});

test('historical currencies stay separate and missing currency is not relabelled as dollars', () => {
  const totals = totalsByCurrency([{ currency: 'PHP', amount: 1500 }, { payment_currency: 'USD', amount: 25.5 }, { currency: 'USD', amount: 10 }, { amount: 8 }], row => row.amount);
  assert.deepEqual(totals, [{ currency: '', amount: 8 }, { currency: 'PHP', amount: 1500 }, { currency: 'USD', amount: 35.5 }]);
  assert.match(recordMoney(25.5, { currency: 'USD' }), /USD.*25\.50/);
  assert.match(recordMoney(1500, { currency: 'PHP' }), /PHP.*1,500\.00/);
  assert.equal(recordMoney(8), '8 (currency not recorded)');
  assert.equal(recordMoney(null, { currency: 'USD' }), '—');
  assert.match(recordMoney(0, { currency: 'USD' }), /USD.*0\.00/);
});
