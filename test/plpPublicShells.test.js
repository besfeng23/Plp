import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PAGE_META, ROUTES, SITE_URL, SPA_HTML_ROUTES } from '../lib/public-routes.js';
import { renderPlpRouteHtml } from '../scripts/prepare-plp-react-route-html.mjs';

const root = path.resolve(import.meta.dirname, '..');
const template = readFileSync(path.join(root, 'index.html'), 'utf8');
const vercelConfig = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rewrites = vercelConfig.rewrites;

test('all React landing routes provide page-specific first-response metadata and a readable fallback', () => {
  for (const [view, [heading, summary]] of Object.entries(SPA_HTML_ROUTES)) {
    const html = renderPlpRouteHtml(template, view);
    const url = SITE_URL + ROUTES[view];
    assert.ok(html.includes(`<title>${PAGE_META[view][0].replace(/&/g, '&amp;')}</title>`), view);
    assert.ok(html.includes(`<link rel="canonical" href="${url}"`), view);
    assert.ok(html.includes(`<meta property="og:url" content="${url}"`), view);
    assert.ok(html.includes(`<h1 class="initial-shell__title">${heading}</h1>`), view);
    assert.ok(html.includes(summary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;')), view);
    assert.ok(html.includes('id="root"'), view);
    assert.ok(!html.includes('"@type": "FAQPage"'), view);
    assert.ok(!html.includes('"@type": "LodgingBusiness"'), view);
    if (view.startsWith('payment-')) assert.ok(html.includes('name="robots" content="noindex,nofollow"'), view);
    assert.ok(rewrites.some((rewrite) => rewrite.source === ROUTES[view] && rewrite.destination === `${ROUTES[view]}.html`), view);
  }
});

test('a failed React script cannot dismiss the no-JavaScript guest fallback on load', () => {
  assert.ok(!template.includes("window.addEventListener('load'"));
  assert.ok(template.includes('Contact concierge'));
  const main = readFileSync(path.join(root, 'src/main.jsx'), 'utf8');
  assert.match(main, /useLayoutEffect/);
  assert.match(main, /plp-app-ready/);
});

test('payment-return URLs are not cached, and trailing slashes serve the same noindex shell', () => {
  for (const view of ['payment-success', 'payment-cancel']) {
    const route = ROUTES[view];
    assert.ok(rewrites.some((rewrite) => rewrite.source === `${route}/` && rewrite.destination === `${route}.html`), route);
    assert.ok(vercelConfig.headers.some((entry) => entry.source === route && entry.headers.some((header) => header.key === 'Cache-Control' && header.value.includes('no-store'))), route);
  }
});
