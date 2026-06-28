#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const routeHtmlFiles = [
  { route: '/', file: 'index.html' },
  { route: '/booking', file: 'public/booking.html' },
  { route: '/accommodation', file: 'public/accommodation.html' },
  { route: '/experiences', file: 'public/experiences.html' },
  { route: '/reservation-policy', file: 'public/reservation-policy.html' },
  { route: '/reservation-policy/', file: 'public/reservation-policy/index.html' },
  { route: '/privacy', file: 'public/privacy.html' },
  { route: '/privacy/', file: 'public/privacy/index.html' },
  { route: '/terms', file: 'public/terms.html' },
  { route: '/terms/', file: 'public/terms/index.html' },
  { route: '/private-villas-boracay', file: 'public/private-villas-boracay/index.html' },
  { route: '/boracay-villa-with-private-pool', file: 'public/boracay-villa-with-private-pool/index.html' },
  { route: '/boracay-family-villa', file: 'public/boracay-family-villa/index.html' },
  { route: '/boracay-wellness-stay', file: 'public/boracay-wellness-stay/index.html' },
  { route: '/high-boracay-location', file: 'public/high-boracay-location/index.html' },
  { route: '/photo-library', file: 'public/photo-library.html' },
];

const viewportMetaPattern = /<meta\s+name=["']viewport["']\s+content=["']([^"']*)["']\s*\/?>/gi;
const failures = [];

for (const entry of routeHtmlFiles) {
  const html = await fs.readFile(path.join(root, entry.file), 'utf8');
  const viewportTags = [...html.matchAll(viewportMetaPattern)];

  if (viewportTags.length !== 1) {
    failures.push(`${entry.route} (${entry.file}) has ${viewportTags.length} viewport meta tags; expected exactly 1.`);
    continue;
  }

  const content = viewportTags[0][1];
  if (!content.includes('viewport-fit=cover')) {
    failures.push(`${entry.route} (${entry.file}) viewport meta is missing viewport-fit=cover.`);
  }
}

if (failures.length) {
  console.error('Viewport safe-area audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Viewport safe-area audit passed for ${routeHtmlFiles.length} public HTML route sources.`);
