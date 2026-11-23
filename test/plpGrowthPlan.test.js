// The standalone Growth Plan page is retired. Official social links and the
// four pending owner confirmations live on the Administration Growth & Marketing
// screen. The 26-task checklist and the unused shared-progress migration are archived.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { TILES, OWNER_CONFIRMATIONS } from '../src/admin/adminNavigation.js';
import { socialProfiles, socialLinksHtml } from '../lib/social.js';
import { ensureSocialLinks } from '../scripts/prepare-plp-static-pages.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('growth-plan URLs permanently redirect to /admin and the page is gone', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const sources = ['/plp-growth-plan', '/plp-growth-plan.html', '/growth-plan'];
  for (const source of sources) {
    const redirect = vercel.redirects.find(r => r.source === source);
    assert.ok(redirect, source);
    assert.equal(redirect.destination, '/admin');
    assert.equal(redirect.permanent, true);
    assert.ok(!vercel.rewrites.some(r => r.source === source), source + ' rewrite removed');
  }
  assert.ok(!vercel.functions);
  assert.ok(!existsSync(new URL('../private/plp-growth-plan.html', import.meta.url)));
  assert.ok(!existsSync(new URL('../public/plp-growth-plan.html', import.meta.url)));
  assert.ok(!existsSync(new URL('../lib/growth-handler.js', import.meta.url)));
  assert.doesNotMatch(read('api/plp.js'), /growthHandler|action === 'growth'/);
  assert.doesNotMatch(read('src/owner/OwnerApp.jsx'), /plp-growth-plan/);
  assert.doesNotMatch(read('src/admin/adminNavigation.js'), /plp-growth-plan/);
  assert.match(read('public/robots.txt'), /Disallow: \/plp-growth-plan/);
});

test('Growth & Marketing shows official social links and the four owner confirmations', () => {
  assert.deepEqual(TILES.growth.map(t => t.id), socialProfiles().map(p => p.key));
  for (const tile of TILES.growth) {
    assert.equal(tile.perm, 'growth');
    assert.match(tile.href, /^https:\/\//);
    assert.ok(!tile.href.includes('plp-growth-plan'));
  }
  assert.deepEqual(OWNER_CONFIRMATIONS.map(i => i.id), ['rates', 'dates', 'transport', 'payments']);
  assert.equal(OWNER_CONFIRMATIONS.length, 4);
  for (const item of OWNER_CONFIRMATIONS) {
    assert.ok(item.title.length > 4 && item.detail.length > 20, item.id);
  }
  const app = read('src/admin/PlpAdminApp.jsx');
  assert.match(app, /OWNER_CONFIRMATIONS/);
  assert.match(app, /Waiting on the owners/);
  assert.match(app, /current\?\.id === 'growth'/);
  const archive = read('docs/archive/growth-plan.md');
  assert.match(archive, /Rates \+ capacity/);
  assert.match(archive, /Full execution task list \(26 tasks\)/);
  assert.match(archive, /26 \| Plan ongoing monthly content batch/);
});

test('shared-progress migration was not applied and is archived as unused', () => {
  assert.ok(existsSync(new URL('../docs/archive/20261123070000_plp_growth_tasks.sql', import.meta.url)));
  assert.ok(!existsSync(new URL('../supabase/pending/20261123070000_plp_growth_tasks.sql', import.meta.url)));
  assert.ok(!existsSync(new URL('../supabase/migrations/20261123070000_plp_growth_tasks.sql', import.meta.url)));
  const sql = read('docs/archive/20261123070000_plp_growth_tasks.sql');
  assert.match(sql, /never applied to production and is not needed/i);
  assert.match(sql, /create table if not exists plp_runtime\.plp_growth_tasks/);
  assert.match(read('supabase/pending/README.md'), /docs\/archive\/20261123070000_plp_growth_tasks\.sql/);
  assert.doesNotMatch(read('supabase/pending/README.md'), /awaiting owner approval/);
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
