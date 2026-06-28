import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const conciergeEmail = 'plpvillas@gmail.com';

const excludePatterns = [/photo-library/i, /admin/i, /ops/i];

const trustStrip = `<section class="plp-trust-strip" data-plp-trust-strip="true" aria-label="Reservation trust details"><div class="plp-trust-strip__inner"><div><span>Location</span><strong>High Boracay</strong></div><div><span>Booking</span><strong>Room + dates first</strong></div><div><span>Arrival</span><strong>Port transfer support</strong></div><div><span>Concierge</span><strong>${conciergeEmail}</strong></div></div></section>`;
const mobileAction = `<nav class="plp-mobile-action" data-plp-mobile-action="true" aria-label="Quick site navigation"><a href="/booking">Book</a><a href="/accommodation">Rooms</a><a href="/contact">Help</a></nav>`;

function shouldProcess(fileName) {
  return fileName.endsWith('.html') && !excludePatterns.some(pattern => pattern.test(fileName));
}

function isBookingPage(fileName) {
  return fileName === 'booking.html';
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

function ensureRoomSpecificBookingLinks(html, fileName) {
  if (fileName !== 'accommodation.html') return html;
  return html
    .replace('href="/booking">Request Grand Ocean Villa dates<', 'href="/booking?room=grandOceanVilla">Request Grand Ocean Villa dates<')
    .replace('href="/booking">Request Sunset Suite dates<', 'href="/booking?room=sunsetSuite">Request Sunset Suite dates<')
    .replace('href="/booking">Request Smart Room Premium dates<', 'href="/booking?room=smartRoomPremium">Request Smart Room Premium dates<');
}

async function main() {
  const entries = await fs.readdir(publicDir, { withFileTypes: true });
  const pages = entries.filter(entry => entry.isFile() && shouldProcess(entry.name));

  for (const page of pages) {
    const filePath = path.join(publicDir, page.name);
    const original = await fs.readFile(filePath, 'utf8');
    let html = original;
    html = ensureViewportFit(html);
    html = ensureStylesheet(html);
    html = ensureTopReserve(html);
    html = ensureTrustStrip(html, page.name);
    html = ensureMobileAction(html, page.name);
    html = ensureRoomSpecificBookingLinks(html, page.name);

    if (html !== original) {
      await fs.writeFile(filePath, html, 'utf8');
      console.log(`prepared static page: ${page.name}`);
    }
  }
}

await main();
