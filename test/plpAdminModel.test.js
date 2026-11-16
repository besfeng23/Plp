import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bookingStatus, buildGuestRoster, manilaToday, needsStaffReview, summarizeRecords } from '../src/admin/plpAdminModel.js';

const today = '2026-11-16';
const booking = (reference, overrides = {}) => ({
  booking_reference: reference,
  guest_name: 'Jane Guest',
  guest_email: 'Jane@example.com',
  check_in: '2026-11-16',
  check_out: '2026-11-18',
  booking_status: 'PAID_DEPOSIT',
  payment_status: 'CAPTURED',
  payment_verification_status: 'VERIFIED',
  deposit_amount_php: 12000,
  total_amount_php: 40000,
  ...overrides,
});

test('verified deposit is never described as a confirmed stay', () => {
  assert.equal(bookingStatus('PAID_DEPOSIT'), 'Deposit verified · Awaiting confirmation');
  assert.equal(bookingStatus('CONFIRMED'), 'Confirmed');
  assert.equal(bookingStatus('unknown_status'), 'Review needed');
});

test('empty API result produces zero counts, not simulated reservations or revenue', () => {
  const summary = summarizeRecords([], [], [], [], today);
  assert.equal(summary.arrivals.length, 0);
  assert.equal(summary.inHouse.length, 0);
  assert.equal(summary.confirmedValue, 0);
  assert.equal(summary.verifiedDeposits, 0);
});

test('operations are based on actual stays, excluding cancelled reservations', () => {
  const rows = [booking('A'), booking('B', { booking_status: 'CANCELLED' }), booking('C', { check_in: '2026-11-14', check_out: '2026-11-16', booking_status: 'CONFIRMED' })];
  const summary = summarizeRecords(rows, [], [], [], today);
  assert.deepEqual(summary.arrivals.map((row) => row.booking_reference), ['A']);
  assert.deepEqual(summary.departures.map((row) => row.booking_reference), ['C']);
  assert.deepEqual(summary.inHouse.map((row) => row.booking_reference), []);
  assert.equal(summary.verifiedDeposits, 24000);
  assert.equal(summary.confirmedValue, 40000);
});

test('in-house excludes a merely paid deposit or pending request', () => {
  const summary = summarizeRecords([
    booking('A'),
    booking('B', { booking_status: 'CONFIRMED' }),
    booking('C', { booking_status: 'PENDING_PAYMENT' }),
  ], [], [], [], today);
  assert.deepEqual(summary.inHouse.map((row) => row.booking_reference), ['B']);
});

test('verified deposit remains on review queue until confirmed', () => {
  assert.equal(needsStaffReview(booking('A')), true);
  assert.equal(needsStaffReview(booking('B', { booking_status: 'CONFIRMED' })), false);
  assert.equal(needsStaffReview(booking('C', { booking_status: 'CONFIRMED', payment_verification_status: 'AMOUNT_MISMATCH' })), true);
});

test('guest roster groups by normalized email and preserves recorded requests', () => {
  const guests = buildGuestRoster([booking('A', { special_requests: 'Quiet room' }), booking('B', { guest_email: 'jane@EXAMPLE.com' })]);
  assert.equal(guests.length, 1);
  assert.equal(guests[0].reservations.length, 2);
  assert.equal(guests[0].requests[0].text, 'Quiet room');
});

test('the operational date uses Asia/Manila rather than server UTC', () => {
  assert.equal(manilaToday(new Date('2026-11-15T17:00:00Z')), '2026-11-16');
});

test('admin is private, checks server-side staff access, and never persists staff code in storage', () => {
  const admin = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/admin/PlpEnterpriseAdminApp.jsx', import.meta.url), 'utf8');
  const legacy = readFileSync(new URL('../public/admin-ops.html', import.meta.url), 'utf8');
  assert.match(admin, /noindex,nofollow/);
  assert.match(shell, /await adminRequest\('operations', codeToUse\)/);
  assert.match(legacy, /event.origin !== window.location.origin/);
  assert.match(legacy, /event.source !== window.parent/);
  assert.doesNotMatch(legacy, /localStorage\.(getItem|setItem)\('plp_staff_code'/);
  for (const script of ['reservation-360', 'admin-confirmation-workflow', 'guest-profile-360', 'concierge-queue', 'availability-board', 'admin-qa-polish', 'ota-channel-readiness', 'ota-sync-dry-run']) {
    assert.match(legacy, new RegExp(`<script src="/${script}\\.js"></script>`));
  }
});
