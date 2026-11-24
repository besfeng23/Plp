// Plan PR 6: one PLP administration with eight screens and role-based navigation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { SCREENS, TILES, visibleScreens, visibleTiles } from '../src/admin/adminNavigation.js';
import { ROLE_PERMISSIONS, permissionsFor } from '../lib/access-control.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const app = read('src/admin/PlpAdminApp.jsx');
const ids = list => list.map(item => item.id);

test('one navigation system with the eight plan screens in order', () => {
  assert.deepEqual(SCREENS.map(s => s.label), ['Today', 'Reservations', 'Calendar', 'Guests & Requests', 'Pearl Club', 'Growth & Marketing', 'Reports & Documents', 'People & Access']);
  assert.match(read('src/admin/main.jsx'), /import PlpAdminApp from '\.\/PlpAdminApp\.jsx'/);
  assert.match(read('admin.html'), /<title>PLP Administration<\/title>/);
  // Each screen carries exactly one short sentence.
  for (const screen of SCREENS) assert.ok(screen.note.split(/[.!?](\s|$)/).filter(x => x && x.trim()).length <= 2 && screen.note.length < 80, screen.id);
});

test('no duplicate shells, iframes, client/enterprise labels, camera or channel-sync in the administration', () => {
  assert.doesNotMatch(app, /<iframe|Manage Client|Client Workspace|ENTERPRISE|Enterprise|Vision|Channel Sync|admin-ops/);
  assert.doesNotMatch(read('admin.html'), /Enterprise/);
  assert.doesNotMatch(JSON.stringify(TILES), /ota|vision|camera/i);
  for (const gone of ['PlpEnterpriseAdminApp.jsx', 'AdminApp.jsx', 'OpsAdminApp.jsx', 'ops-main.jsx', 'ResortCommandPanel.jsx', 'resort.css'])
    assert.ok(!existsSync(new URL('../src/admin/' + gone, import.meta.url)), gone);
  assert.deepEqual(readdirSync(new URL('../src/admin/', import.meta.url)).filter(f => f.startsWith('v3')), []);
  for (const marker of ['deploy-trigger-20260625-001.txt', 'deploy-version.txt', 'ratefix-20260702.txt', 'restore-deploy-marker.txt'])
    assert.ok(!existsSync(new URL('../public/' + marker, import.meta.url)), marker);
  // OTA foundation is hidden, not deleted.
  assert.ok(existsSync(new URL('../public/admin-ops.html', import.meta.url)));
  assert.ok(existsSync(new URL('../public/ota-sync-dry-run.js', import.meta.url)));
});

test('every tile needs a real permission and owners see every screen', () => {
  const all = new Set(Object.values(ROLE_PERMISSIONS).flat());
  for (const tile of Object.values(TILES).flat()) assert.ok(all.has(tile.perm), tile.id + ' ' + tile.perm);
  assert.equal(visibleScreens(permissionsFor('owner')).length, 8);
});

test('staff see only permitted functions; managers never see finance or access', () => {
  const staff = permissionsFor('staff');
  assert.deepEqual(ids(visibleScreens(staff)), ['today', 'calendar', 'guests']);
  assert.deepEqual(ids(visibleTiles('today', staff)), ['requests', 'tasks', 'activity']);
  assert.deepEqual(ids(visibleTiles('calendar', staff)), ['availability', 'blocks', 'housekeeping']);
  const manager = permissionsFor('manager');
  assert.ok(!ids(visibleScreens(manager)).includes('people'));
  assert.ok(!ids(visibleScreens(manager)).includes('growth'));
  assert.ok(!ids(visibleTiles('reservations', manager)).includes('revenue'));
  assert.ok(!ids(visibleScreens(manager)).includes('reports'));
  const legacy = permissionsFor('legacy');
  assert.ok(!legacy.includes('access.manage'));
  assert.deepEqual(ids(visibleTiles('people', legacy)), ['system']);
  assert.ok(ids(visibleTiles('reports', legacy)).includes('office'));
  assert.ok(!ids(visibleTiles('reports', manager)).includes('office'));
});

test('all operational functions of the former Resort Command remain reachable through one interface', () => {
  for (const action of ["'session'", "'operations'", "'notifications'", "'staff-tasks'", "'date-blocks'", "'concierge-inbox'", "'booking-status'", "'access'", "'health'"])
    assert.ok(app.includes('adminRequest(' + action), action);
  assert.match(app, /method: 'PATCH', body: \{ id, status: 'done' \}/);
  assert.match(app, /'date-blocks', code, \{ method: 'PATCH'/);
  assert.match(app, /'date-blocks', code, \{ method: 'POST'/);
  // Confirmation stays locked until the deposit is verified and captured, with no exception.
  assert.match(app, /pState\.verify === 'VERIFIED' && !pState\.exception && \['SUCCEEDED', 'CAPTURED'\]\.includes\(pState\.pay\)/);
  for (const component of ['ConciergeInbox', 'OwnerMonth', 'OwnerFunnel', 'WebsiteAnalytics', 'ClubAdminView', 'OwnerWorkspace', 'AffiliateAdmin']) assert.match(app, new RegExp('<' + component + ' '));
  assert.match(read('src/owner/OwnerApp.jsx'), /href="\/admin"/);
});

test('design follows the PLP page pattern without divider lines under top bars', () => {
  const css = read('src/admin/plp-admin.css');
  assert.match(css, /\.plp-adm-title \{[^}]*Libre Baskerville[^}]*text-transform: uppercase/);
  assert.match(css, /\.plp-adm-tiles \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.plp-adm-tile \{[^}]*aspect-ratio: 1 \/ 1/);
  assert.match(css, /\.plp-adm-top::after \{[^}]*linear-gradient/);
  assert.doesNotMatch(css.match(/\.plp-adm-top \{[^}]*\}/)[0], /border/);
  assert.doesNotMatch(css.match(/\.plp-adm-sheet__top \{[^}]*\}/)[0], /border/);
  assert.match(css, /\.plp-adm-crest \{[^}]*border-radius: 50%/);
});

test('session endpoint reports role and permissions after server-side verification', async () => {
  Object.assign(process.env, { PLP_STAFF_CODE: 'unified-test-code', SUPABASE_URL: 'https://jcyqixttuebxqqfkjonq.supabase.co', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' });
  delete process.env.PLP_AUTH_V2_ENABLED;
  const { default: admin } = await import('../api/admin.js');
  const call = async headers => { const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { this.body = JSON.parse(s); } }; await admin({ method: 'GET', headers, query: { action: 'session' } }, res); return res; };
  assert.equal((await call({})).statusCode, 401);
  const ok = await call({ 'x-plp-staff-code': 'unified-test-code' });
  assert.equal(ok.statusCode, 200); assert.equal(ok.body.role, 'legacy'); assert.equal(ok.body.individualAccounts, false);
  assert.ok(!ok.body.permissions.includes('access.manage'));
  assert.ok(ok.body.permissions.includes('reservations'));
});
