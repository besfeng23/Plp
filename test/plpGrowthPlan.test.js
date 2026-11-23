// Plan PR 7: Growth Plan for owners only, shared progress (plp_growth_tasks, pending
// migration) with a labelled on-device fallback, and the official social accounts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const SUPA = 'https://jcyqixttuebxqqfkjonq.supabase.co';
const owners = { a: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner.a@example.test'], b: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'owner.b@example.test'] };
Object.assign(process.env, { PLP_OWNER_EMAILS: owners.a[1] + ',' + owners.b[1], PLP_OWNER_SESSION_SECRET: 'g'.repeat(64), SUPABASE_URL: SUPA, SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' });
delete process.env.PLP_AUTH_V2_ENABLED;
const { default: growth, TASK_KEYS } = await import('../lib/growth-handler.js');
const { ownerCookie } = await import('../lib/owner-auth.js');
const { socialProfiles, socialLinksHtml } = await import('../lib/social.js');
const { ensureSocialLinks } = await import('../scripts/prepare-plp-static-pages.mjs');
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

let table = null; const events = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url); const method = opts.method || 'GET';
  const json = (code, b) => ({ ok: code < 400, status: code, json: async () => b });
  const owner = Object.values(owners).find(([id]) => u.pathname === '/auth/v1/admin/users/' + id);
  if (owner) return json(200, { id: owner[0], email: owner[1], email_confirmed_at: '2026-11-01T00:00:00Z' });
  if (u.pathname.startsWith('/rest/v1/plp_growth_task')) {
    if (!table) return json(404, { code: 'PGRST205', message: 'Could not find the table' });
    if (u.pathname === '/rest/v1/plp_growth_task_events') { if (method === 'POST') { events.push(JSON.parse(opts.body)); return json(201, null); } return json(200, events); }
    if (method === 'GET') { const key = (u.searchParams.get('item_key') || '').replace('eq.', ''); return json(200, key ? (table[key] ? [table[key]] : []) : Object.values(table)); }
    if (method === 'POST') { const row = JSON.parse(opts.body); table[row.item_key] = row; return json(201, [row]); }
  }
  return json(500, { message: 'unexpected ' + method + ' ' + u.pathname });
};
const origin = { host: 'plp-boracay.vercel.app', origin: 'https://plp-boracay.vercel.app' };
const as = who => ({ ...origin, cookie: ownerCookie(owners[who][0], process.env).split(';')[0] });
async function call(operation, { method = 'GET', headers = {}, body } = {}) {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { this.raw = s; try { this.body = JSON.parse(s); } catch { this.body = null; } } };
  await growth({ method, headers, body, query: { action: 'growth', operation } }, res); return res;
}

test('guests and staff cannot open the tracker or its progress', async () => {
  const page = await call('page');
  assert.equal(page.statusCode, 401); assert.match(page.headers['Content-Type'], /text\/html/);
  assert.doesNotMatch(page.raw, /TASKS|Full execution task list/); assert.match(page.raw, /href="\/owner"/);
  assert.equal(page.headers['X-Robots-Tag'], 'noindex, nofollow, noarchive');
  assert.equal((await call('tasks')).statusCode, 401);
  assert.equal((await call('tasks', { method: 'PATCH', headers: origin, body: { item: '01', status: 'In progress' } })).statusCode, 401);
  assert.equal((await call('tasks', { headers: { 'x-plp-staff-code': 'anything' } })).statusCode, 401);
  assert.ok(!existsSync(new URL('../public/plp-growth-plan.html', import.meta.url)), 'tracker is no longer a public static file');
});

test('owners get the tracker without guest-site additions, with official social links', async () => {
  const page = await call('page', { headers: as('a') });
  assert.equal(page.statusCode, 200); assert.equal(page.headers['Cache-Control'], 'private, no-store, max-age=0');
  assert.match(page.raw, /Full execution task list/);
  assert.doesNotMatch(page.raw, /data-plp-trust-strip|plp-mobile-action|plp-nav-reserve|\/analytics\.js|plp-posthog/);
  for (const p of socialProfiles()) assert.ok(page.raw.includes('href="' + p.url + '"'), p.key);
  assert.match(page.raw, /href="\/admin"/); assert.match(page.raw, /href="\/owner"/);
});

test('until the migration is applied, progress is clearly saved on this device', async () => {
  table = null;
  const r = await call('tasks', { headers: as('a') });
  assert.equal(r.statusCode, 200); assert.equal(r.body.storage, 'device');
  const w = await call('tasks', { method: 'PATCH', headers: as('a'), body: { item: '01', status: 'In progress' } });
  assert.equal(w.statusCode, 503); assert.equal(w.body.storage, 'device');
  const html = read('private/plp-growth-plan.html');
  assert.match(html, /Saved on this device — shared progress starts once the database update is approved/);
  assert.match(html, /Add them to the shared tracker/);
  // Device progress is only cleared by an explicit owner choice, never while shared tracking is on.
  assert.equal(html.split('localStorage.removeItem(KEY)').length, 2);
  assert.match(html, /if\(mode==="central"\)return;\nif\(!confirm\("Clear the progress saved on this device\? Export CSV first/);
});

test('one owner updates a task and the other owner sees it, with who changed it', async () => {
  table = {}; events.length = 0;
  assert.equal((await call('tasks', { method: 'PATCH', headers: as('a'), body: { item: '07', status: 'In progress', owner: 'Concierge team', due: '2026-11-30' } })).statusCode, 200);
  let seen = (await call('tasks', { headers: as('b') })).body;
  assert.equal(seen.storage, 'central'); assert.equal(seen.items['07'].status, 'In progress'); assert.equal(seen.items['07'].by, owners.a[1]);
  assert.equal(seen.items['07'].owner, 'Concierge team'); assert.equal(seen.items['07'].due, '2026-11-30');
  assert.equal((await call('tasks', { method: 'PATCH', headers: as('b'), body: { item: '07', status: 'Done', note: 'Form tested end to end' } })).statusCode, 200);
  seen = (await call('tasks', { headers: as('a') })).body;
  assert.equal(seen.items['07'].status, 'Done'); assert.equal(seen.items['07'].by, owners.b[1]); assert.ok(seen.items['07'].completedAt);
  assert.deepEqual(events.map(e => [e.item_key, e.previous_status, e.new_status, e.actor_email]), [['07', null, 'In progress', owners.a[1]], ['07', 'In progress', 'Done', owners.b[1]]]);
  const history = (await call('history', { headers: as('b') })).body;
  assert.equal(history.history.length, 2);
});

test('server keeps the tracker rules: evidence for Done, proof for Published, known items, same origin', async () => {
  table = {};
  const patch = (body, headers = as('a')) => call('tasks', { method: 'PATCH', headers, body });
  assert.equal((await patch({ item: '02', status: 'Done', note: 'ok' })).statusCode, 400);
  assert.equal((await patch({ item: 'post-3', status: 'Published' })).statusCode, 400);
  assert.equal((await patch({ item: 'post-3', status: 'Published', proof: 'https://www.instagram.com/p/abc/' })).statusCode, 200);
  assert.equal((await patch({ item: '27', status: 'Planned' })).statusCode, 400);
  assert.equal((await patch({ item: '02', status: 'Shipped' })).statusCode, 400);
  assert.equal((await patch({ item: '02', status: 'Planned' }, { ...as('a'), origin: 'https://evil.example' })).statusCode, 403);
  assert.equal(TASK_KEYS.length, 26);
});

test('tracker keeps the V3 26-task list, every task has a valid starting status, CSV exports who/when', () => {
  const html = read('private/plp-growth-plan.html');
  const rows = [...html.slice(html.indexOf('const TASKS=['), html.indexOf('];', html.indexOf('const TASKS=['))).matchAll(/\["(\d\d)",.*\]/g)].map(m => JSON.parse(m[0]));
  assert.equal(rows.length, 26);
  for (const row of rows) { assert.equal(row.length, 9, row[0]); assert.ok(['Planned', 'Needs info', 'In progress', 'Blocked', 'Done'].includes(row[7]), row[0]); }
  assert.match(html, /"Last changed by","Last changed \(UTC\)","Saved"/);
  assert.match(html, /V3 LOCKED/);
});

test('official social links: site config, footer, contact, structured data and static pages', () => {
  assert.deepEqual(socialProfiles().map(p => p.url), ['https://www.facebook.com/PuebloLaPerlaBoracay', 'https://www.instagram.com/pueblolaperlaboracay/', 'https://www.tiktok.com/@pueblolaperlaboracay']);
  // An unconfirmed or off-platform address is never linked.
  assert.equal(socialProfiles({ social: { facebook: 'https://www.facebook.com/PuebloLaPerlaBoracay', instagram: null, tiktok: 'https://tiktok.example/@x' } }).length, 1);
  const ld = JSON.parse(read('index.html').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(ld.sameAs, socialProfiles().map(p => p.url));
  assert.match(read('src/App.jsx'), /<SocialLinks className='plp-social--footer/);
  assert.match(read('src/ConciergeView.jsx'), /<SocialLinks className="plp-social--contact"/);
  const html = ensureSocialLinks('<html><body><footer class="footer">x</footer></body></html>', 'accommodation.html');
  assert.ok(html.includes(socialLinksHtml() + '</footer>'));
  assert.equal(ensureSocialLinks(html, 'accommodation.html'), html, 'idempotent');
  assert.match(socialLinksHtml(), /rel="noopener noreferrer me"/);
  assert.match(read('scripts/prepare-plp-static-pages.mjs'), /\/growth-plan\/i/);
  for (const page of ['public/accommodation.html', 'public/experiences.html', 'public/privacy/index.html', 'public/boracay-family-villa/index.html'])
    assert.match(read(page), /data-plp-social="true"/, page);
});

test('routing serves the tracker only through the owner-checked function', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const first = vercel.rewrites.slice(0, 3).map(r => [r.source, r.destination]);
  assert.deepEqual(first.map(r => r[1]), Array(3).fill('/api/plp?action=growth&operation=page'));
  assert.ok(first.some(r => r[0] === '/plp-growth-plan.html'));
  assert.equal(vercel.functions['api/plp.js'].includeFiles, 'private/plp-growth-plan.html');
  assert.match(read('public/robots.txt'), /Disallow: \/plp-growth-plan/);
  assert.match(read('api/plp.js'), /action === 'growth'\) return growthHandler/);
  assert.match(read('src/owner/OwnerApp.jsx'), /href="\/plp-growth-plan"/);
  assert.match(read('src/admin/adminNavigation.js'), /href: '\/plp-growth-plan'/);
  assert.ok(existsSync(new URL('../supabase/pending/20261123070000_plp_growth_tasks.sql', import.meta.url)));
  assert.ok(!existsSync(new URL('../supabase/migrations/20261123070000_plp_growth_tasks.sql', import.meta.url)));
});
