import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../supabase/migrations/20261121014500_fix_plp_booking_generated_guest_email.sql', import.meta.url), 'utf8');
const api = readFileSync(new URL('../api/bookings.js', import.meta.url), 'utf8');

test('booking RPC never attempts to insert into GENERATED ALWAYS normalized_email', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION plp_runtime\.create_booking_atomic\(p_booking jsonb\)/);
  assert.match(sql, /insert into plp_runtime\.plp_guests\(full_name,email,phone\)/);
  assert.doesNotMatch(sql, /insert into plp_runtime\.plp_guests\([^)]*normalized_email/i);
  assert.match(sql, /on conflict \(normalized_email\) do update/);
  assert.match(sql, /returning \* into v_guest/);
  assert.doesNotMatch(sql, /\bSECURITY DEFINER\b/);
});

test('booking price, inventory and deposit safety constraints remain intact', () => {
  assert.match(sql, /v_rate <> v_accommodation\.nightly_rate_php/);
  assert.match(sql, /v_total <> v_nights \* v_accommodation\.nightly_rate_php/);
  assert.match(sql, /v_deposit <> round\(v_total \* 0\.30\)/);
  assert.match(sql, /when exclusion_violation then/);
  assert.match(sql, /'PENDING_PAYMENT', 'PENDING'/);
  assert.match(api, /return res\.status\(409\)/);
});

test('unexpected booking persistence errors expose only a safe SQLSTATE to backend logs', () => {
  assert.match(api, /\^\[A-Z0-9\]\{5\}\$/);
  assert.match(api, /console\.error\('\[plp-booking\] unable to persist reservation request', \{ sqlState \}\)/);
  assert.match(api, /Your request could not be saved\. Please contact concierge\./);
  assert.doesNotMatch(api, /console\.error\([^)]*(?:body|payload|phone|email|error\.message)/i);
});
