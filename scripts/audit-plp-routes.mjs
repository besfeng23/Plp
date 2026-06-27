#!/usr/bin/env node
const BASE_URL = process.env.PLP_PRODUCTION_URL || 'https://plp-boracay.vercel.app';
const routes = [
  '/',
  '/booking',
  '/admin',
  '/accommodation',
  '/accommodations',
  '/experiences',
  '/reservation-policy',
  '/privacy',
  '/terms',
  '/private-villas-boracay',
  '/boracay-villa-with-private-pool',
  '/boracay-family-villa',
  '/boracay-wellness-stay',
  '/high-boracay-location',
  '/robots.txt',
  '/sitemap.xml',
];

const expectedRedirects = new Map();
const publicRoutes = new Set(routes.filter((route) => route !== '/admin'));

function routeUrl(route) {
  return new URL(route, BASE_URL).toString();
}

async function checkRoute(route) {
  const startUrl = routeUrl(route);
  try {
    const response = await fetch(startUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'PLP route audit (no staff key)',
        Accept: route.endsWith('.xml') || route.endsWith('.txt') ? '*/*' : 'text/html,application/xhtml+xml',
      },
    });
    const redirected = response.url !== startUrl;
    const intentional = expectedRedirects.get(route) === response.url;
    const ok = response.status === 200 && (!redirected || intentional);
    let note = 'OK';
    if (redirected) note = intentional ? 'Intentional redirect' : 'Unexpected redirect';
    if (route === '/admin' && response.status === 200) note = `${note}; shell only, no staff key sent`;
    return { route, status: response.status, ok, finalUrl: response.url, note };
  } catch (error) {
    return { route, status: 'ERR', ok: false, finalUrl: startUrl, note: error.message };
  }
}

function pad(value, width) {
  return String(value).padEnd(width, ' ');
}

const results = await Promise.all(routes.map(checkRoute));
console.log(`PLP production route audit: ${BASE_URL}`);
console.log(`${pad('Result', 7)} ${pad('Status', 6)} ${pad('Route', 36)} Final URL / note`);
console.log('-'.repeat(110));
for (const result of results) {
  const marker = result.ok ? 'PASS' : 'FAIL';
  console.log(`${pad(marker, 7)} ${pad(result.status, 6)} ${pad(result.route, 36)} ${result.finalUrl}${result.note ? ` — ${result.note}` : ''}`);
}
const failures = results.filter((result) => publicRoutes.has(result.route) && !result.ok);
const adminFailure = results.find((result) => result.route === '/admin' && !result.ok);
if (adminFailure) failures.push(adminFailure);
if (failures.length) {
  console.error(`\n${failures.length} route(s) failed the PLP production audit.`);
  process.exit(1);
}
console.log('\nAll audited PLP production routes responded as expected.');
