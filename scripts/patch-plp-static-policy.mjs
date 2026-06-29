import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const bookingDescription = 'Request a Pueblo La Perla Boracay stay with availability review, booking terms, and deposit details confirmed before final reservation.';

function oneOnly(html, markerStart, markerEnd) {
  const first = html.indexOf(markerStart);
  if (first < 0) return html;
  let cursor = first + markerStart.length;
  let output = html;
  while (true) {
    const next = output.indexOf(markerStart, cursor);
    if (next < 0) return output;
    const close = output.indexOf(markerEnd, next);
    if (close < 0) return output;
    output = output.slice(0, next) + output.slice(close + markerEnd.length);
    cursor = first + markerStart.length;
  }
}

async function patchFile(fileName) {
  const filePath = path.join(publicDir, fileName);
  let html = await fs.readFile(filePath, 'utf8');
  const original = html;

  html = html
    .replace(/href="\/privacy"/g, 'href="/privacy-policy"')
    .replace(/href="\/privacy\/"/g, 'href="/privacy-policy"')
    .replace(/href="\/terms"/g, 'href="/terms-of-service"')
    .replace(/href="\/terms\/"/g, 'href="/terms-of-service"')
    .replace(/The 30% deposit step is not configured yet\./g, 'The payment step is not configured yet.')
    .replace(/but the 30% deposit step could not start:[^`']*/g, 'The online deposit step is temporarily unavailable. Our concierge will contact you to complete the deposit.');

  if (fileName === 'booking.html') {
    html = html.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${bookingDescription}" />`);
  }

  if (fileName === 'privacy.html') {
    html = html.replace(/<link rel="canonical" href="[^"]*" \/>/, '<link rel="canonical" href="https://plp-boracay.vercel.app/privacy-policy" />');
  }

  if (fileName === 'terms.html') {
    html = html.replace(/<link rel="canonical" href="[^"]*" \/>/, '<link rel="canonical" href="https://plp-boracay.vercel.app/terms-of-service" />');
  }

  html = oneOnly(html, '<a class="plp-nav-reserve"', '</a>');
  html = oneOnly(html, '<section class="plp-trust-strip"', '</section>');
  html = oneOnly(html, '<nav class="plp-mobile-action"', '</nav>');

  if (html !== original) {
    await fs.writeFile(filePath, html, 'utf8');
    console.log(`policy patch applied: ${fileName}`);
  }
}

for (const fileName of ['accommodation.html', 'booking.html', 'experiences.html', 'privacy.html', 'reservation-policy.html', 'reservation-policy/index.html', 'terms.html']) {
  await patchFile(fileName);
}
