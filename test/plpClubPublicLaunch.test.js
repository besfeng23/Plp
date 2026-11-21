import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Club public routes are published, not redirected, and included in discoverability', () => {
  const vercel = JSON.parse(source('vercel.json'));
  for (const route of ['/club', '/club/']) {
    assert.equal(vercel.redirects.some(r => r.source === route), false, route + ' must not redirect away');
    assert.equal(vercel.rewrites.find(r => r.source === route)?.destination, '/club.html');
  }
  const routes = source('lib/public-routes.js');
  assert.match(routes, /club:\s*'\/club'/);
  assert.match(routes, /club:\s*\['PLP Club Boracay'/);
  assert.match(source('public/sitemap.xml'), /https:\/\/plp-boracay\.vercel\.app\/club/);
  assert.doesNotMatch(source('public/robots.txt'), /Disallow:\s*\/club(?:\s|$)/m);
});

test('Club is discoverable in public pages and available only via protected admin workflows', () => {
  const app = source('src/App.jsx');
  assert.match(app, /import ClubView from/);
  assert.match(app, /\['club', 'PLP Club'\]/);
  assert.match(app, /case 'club': return <ClubView\/>/);
  assert.match(source('src/HomeView.jsx'), /plp-club-home/);
  assert.match(source('src/ConciergeView.jsx'), /CLUB_PROGRAMS/);
  for (const path of ['public/accommodation.html', 'public/experiences.html']) {
    assert.match(source(path), /href="\/club"/, path);
  }
  const admin = source('src/admin/PlpEnterpriseAdminApp.jsx');
  assert.match(admin, /import ClubAdminView/);
  assert.match(admin, /\{ id: 'club', label: 'PLP Club'/);
  assert.match(admin, /<ClubAdminView code=\{code\}/);
});

test('Club enquiries and server dispatcher restored without opening public member records', () => {
  const api = source('api/plp.js');
  assert.match(api, /if \(action === 'club'\) return clubHandler\(req, res\)/);
  const leads = source('api/leads.js');
  assert.doesNotMatch(leads, /body\.topic === 'club' \|\| body\.topic === 'club-activity'/);
  const club = source('lib/club-handler.js');
  assert.match(club, /if \(!staff\(req\)\) return reply\(res, 403/);
  assert.match(source('src/ClubView.jsx'), /fees, benefits and launch dates are still being finalized/i);
});
