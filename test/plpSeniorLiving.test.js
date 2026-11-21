import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inquiryContext } from '../lib/guest-journey.js';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('future senior living has a real deep link and route-specific metadata', () => {
  const config = JSON.parse(source('vercel.json'));
  for (const route of ['/senior-living', '/senior-living/']) {
    assert.equal(config.rewrites.find(item => item.source === route)?.destination, '/senior-living.html');
  }
  assert.match(source('lib/public-routes.js'), /'senior-living': '\/senior-living'/);
  assert.match(source('src/App.jsx'), /case 'senior-living': return <SeniorLivingView\/>/);
  assert.match(source('src/ClubView.jsx'), /href="\/senior-living"/);
  assert.match(source('public/sitemap.xml'), /https:\/\/plp-boracay\.vercel\.app\/senior-living/);
  assert.match(source('scripts/audit-plp-routes.mjs'), /'\/senior-living'/);
});

test('senior living is a concept with separate residential admission and no payment promises', () => {
  const page = source('src/SeniorLivingView.jsx');
  assert.match(page, /Membership first\. Admission separately\./);
  assert.match(page, /Dr\. Marichi Fong Ramos has proposed/);
  assert.match(page, /Her proposal outlines a possible pathway/);
  assert.match(page, /club membership does not guarantee a residential place/);
  assert.match(page, /Residential accommodation and medical care are not yet available/);
  assert.match(page, /Residential accommodation, healthcare services and residential prices require separate authorization/);
  assert.match(page, /do not submit medical records, diagnoses or other sensitive health details/);
  assert.doesNotMatch(page, /SGD\s*6,?000|guaranteed refund|payment checkout/i);
});

test('residential interest uses existing authorized Boracay club enquiry, not new medical intake', () => {
  const page = source('src/SeniorLivingView.jsx');
  const concierge = source('src/ConciergeView.jsx');
  assert.match(page, /topic=club&amp;purpose=residential-interest/);
  assert.deepEqual(inquiryContext('?topic=club&purpose=residential-interest'), { topic: 'club', program: '', room: '' });
  assert.match(concierge, /residentialInterest.*residential-interest/);
  assert.match(concierge, /not a residential application, reservation or membership approval/);
  assert.match(concierge, /do not include medical records, diagnoses or sensitive health information/);
});
