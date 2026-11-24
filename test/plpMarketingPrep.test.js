import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { MARKETING_PHASES, PROMO_VIDEO_BEATS } from '../src/admin/adminNavigation.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('90-day plan and promo brief exist as repo docs and on Growth & Marketing', () => {
  assert.ok(existsSync(new URL('../docs/plp-90-day-marketing-plan.md', import.meta.url)));
  assert.ok(existsSync(new URL('../docs/plp-promo-video-brief.md', import.meta.url)));
  const plan = read('docs/plp-90-day-marketing-plan.md');
  const brief = read('docs/plp-promo-video-brief.md');
  assert.match(plan, /Days 1–30/);
  assert.match(plan, /Days 31–60/);
  assert.match(plan, /Days 61–90/);
  assert.match(plan, /Still private/);
  assert.match(plan, /no automatic public activation/i);
  assert.match(plan, /Do not recruit or onboard external affiliates while unlicensed/);
  assert.match(plan, /Do not publish, boost or run ads/);
  assert.doesNotMatch(plan, /e-mango|behance|images\.openai\.com/i);
  assert.match(brief, /00–10 sec/);
  assert.match(brief, /10–25 sec/);
  assert.match(brief, /25–40 sec/);
  assert.match(brief, /40–53 sec/);
  assert.match(brief, /53–60 sec/);
  assert.match(brief, /not a public booking CTA/i);
  assert.match(brief, /authorized, genuine footage/i);
  assert.doesNotMatch(brief, /behance|images\.openai\.com|stock photo|stock footage/i);
  assert.doesNotMatch(brief, /e-mango/i);

  assert.deepEqual(MARKETING_PHASES.map(item => item.id), ['days-1-30', 'days-31-60', 'days-61-90']);
  assert.deepEqual(PROMO_VIDEO_BEATS.map(item => item.id), ['setting', 'accommodations', 'experience', 'atmosphere', 'finish']);
  assert.match(MARKETING_PHASES[1].detail, /No public posts, ads or external affiliate recruitment/);
  assert.match(PROMO_VIDEO_BEATS[4].detail, /not a public booking CTA/);

  const app = read('src/admin/PlpAdminApp.jsx');
  assert.match(app, /MARKETING_PHASES/);
  assert.match(app, /PROMO_VIDEO_BEATS/);
  assert.match(app, /90-day marketing preparation/);
  assert.match(app, /Promo video brief/);

  for (const page of ['index.html', 'booking.html', 'public/accommodation.html', 'affiliate.html', 'public/private-preview.html']) {
    const html = read(page);
    assert.doesNotMatch(html, /90-day marketing preparation/);
    assert.doesNotMatch(html, /00–10 sec — The setting/);
  }
});
