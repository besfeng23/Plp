// Plan PR 10: SEO, clean URLs, genuine 404s, crawler hygiene, and stale-file cleanup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ensureOpenGraph, ensureRobots } from '../scripts/prepare-plp-static-pages.mjs';
import { PAGE_META, ROUTES, SITE_URL, SPA_HTML_ROUTES } from '../lib/public-routes.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const vercel = JSON.parse(read('vercel.json'));

const LEGACY_REDIRECTS = [
  ['/accommodation.html', '/accommodation'],
  ['/experiences.html', '/experiences'],
  ['/booking.html', '/booking'],
  ['/contact.html', '/contact'],
  ['/gallery.html', '/gallery'],
  ['/getting-here.html', '/getting-here'],
  ['/club.html', '/club'],
  ['/senior-living.html', '/senior-living'],
  ['/exclusive-offer.html', '/exclusive-offer'],
  ['/privacy.html', '/privacy-policy'],
  ['/privacy-policy.html', '/privacy-policy'],
  ['/terms.html', '/terms-of-service'],
  ['/terms-of-service.html', '/terms-of-service'],
  ['/reservation-policy.html', '/reservation-policy'],
  ['/index.html', '/'],
  ['/vip-package', '/exclusive-offer'],
  ['/vip-package.html', '/exclusive-offer'],
];

const STATIC_GUEST_PAGES = [
  'public/accommodation.html',
  'public/experiences.html',
  'public/reservation-policy.html',
  'public/boracay-family-villa/index.html',
  'public/boracay-villa-with-private-pool/index.html',
  'public/boracay-wellness-stay/index.html',
  'public/high-boracay-location/index.html',
  'public/private-villas-boracay/index.html',
  'public/reservation-policy/index.html',
  'booking.html',
  'index.html',
];

function headerHas(source, key, fragment) {
  const entry = vercel.headers.find(item => item.source === source);
  return Boolean(entry?.headers.some(header => header.key === key && header.value.includes(fragment)));
}

test('unknown routes are not rewritten to the homepage, and a noindex 404 page is published', () => {
  for (const rewrite of vercel.rewrites) {
    assert.ok(!String(rewrite.source).includes('(?!'), rewrite.source);
  }
  const html = read('public/404.html');
  assert.match(html, /<title>Page not found \| Pueblo La Perla Boracay<\/title>/);
  assert.match(html, /name="robots" content="noindex,follow"/);
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/accommodation"/);
  assert.match(html, /href="\/booking"/);
  assert.match(html, /href="\/contact"/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
});

test('legacy .html addresses and the old VIP path redirect to the canonical guest URLs', () => {
  for (const [source, destination] of LEGACY_REDIRECTS) {
    const rule = vercel.redirects.find(item => item.source === source);
    assert.ok(rule, source);
    assert.equal(rule.destination, destination, source);
    assert.equal(rule.permanent, true, source);
  }
});

test('guest pages carry a title, description, canonical URL and Open Graph tags', () => {
  for (const page of STATIC_GUEST_PAGES) {
    const html = read(page);
    assert.match(html, /<title>[^<]+<\/title>/, page);
    assert.match(html, /<meta\s+name="description"\s+content="/, page);
    assert.match(html, /<link\s+rel="canonical"\s+href="https:\/\/plp-boracay\.vercel\.app/, page);
    assert.match(html, /property="og:title"/, page);
    assert.match(html, /property="og:image"/, page);
    assert.match(html, /name="twitter:card"/, page);
    assert.match(html, /name="robots" content="index,follow"/, page);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, page);
  }
});

test('ensureOpenGraph fills missing tags once from the page title, description and canonical URL', () => {
  const html = `<!doctype html><html><head>
    <title>Private Villas | Pueblo La Perla Boracay</title>
    <meta name="description" content="Quiet hillside villas in Boracay." />
    <link rel="canonical" href="https://plp-boracay.vercel.app/private-villas-boracay" />
  </head></html>`;
  const once = ensureOpenGraph(html);
  assert.match(once, /property="og:title" content="Private Villas \| Pueblo La Perla Boracay"/);
  assert.match(once, /property="og:description" content="Quiet hillside villas in Boracay."/);
  assert.match(once, /property="og:url" content="https:\/\/plp-boracay\.vercel\.app\/private-villas-boracay"/);
  assert.match(once, /property="og:site_name" content="Pueblo La Perla Boracay"/);
  assert.equal(ensureOpenGraph(once), once);
  const withRobots = ensureRobots(once);
  assert.match(withRobots, /name="robots" content="index,follow"/);
  assert.equal(ensureRobots(withRobots), withRobots);
});

test('internal surfaces are noindexed in robots.txt and in Vercel headers', () => {
  const robots = read('public/robots.txt');
  for (const path of [
    '/admin', '/owner', '/plp-growth-plan.html', '/plp-growth-plan', '/growth-plan',
    '/photo-library.html', '/content-ops.html', '/availability-ops.html',
    '/subscribe', '/tg', '/telegram', '/booking/success', '/booking/cancel', '/api/',
  ]) {
    assert.match(robots, new RegExp('Disallow: ' + path.replace(/[.*]/g, '\\$&')));
  }
  assert.match(robots, /Sitemap: https:\/\/plp-boracay\.vercel\.app\/sitemap.xml/);
  for (const source of [
    '/admin', '/owner', '/admin-ops.html', '/subscribe', '/tg', '/telegram',
    '/plp-growth-plan', '/plp-growth-plan.html', '/growth-plan',
  ]) {
    assert.ok(headerHas(source, 'X-Robots-Tag', 'noindex'), source);
  }
});

test('the sitemap lists only canonical public guest URLs', () => {
  const xml = read('public/sitemap.xml');
  assert.match(xml, /https:\/\/plp-boracay\.vercel\.app\/<\/loc>/);
  assert.match(xml, /https:\/\/plp-boracay\.vercel\.app\/booking</);
  assert.match(xml, /https:\/\/plp-boracay\.vercel\.app\/accommodation</);
  for (const path of Object.values(ROUTES)) {
    if (path.startsWith('/booking/')) continue;
    assert.match(xml, new RegExp(SITE_URL.replace(/[.*]/g, '\\$&') + path.replace(/[.*]/g, '\\$&') + '</loc>'), path);
  }
  for (const banned of ['/admin', '/owner', '/plp-growth-plan', '/subscribe', '/tg', '/booking/success', '.html']) {
    assert.doesNotMatch(xml, new RegExp(banned.replace(/[.*]/g, '\\$&')));
  }
  for (const view of Object.keys(SPA_HTML_ROUTES)) {
    assert.ok(PAGE_META[view][0].length > 8, view);
  }
});

test('the public React shell drops its fallback heading after the app is visible', () => {
  const main = read('src/main.jsx');
  assert.match(main, /document\.querySelector\('\.initial-shell'\)/);
  assert.match(main, /shell\.remove\(\)/);
});

test('verified obsolete admin shells and stale deploy markers are gone', () => {
  for (const gone of [
    'src/admin/AdminApp.jsx',
    'src/admin/OpsAdminApp.jsx',
    'src/admin/PlpEnterpriseAdminApp.jsx',
    '.vercel-redeploy',
    'docs/admin-v2-deploy-trigger.md',
    'docs/admin-v2-deploy-trigger-2.md',
  ]) {
    assert.ok(!existsSync(new URL('../' + gone, import.meta.url)), gone);
  }
  assert.match(read('AGENTS.md'), /src\/admin\/PlpAdminApp\.jsx/);
  assert.doesNotMatch(read('AGENTS.md'), /src\/admin\/OpsAdminApp\.jsx/);
});
