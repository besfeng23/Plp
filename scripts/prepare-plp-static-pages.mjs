import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const conciergeEmail = 'plpvillas@gmail.com';

const excludePatterns = [
  /photo-library/i,
  /admin/i,
  /ops/i
];

const trustStrip = `<section class="plp-trust-strip" data-plp-trust-strip="true" aria-label="Reservation trust details"><div class="plp-trust-strip__inner"><div><span>Location</span><strong>High Boracay</strong></div><div><span>Reservation</span><strong>Reviewed privately</strong></div><div><span>Arrival</span><strong>Port transfer support</strong></div><div><span>Concierge</span><strong>${conciergeEmail}</strong></div></div></section>`;

const mobileAction = `<nav class="plp-mobile-action" data-plp-mobile-action="true" aria-label="Quick reservation actions"><a href="/booking">Reserve</a><a href="mailto:${conciergeEmail}">Email</a><a href="/contact">Concierge</a></nav>`;

const bookingAssurance = `<div class="plp-booking-assurance" data-plp-booking-assurance="true"><strong>Before you continue</strong><ul><li>This creates a private reservation request before final confirmation.</li><li>Availability is reviewed by the PLP team before the stay is treated as final.</li><li>For urgent dates or special arrangements, email ${conciergeEmail}.</li></ul></div>`;

function shouldProcess(fileName) {
  return fileName.endsWith('.html') && !excludePatterns.some(pattern => pattern.test(fileName));
}

function ensureStylesheet(html) {
  if (html.includes('data-plp-image-placement="true"')) return html;
  return html.replace('</head>', '  <link rel="stylesheet" href="/image-placement.css" data-plp-image-placement="true" />\n</head>');
}

function ensureTopReserve(html) {
  if (html.includes('class="plp-nav-reserve"')) return html;
  if (!html.includes('class="nav"')) return html;
  return html.replace('</div></nav>', '<a class="plp-nav-reserve" href="/booking">Reserve</a></div></nav>');
}

function ensureTrustStrip(html) {
  if (html.includes('data-plp-trust-strip="true"')) return html;
  if (!html.includes('</nav>')) return html;
  return html.replace('</nav>', `</nav>\n  ${trustStrip}`);
}

function ensureMobileAction(html) {
  if (html.includes('data-plp-mobile-action="true"')) return html;
  return html.replace('</body>', `  ${mobileAction}\n</body>`);
}

function ensureBookingAssurance(html, fileName) {
  if (fileName !== 'booking.html') return html;
  if (html.includes('data-plp-booking-assurance="true"')) return html;
  return html.replace(/(<div class="note" id="reservationNote">[\s\S]*?<\/div>)(<button id="submitBtn")/, `$1${bookingAssurance}$2`);
}

async function main() {
  const entries = await fs.readdir(publicDir, { withFileTypes: true });
  const pages = entries.filter(entry => entry.isFile() && shouldProcess(entry.name));

  for (const page of pages) {
    const filePath = path.join(publicDir, page.name);
    const original = await fs.readFile(filePath, 'utf8');
    let html = original;
    html = ensureStylesheet(html);
    html = ensureTopReserve(html);
    html = ensureTrustStrip(html);
    html = ensureMobileAction(html);
    html = ensureBookingAssurance(html, page.name);

    if (html !== original) {
      await fs.writeFile(filePath, html, 'utf8');
      console.log(`prepared static page: ${page.name}`);
    }
  }
}

await main();
