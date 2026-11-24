#!/usr/bin/env node
// Vercel serves these HTML entry points instead of the homepage shell so public
// metadata and a useful no-JavaScript fallback are correct on the first response.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_META, ROUTES, SITE_URL, SPA_HTML_ROUTES } from '../lib/public-routes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function replaceRequired(html, pattern, value, name) {
  if (!pattern.test(html)) throw new Error(`Missing ${name} in the built PLP shell.`);
  return html.replace(pattern, value);
}

export function renderPlpRouteHtml(template, view) {
  const route = ROUTES[view];
  const meta = PAGE_META[view];
  const shell = SPA_HTML_ROUTES[view];
  if (!route || !meta || !shell) throw new Error(`No public route shell metadata for ${view}.`);
  const url = SITE_URL + route;
  const [title, description] = meta;
  const [heading, summary] = shell;
  let html = template;
  html = replaceRequired(html, /<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`, 'title');
  html = replaceRequired(html, /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/s, `<meta name="description" content="${escapeHtml(description)}" />`, 'description');
  html = replaceRequired(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${escapeHtml(url)}" />`, 'canonical');
  if (view.startsWith('payment-')) {
    html = replaceRequired(html, /<meta name="robots" content="[^"]*"\s*\/>/, '<meta name="robots" content="noindex,nofollow" />', 'payment return robots');
  }
  for (const property of ['og:url', 'og:title', 'og:description']) {
    const value = property === 'og:url' ? url : property === 'og:title' ? title : description;
    html = replaceRequired(html, new RegExp(`<meta property="${property}" content="[^"]*"\\s*\\/>`), `<meta property="${property}" content="${escapeHtml(value)}" />`, property);
  }
  for (const name of ['twitter:title', 'twitter:description']) {
    const value = name === 'twitter:title' ? title : description;
    html = replaceRequired(html, new RegExp(`<meta name="${name}" content="[^"]*"\\s*\\/>`), `<meta name="${name}" content="${escapeHtml(value)}" />`, name);
  }
  // Home-specific lodging/FAQ schema must not be presented as page-specific club
  // or legal content. The relevant route receives a small accurate WebPage node.
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url });
  html = html.replace('</head>', `    <script type="application/ld+json">${schema.replace(/</g, '\\u003c')}</script>\n  </head>`);
  html = html.replace(/<link rel="preload" as="image" href="\/images\/plp-hero-sunset\.webp" fetchpriority="high" \/>/, '');
  const fallback = `<div class="initial-shell" aria-label="${escapeHtml(heading)} loading"><div class="initial-shell__content"><p class="initial-shell__kicker">Pueblo La Perla Boracay</p><h1 class="initial-shell__title">${escapeHtml(heading)}</h1><p class="initial-shell__copy">${escapeHtml(summary)}</p><p class="initial-shell__loading">Preparing this page</p><nav class="initial-shell__links" aria-label="Fallback navigation"><a href="/accommodation">Explore accommodation</a><a href="/contact">Contact the team</a></nav></div></div>`;
  html = replaceRequired(html, /<div class="initial-shell"[^>]*><div class="initial-shell__content">[\s\S]*?<\/div><\/div>/, fallback, 'fallback shell');
  return html;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = path.join(root, 'dist');
  const template = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  for (const view of Object.keys(SPA_HTML_ROUTES)) {
    const file = path.join(dist, ROUTES[view].slice(1) + '.html');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, renderPlpRouteHtml(template, view));
  }
  console.log(`Created ${Object.keys(SPA_HTML_ROUTES).length} route-specific public HTML entry points.`);
}
