import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('PLP editorial home retains booking, room discovery, and real property image references', () => {
  const home = source('src/HomeView.jsx');
  for (const path of ['/booking', '#find-your-stay', '/gallery', '/club', '/contact?topic=arrival']) {
    assert.ok(home.includes(path), 'missing homepage journey: ' + path);
  }
  for (const asset of ['plp-pool-ocean-view.webp', 'plp-private-breakfast-pool.webp']) {
    assert.ok(home.includes(asset), 'missing property photograph: ' + asset);
  }
  assert.match(home, /data-content-key="homepage\.heroTitle"/);
  assert.match(home, /data-content-key="homepage\.primaryCta"/);
});

test('room finder preserves the room and guest count handoff and larger group concierge', () => {
  const stay = source('src/StayFinder.jsx');
  assert.ok(stay.includes("'&guests=' + party"));
  assert.ok(stay.includes("'/booking?room=' + room.slug"));
  assert.ok(stay.includes('/contact?topic=group'));
  assert.ok(stay.includes('room.capacity >= Number(party)'));
  assert.ok(stay.includes('aria-label'));
});

test('PLP Club photographic program cards remain enquiries, never automatic registration', () => {
  const club = source('src/ClubView.jsx');
  for (const key of ['connection', 'wellbeing', 'culture', 'island']) assert.ok(club.includes("key: '" + key + "'"));
  assert.ok(club.includes('/contact?topic=club-activity&program='));
  assert.ok(club.includes('not confirmed events or benefits'));
  assert.ok(club.includes('Attendance is not automatically confirmed.'));
  assert.ok(club.includes('alt={item.imageAlt}'));
});

test('guest and admin presentation respect mobile screens and reduced motion', () => {
  const guest = source('src/index.css');
  const app = source('src/App.jsx');
  const admin = source('src/admin/plp-enterprise-admin.css');
  const adminApp = source('src/admin/PlpEnterpriseAdminApp.jsx');
  assert.ok(guest.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(guest.includes('.plp-mobile-action__inner'));
  assert.ok(guest.includes('@media (max-width: 430px)'));
  assert.ok(app.includes("target='booking'"));
  assert.ok(app.includes("target='contact'"));
  assert.ok(admin.includes('.plp-today-board'));
  assert.ok(adminApp.includes('aria-label="Today\'s operating picture"'));
  assert.ok(adminApp.includes("summary.arrivals.length"));
  assert.ok(adminApp.includes('summary.exceptionCount'));
});
