import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const clubPage = readFileSync(new URL('../src/ClubView.jsx', import.meta.url), 'utf8');

test('Singapore is presented as a planned venue, not an active PLP partnership', () => {
  assert.match(clubPage, /Singapore · Planned chapter/);
  assert.match(clubPage, /Changi Beach Club/);
  assert.match(clubPage, /2 Andover Road, Singapore 509984/);
  assert.match(clubPage, /No PLP–Changi Beach Club partnership, event schedule, or facility access is confirmed/);
  assert.match(clubPage, /Changi Beach Club has its own separate membership program/);
  assert.doesNotMatch(clubPage, /Join (?:the )?Singapore|Book Singapore/);
});

test('Boracay is still the only chapter with a public activity calendar', () => {
  assert.match(clubPage, /Boracay · Local time/);
  assert.match(clubPage, /operation=activities/);
  assert.match(clubPage, /Boracay first\. More chapters later\./);
});
