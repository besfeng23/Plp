import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CONCIERGE_NUMBER_DISPLAY } from '../lib/contact.js';

test('Telegram arrival screen uses the approved concierge contact and honest map label', () => {
  const html = readFileSync(new URL('../public/tg/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes(CONCIERGE_NUMBER_DISPLAY));
  assert.doesNotMatch(html, /e-mango|mfr@/i);
  assert.match(html, /Boracay overview map/);
  assert.doesNotMatch(html, /concierge@plp\.com|\+63 917 123 4567|Replace with exact PLP pin/);
});
