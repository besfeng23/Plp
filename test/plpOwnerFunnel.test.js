import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUBLIC_ANALYTICS_EVENTS, safeAnalyticsEvent, safeAnalyticsPath } from '../lib/analytics-policy.js';
import { websiteInterestFunnel } from '../lib/owner-funnel.js';
import { hasLegacyStaffAccess } from '../lib/staff-access.js';
import plpHandler from '../api/plp.js';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function response() {
  return {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

test('no consent, unknown pages, query strings and contact identifiers are never analytics events', () => {
  assert.equal(safeAnalyticsPath('/senior-living/'), '/senior-living');
  for (const path of [
    '/contact?email=guest%40example.test', '/booking#reference', 'https://plp-boracay.vercel.app/club',
    '/admin', '/api/plp', '//evil.example/', '/club%3Femail%3Dme', '/club\\fake',
  ]) assert.equal(safeAnalyticsPath(path), null, path);
  const legit = safeAnalyticsEvent({ privacyConsent: true, event: 'submit_residential_interest', path: '/senior-living',
    name: 'Never store', email: 'visitor@example.test', payload: { diagnosis: 'Never store' }, sessionId: 'Never store' });
  assert.deepEqual(legit, { event_name: 'submit_residential_interest', page_path: '/senior-living' });
  assert.equal(safeAnalyticsEvent({ event: 'view_page', path: '/club' }), null);
  assert.equal(safeAnalyticsEvent({ privacyConsent: false, event: 'view_page', path: '/club' }), null);
  assert.equal(safeAnalyticsEvent({ privacyConsent: true, event: 'view_page', path: '/club?name=personal' }), null);
  assert.equal(safeAnalyticsEvent({ privacyConsent: true, event: 'send_email', path: '/club' }), null);
  assert.ok(PUBLIC_ANALYTICS_EVENTS.has('submit_club_enquiry'));
});

test('unconsented public analytics requests do not call storage or echo private details', async () => {
  const res = response();
  await plpHandler({ method: 'POST', query: { action: 'analytics' }, headers: {}, body: {
    event: 'view_page', path: '/club?email=private@example.test', privacyConsent: true,
  } }, res);
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.stored, false);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.doesNotMatch(JSON.stringify(res.body), /private@example/);
});

test('owner funnel aggregates real event rows only within the Manila monthly window', async () => {
  const data = [
    { event_name: 'view_page' }, { event_name: 'view_page' },
    { event_name: 'click_reserve' }, { event_name: 'start_booking' },
    { event_name: 'booking_created' }, { event_name: 'submit_enquiry' },
    { event_name: 'submit_club_enquiry' }, { event_name: 'submit_residential_interest' },
  ];
  let calls = 0;
  const report = await websiteInterestFunnel('2026-11', async (table, raw) => {
    calls += 1;
    assert.equal(table, 'plp_analytics_events');
    const q = new URLSearchParams(raw);
    assert.deepEqual(q.getAll('created_at'), ['gte.2026-10-31T16:00:00.000Z', 'lt.2026-11-30T16:00:00.000Z']);
    assert.equal(q.get('select'), 'event_name');
    assert.equal(q.get('payload->>collection'), 'eq.plp_consent_v2');
    assert.equal(q.get('limit'), '500');
    assert.equal(q.get('offset'), '0');
    return data;
  });
  assert.equal(calls, 1);
  assert.deepEqual(report, { month: '2026-11', complete: true, scanned: 8,
    metrics: { pageViews: 2, reserveClicks: 1, bookingStarts: 1,
      bookingSubmits: 0, bookingRequestsRecorded: 1, enquiriesSent: 1,
      clubEnquiriesSent: 1, residentialInterestsSent: 1 } });
});

test('owner funnel never represents a capped partial read as final counts', async () => {
  let count = 0;
  const report = await websiteInterestFunnel('2026-11', async () => {
    count += 1;
    return Array.from({ length: 500 }, () => ({ event_name: 'view_page' }));
  });
  assert.equal(count, 20);
  assert.equal(report.complete, false);
  assert.equal(report.metrics, null);
  assert.equal(report.scanned, 10000);
});

test('legacy staff code uses exact, bounded, constant-time comparison', () => {
  const expected = 'test-only-staff-code';
  assert.equal(hasLegacyStaffAccess({ headers: { 'x-plp-staff-code': expected } }, expected), true);
  assert.equal(hasLegacyStaffAccess({ headers: { 'x-plp-staff-code': expected.toUpperCase() } }, expected), false);
  assert.equal(hasLegacyStaffAccess({ headers: { 'x-plp-staff-code': expected + '!' } }, expected), false);
  assert.equal(hasLegacyStaffAccess({ headers: { 'x-plp-staff-code': [expected] } }, expected), false);
  assert.equal(hasLegacyStaffAccess({ headers: { 'x-plp-staff-code': 'x'.repeat(257) } }, expected), false);
  assert.equal(hasLegacyStaffAccess({ headers: {} }, expected), false);
});

test('public tracker requires affirmative consent and transmits no form or health fields', () => {
  const script = source('public/analytics.js');
  assert.match(script, /'\/senior-living'/);
  assert.match(script, /privacyConsent: true/);
  assert.match(script, /if \(consent !== 'allow' \|\| !config \|\| !path\) return/);
  assert.match(script, /body: JSON\.stringify\(\{ event: category, path, privacyConsent: true \}\)/);
  assert.match(source('src/ConciergeView.jsx'), /'submit_residential_interest'/);
  assert.match(source('src/booking.js'), /track\('booking_created'\)/);
  assert.match(source('src/admin/PlpEnterpriseAdminApp.jsx'), /<OwnerFunnel code=\{code\}/);
});
