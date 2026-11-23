import fs from 'node:fs/promises';
import path from 'node:path';
import { CONCIERGE_EMAIL as conciergeEmail } from '../lib/contact.js';
import { SITE } from '../lib/site-config.js';
import { formatPeso, PLP_ROOMS } from '../lib/pricing.js';
import { socialLinksHtml } from '../lib/social.js';

const root = process.cwd();
const publicDir = path.join(root, 'public');

const accommodationRates = new Map(PLP_ROOMS.map(room => [room.key, room.rate]));
// Internal pages never receive guest-site post-processing (trust strip, reserve bar, analytics).
const excludePatterns = [/photo-library/i, /admin/i, /ops/i, /growth-plan/i, /^404\.html$/];

const trustStrip = `<section class="plp-trust-strip" data-plp-trust-strip="true" aria-label="Reservation trust details"><div class="plp-trust-strip__inner"><div><span>Location</span><strong>High Boracay</strong></div><div><span>Booking</span><strong>Room + dates first</strong></div><div><span>Arrival</span><strong>Port transfer support</strong></div><div><span>Concierge</span><strong>${conciergeEmail}</strong></div></div></section>`;
const mobileAction = `<nav class="plp-mobile-action" data-plp-mobile-action="true" aria-label="Quick site navigation"><a href="/booking">Book</a><a href="/accommodation">Rooms</a><a href="/contact">Help</a></nav>`;

function shouldProcess(fileName) {
  return fileName.endsWith('.html') && !excludePatterns.some(pattern => pattern.test(fileName));
}

function isBookingPage(fileName) {
  return fileName === 'booking.html';
}

function ensureAnalyticsScript(html) {
  if (html.includes('src="/analytics.js"')) return html;
  return html.replace('</head>', '  <script src="/analytics.js" defer></script>\n</head>');
}

function ensureStylesheet(html) {
  if (html.includes('data-plp-image-placement="true"')) return html;
  return html.replace('</head>', '  <link rel="stylesheet" href="/image-placement.css" data-plp-image-placement="true" />\n</head>');
}

function ensureViewportFit(html) {
  return html.replace(/<meta\s+name=["']viewport["']\s+content=["']([^"']*)["']\s*\/?>/i, (tag, content) => {
    if (content.includes('viewport-fit=cover')) return tag;
    const separator = content.trim() ? ', ' : '';
    return tag.replace(content, `${content}${separator}viewport-fit=cover`);
  });
}

const DEFAULT_OG_IMAGE = `${SITE.url || 'https://plp-boracay.vercel.app'}/images/plp-hero-sunset.webp`;
const attr = value => String(value).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;').replace(/"/g, '&quot;');

// Every guest page gets Open Graph / Twitter tags built from its own title, description and canonical URL.
export function ensureOpenGraph(html) {
  if (html.includes('property="og:title"')) return html;
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1];
  const url = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i)?.[1];
  if (!title || !url) return html;
  const tags = [
    ['property', 'og:type', 'website'], ['property', 'og:site_name', 'Pueblo La Perla Boracay'],
    ['property', 'og:url', url], ['property', 'og:title', title],
    ...(description ? [['property', 'og:description', description]] : []),
    ['property', 'og:image', DEFAULT_OG_IMAGE],
    ['property', 'og:image:alt', 'Sunset aerial view of Pueblo La Perla Boracay hillside villas above the sea'],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', title],
    ...(description ? [['name', 'twitter:description', description]] : []),
    ['name', 'twitter:image', DEFAULT_OG_IMAGE],
  ].map(([kind, key, value]) => `  <meta ${kind}="${key}" content="${attr(value)}" />`).join('\n');
  return html.replace('</head>', `${tags}\n</head>`);
}

export function ensureRobots(html) {
  if (/<meta\s+name=["']robots["']/i.test(html)) return html;
  return html.replace('</head>', '  <meta name="robots" content="index,follow" />\n</head>');
}

function ensureTopReserve(html) {
  if (html.includes('class="plp-nav-reserve"')) return html;
  if (!html.includes('class="nav"')) return html;
  return html.replace('</div></nav>', '<a class="plp-nav-reserve" href="/booking">Book Now</a></div></nav>');
}

function ensureTrustStrip(html, fileName) {
  if (isBookingPage(fileName)) return html;
  if (html.includes('data-plp-trust-strip="true"')) return html;
  if (!html.includes('</nav>')) return html;
  return html.replace('</nav>', `</nav>\n  ${trustStrip}`);
}

function ensureMobileAction(html, fileName) {
  if (isBookingPage(fileName)) return html;
  if (html.includes('data-plp-mobile-action="true"')) return html;
  return html.replace('</body>', `  ${mobileAction}\n</body>`);
}

// Official social accounts in every public static footer (from lib/site-config.js).
export function ensureSocialLinks(html, fileName) {
  if (isBookingPage(fileName) || html.includes('data-plp-social="true"')) return html;
  const links = socialLinksHtml();
  if (!links) return html;
  if (html.includes('</footer>')) return html.replace('</footer>', `${links}</footer>`);
  return html.replace(/(\s*<nav class="plp-mobile-action"|\s*<\/body>)/, `\n  <footer class="plp-social-footer">${links}</footer>$1`);
}

function ensureRoomSpecificBookingLinks(html, fileName) {
  if (fileName !== 'accommodation.html') return html;
  return html
    .replace('href="/booking">Request Grand Ocean Villa dates<', 'href="/booking?room=grandOceanVilla">Request Grand Ocean Villa dates<')
    .replace('href="/booking">Request Sunset Suite dates<', 'href="/booking?room=sunsetSuite">Request Sunset Suite dates<')
    .replace('href="/booking">Request Smart Room Premium dates<', 'href="/booking?room=smartRoomPremium">Request Smart Room Premium dates<');
}

// Contact details have one source (lib/site-config.js). Any previously
// published value still present in a static page is rewritten to the current one.
function syncContactDetails(html, site = SITE) {
  let out = html;
  for (const old of site.previousConciergeEmails) if (old && old !== site.conciergeEmail) out = out.split(old).join(site.conciergeEmail);
  for (const old of site.previousConciergePhones) if (old && old !== site.conciergePhone) out = out.split(old).join(site.conciergePhone);
  return out;
}

function renderRates(html) {
  return html.replace(/(data-plp-nightly-rate="([^"]+)">)[^<]*(<\/)/g, (_, start, key, end) => {
    if (!accommodationRates.has(key)) throw new Error('Unknown accommodation rate key: ' + key);
    return start + formatPeso(accommodationRates.get(key)) + end;
  });
}

async function main() {
  const displaySource = await fs.readFile(path.join(root, 'lib/admin-records.js'), 'utf8');
  await fs.writeFile(path.join(publicDir, 'admin-records.js'), '// Generated by prepare-plp-static-pages.mjs from lib/admin-records.js.\n(() => {\n' + displaySource.replace(/^export /gm, '') + '\nwindow.PLP_RECORDS = { isTestRecord, recordCurrency, recordMoney, totalsByCurrency };\n})();\n');
  const hydratePath = path.join(publicDir, 'content-hydrate.js');
  const hydrate = await fs.readFile(hydratePath, 'utf8');
  const hydrated = hydrate.replace(/var SITE_EMAIL = '[^']*';/, "var SITE_EMAIL = '" + SITE.conciergeEmail + "';");
  if (hydrated !== hydrate) await fs.writeFile(hydratePath, hydrated, 'utf8');
  const entries = await fs.readdir(publicDir, { withFileTypes: true });
  const pages = entries.filter(entry => entry.isFile() && shouldProcess(entry.name));

  for (const route of ['boracay-villa-with-private-pool', 'private-villas-boracay', 'boracay-family-villa', 'boracay-wellness-stay', 'high-boracay-location', 'privacy', 'terms', 'reservation-policy']) {
    const file = path.join(publicDir, route, 'index.html');
    const original = await fs.readFile(file, 'utf8');
    let rendered = ensureSocialLinks(renderRates(original), route + '/index.html');
    rendered = ensureRobots(ensureOpenGraph(rendered));
    if (rendered !== original) await fs.writeFile(file, rendered, 'utf8');
  }

  for (const page of pages) {
    const filePath = path.join(publicDir, page.name);
    const original = await fs.readFile(filePath, 'utf8');
    let html = original;
    html = ensureViewportFit(html);
    html = ensureAnalyticsScript(html);
    html = ensureStylesheet(html);
    html = ensureTopReserve(html);
    html = ensureTrustStrip(html, page.name);
    html = ensureMobileAction(html, page.name);
    html = ensureRoomSpecificBookingLinks(html, page.name);
    html = ensureSocialLinks(html, page.name);
    html = ensureOpenGraph(html);
    html = ensureRobots(html);
    html = renderRates(html);
    html = syncContactDetails(html);

    if (html !== original) {
      await fs.writeFile(filePath, html, 'utf8');
      console.log(`prepared static page: ${page.name}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
