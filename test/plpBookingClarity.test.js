// Completion wave A: plain USD 1,000 / 30% deposit copy, booking conversion polish,
// site-wide in-flow consent, and removal of the dead Exclusive Offer footer link.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONCIERGE_NUMBER, CONCIERGE_NUMBER_DISPLAY } from '../lib/contact.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('accommodation and booking state USD 1,000 and the 30% deposit, without provisional-rate language', () => {
  const rooms = read('public/accommodation.html');
  const booking = read('booking.html');
  for (const page of [rooms, booking]) {
    assert.match(page, /USD 1,000 per night/);
    assert.match(page, /30% deposit/);
    assert.doesNotMatch(page, /provisional|approved rate|rate details, deposit requirements|deposit may be required|deposit details confirmed|confirmed later/i);
  }
  assert.match(rooms, /amount charged at checkout is calculated by our server/);
  assert.match(booking, /amount charged always matches the server-calculated estimate/);
});

test('booking shows a room thumbnail, starts the current month at today, and uses the configured concierge number', () => {
  const html = read('booking.html');
  const js = read('src/booking.js');
  assert.match(html, /id="roomThumb"/);
  assert.match(js, /ROOM_THUMB\[selected\.key\]/);
  assert.match(js, /plp-grand-ocean-villa-aerial\.webp/);
  assert.match(js, /gridStart = month === firstMonth \? today/);
  assert.match(js, /occupiedNights\(gridStart, end\)/);
  assert.match(js, /date < today/);
  assert.ok(CONCIERGE_NUMBER && CONCIERGE_NUMBER.startsWith('+'), 'a real concierge number is already in site config');
  assert.match(html, new RegExp('tel:' + CONCIERGE_NUMBER.replace('+', '\\+')));
  assert.match(html, new RegExp('wa\\.me/' + CONCIERGE_NUMBER.replace(/\D/g, '')));
  assert.match(js, /CONCIERGE_NUMBER/);
  assert.match(js, /wa\.me\/' \+ phone/);
  assert.equal(CONCIERGE_NUMBER_DISPLAY, '+63 960 479 2247');
});

test('consent uses the booking in-flow layout on every page unless a page opts into a floating bar', () => {
  const js = read('public/analytics.js');
  assert.match(js, /dataset\.plpConsent !== 'float'/);
  assert.match(js, /policy\.before\(analyticsPanel\)/);
  assert.match(js, /footer\.before\(analyticsPanel\)/);
  assert.match(read('booking.html'), /<body data-plp-consent="inline">/);
  assert.match(read('public/analytics-consent.css'), /\[data-inline\] \{ position: static;/);
});

test('the public footer no longer links Exclusive Offer, and the static accommodation footer follows the React site', () => {
  const footer = read('src/App.jsx');
  const start = footer.indexOf('function PublicFooter');
  const explore = footer.slice(start, footer.indexOf('function MobileActionBar', start));
  assert.doesNotMatch(explore, /Exclusive Offer|vip-package/);
  assert.match(explore, /Getting Here/);
  const rooms = read('public/accommodation.html');
  assert.match(rooms, /footer-editorial/);
  assert.match(rooms, /href="\/gallery"/);
  assert.doesNotMatch(rooms, /Exclusive Offer/);
});
