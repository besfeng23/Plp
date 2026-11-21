import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import plpHandler from '../api/plp.js';
import leadsHandler from '../api/leads.js';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const redirects = JSON.parse(source('vercel.json')).redirects;

function response() {
  return {
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end(text) { this.body = JSON.parse(text); },
  };
}

test('unpublished Club routes temporarily redirect to the main PLP homepage', () => {
  for (const path of ['/club', '/club/', '/club.html', '/club/index.html', '/club/:path*']) {
    const route = redirects.find(item => item.source === path);
    assert.ok(route, 'Missing Club redirect: ' + path);
    assert.equal(route.destination, '/', path);
    assert.equal(route.permanent, false, 'Never make unpaid Club redirect permanent');
  }
  const vercel = JSON.parse(source('vercel.json'));
  assert.ok(!vercel.rewrites.some(item => item.source === '/club' || item.source === '/club/'));
});

test('Club is absent from all public marketing entry points, while project files remain intact', () => {
  const html = source('src/HomeView.jsx');
  const app = source('src/App.jsx');
  const route = source('lib/public-routes.js');
  const concierge = source('src/ConciergeView.jsx');
  const admin = source('src/admin/PlpEnterpriseAdminApp.jsx');
  for (const path of ['public/accommodation.html','public/experiences.html']) {
    assert.ok(!source(path).includes('href="/club"'),path);
  }
  assert.ok(!html.includes('plp-club-home'));
  assert.ok(!app.includes('ClubView') && !app.includes("['club', 'PLP Club']"));
  assert.ok(!route.includes("club: '/club'"));
  assert.ok(!route.includes("club: ['PLP Club"));
  assert.ok(!concierge.includes('Club team'));
  assert.ok(!concierge.includes('CLUB_PROGRAMS'));
  assert.ok(concierge.includes("original.topic.startsWith('club')"));
  assert.ok(!admin.includes('ClubAdminView'));
  assert.ok(!admin.includes("id: 'club'"));
  assert.ok(!source('public/sitemap.xml').includes('/club'));
  assert.ok(source('public/robots.txt').includes('Disallow: /club'));
  // Freeze, never delete: enable by reverting this temporary release on authorized payment.
  assert.ok(source('src/ClubView.jsx').includes('club-future') || source('src/ClubView.jsx').includes('plp-future-chapter'));
  assert.ok(source('src/admin/ClubAdminView.jsx').includes('clubRequest'));
  assert.ok(source('lib/club-handler.js').includes('recordAttendance'));
});

test('public and staff Club API actions are inaccessible during the unpaid hold', async () => {
  for (const operation of ['activities','members','admin-activities','attendance']) {
    for (const method of ['GET','POST']) {
      const res = response();
      await plpHandler({ method, query: { action: 'club', operation }, headers: { 'x-plp-staff-code': 'synthetic-only' } }, res);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body.error, 'Not found');
      assert.equal(res.headers['Cache-Control'], 'no-store');
    }
  }
});

test('Club-specific leads cannot be submitted while ordinary concierge remains available', async () => {
  for (const topic of ['club','club-activity']) {
    for (const channel of ['desk','email']) {
      const res = response();
      await leadsHandler({ method:'POST', body:{ topic,channel,name:'Synthetic',email:'test@example.invalid',interest:'Club' } },res);
      assert.equal(res.statusCode,404);
      assert.equal(res.body.error,'Not found');
    }
  }
  // Must continue reaching normal validation and not be rejected as Club.
  const ordinary = response();
  await leadsHandler({method:'POST',body:{topic:'stay',channel:'email'}},ordinary);
  assert.equal(ordinary.statusCode,400);
});
