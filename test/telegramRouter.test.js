// Tests for the PLP Telegram command router.
// Run with: npm test  (uses Node's built-in test runner, no extra deps)
//
// The tools behind the router short-circuit when Supabase is not configured,
// so we strip any Supabase env BEFORE importing the router. This keeps the
// suite hermetic: no network, deterministic output.
import test from 'node:test';
import assert from 'node:assert/strict';

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { intentFor, normalize, normalizeCommand, routePlpAgent } = await import('../server/plpTelegram/plpAgent.js');
const { PLP_PRICES, PLP_TIER_BY_ACCOMMODATION, formatPeso } = await import('../lib/pricing.js');

test('normalize collapses case, slashes, underscores and hyphens', () => {
  assert.equal(normalize('/Arrivals_Today'), 'arrivals today');
  assert.equal(normalize('  Check-ins   today '), 'check ins today');
  assert.equal(normalize('/arrivals'), 'arrivals');
});

// name-only intent expectations
const intentCases = [
  ['Arrivals today', 'ops/arrivals'],
  ['arrivals today', 'ops/arrivals'],
  ['arrivals', 'ops/arrivals'],
  ['/arrivals', 'ops/arrivals'],
  ['/arrivals_today', 'ops/arrivals'],
  ['today arrivals', 'ops/arrivals'],
  ['check ins today', 'ops/arrivals'],
  ['check-ins today', 'ops/arrivals'],
  ['guests arriving today', 'ops/arrivals'],

  ['Checkouts today', 'ops/checkouts'],
  ['checkout today', 'ops/checkouts'],
  ['/checkouts', 'ops/checkouts'],
  ['/checkouts_today', 'ops/checkouts'],
  ['departures today', 'ops/checkouts'],
  ['guests leaving today', 'ops/checkouts'],

  ['show latest bookings', 'bookings/latest'],
  ['latest bookings', 'bookings/latest'],
  ['bookings', 'bookings/latest'],
  ['recent bookings', 'bookings/latest'],
  ['/bookings', 'bookings/latest'],
  ['/latest_bookings', 'bookings/latest'],

  ['payment exceptions', 'payments/exceptions'],
  ['unpaid bookings', 'payments/exceptions'],
  ['failed payments', 'payments/exceptions'],
  ['payment issues', 'payments/exceptions'],
  ['/payment_exceptions', 'payments/exceptions'],

  ['maintenance', 'ops/maintenance'],
  ['maintenance today', 'ops/maintenance'],
  ['repairs', 'ops/maintenance'],
  ['/maintenance', 'ops/maintenance'],

  ['housekeeping', 'ops/housekeeping'],
  ['rooms to clean', 'ops/housekeeping'],
  ['cleaning', 'ops/housekeeping'],
  ['/housekeeping', 'ops/housekeeping'],

  ['owner update', 'owner/brief'],
  ['owner report', 'owner/brief'],
  ['owner summary', 'owner/brief'],
  ['/owner_update', 'owner/brief'],
  ['morning update', 'owner/brief'],
  ['morning briefing', 'owner/brief'],
  ['daily briefing', 'owner/brief'],
  ['/morning_update', 'owner/brief'],

  ['what needs attention', 'owner/attention'],
  ['needs attention', 'owner/attention'],
  ['urgent', 'owner/attention'],
  ['problems', 'owner/attention'],
  ['issues today', 'owner/attention'],
  ['/attention', 'owner/attention'],

  ['reviews', 'reputation/reviews'],
  ['OTA status', 'channels/status'],
  ['website funnel', 'website/funnel'],

  // Regression guards: "production"/"approve" contain the substring "pr" but
  // must NOT be treated as pull-request queries.
  ['check production', 'vercel/status'],
  ['check paypal', 'paypal/health'],
  ['payment exceptions', 'payments/exceptions'],

  ['check all PRs', 'github/prs'],
  ['what PR is merge-ready', 'github/prs'],

  // Unknown text falls back to the help menu.
  ['hello', 'help'],
  ['help', 'help'],
  ['random gibberish 123', 'help'],
];

for (const [input, expected] of intentCases) {
  test(`intentFor(${JSON.stringify(input)}) -> ${expected}`, () => {
    assert.equal(intentFor(input).name, expected);
  });
}

test('numbered PR query captures the number', () => {
  const intent = intentFor('PR #55');
  assert.equal(intent.name, 'github/pr');
  assert.equal(intent.number, '55');
});

test('merge-ready flag is detected', () => {
  assert.equal(intentFor('what PR is merge-ready').mergeReady, true);
});

test('fallback flag is set only for unknown text', () => {
  assert.equal(intentFor('hello').fallback, true);
  assert.ok(!intentFor('help').fallback);
  assert.ok(!intentFor('arrivals today').fallback);
});

// End-to-end: the router must return the operational report, never the help
// menu, for known commands — even with no data source configured.
const HELP_MARK = 'PLP Command Bot';

test('routePlpAgent: "Arrivals today" returns an arrivals report, not the menu', async () => {
  const out = await routePlpAgent('Arrivals today');
  assert.match(out, /^Arrivals today:/);
  assert.ok(!out.includes(HELP_MARK));
});

test('routePlpAgent: "arrivals today" (lowercase) returns an arrivals report', async () => {
  const out = await routePlpAgent('arrivals today');
  assert.match(out, /^Arrivals today:/);
});

test('routePlpAgent: "/arrivals" returns an arrivals report', async () => {
  const out = await routePlpAgent('/arrivals');
  assert.match(out, /^Arrivals today:/);
});

test('routePlpAgent: "latest bookings" returns a bookings report', async () => {
  const out = await routePlpAgent('latest bookings');
  assert.match(out, /^Latest bookings:/);
  assert.ok(!out.includes(HELP_MARK));
});

test('routePlpAgent: "what needs attention" returns an attention report', async () => {
  const out = await routePlpAgent('what needs attention');
  assert.match(out, /^Needs attention:/);
});

test('routePlpAgent: "hello" returns the help menu', async () => {
  const out = await routePlpAgent('hello');
  assert.ok(out.includes(HELP_MARK));
});

// --- normalizeCommand: canonical snake_case ids (per spec) ---
const commandCases = [
  ['Arrivals today', 'arrivals_today'],
  ['arrivals today', 'arrivals_today'],
  ['/arrivals', 'arrivals_today'],
  ['/arrivals_today', 'arrivals_today'],
  ['checkouts today', 'checkouts_today'],
  ['/checkouts', 'checkouts_today'],
  ['latest bookings', 'latest_bookings'],
  ['/bookings', 'latest_bookings'],
  ['payment exceptions', 'payment_exceptions'],
  ['unpaid bookings', 'payment_exceptions'],
  ['maintenance', 'maintenance'],
  ['housekeeping', 'housekeeping'],
  ['concierge', 'concierge'],
  ['owner update', 'owner_update'],
  ['donor update', 'donor_update'],
  ['what needs attention', 'what_needs_attention'],
  ['reviews', 'reviews'],
  ['ota status', 'ota_status'],
  ['website funnel', 'website_funnel'],
  ['check production', 'check_production'],
  ['check paypal', 'check_paypal'],
  ['check all prs', 'check_all_prs'],
  ['hello', null],
  ['/start', null],
  ['help', null],
];
for (const [input, expected] of commandCases) {
  test(`normalizeCommand(${JSON.stringify(input)}) -> ${expected}`, () => {
    assert.equal(normalizeCommand(input), expected);
  });
}

// --- pricing single source of truth ---
test('PLP prices are the premium tiers 80000 / 60000 / 40000', () => {
  assert.equal(PLP_PRICES.premium, 80000);
  assert.equal(PLP_PRICES.mid, 60000);
  assert.equal(PLP_PRICES.entry, 40000);
});

test('accommodation names map to the correct tier price', () => {
  assert.equal(PLP_TIER_BY_ACCOMMODATION['Grand Ocean Villa'], 80000);
  assert.equal(PLP_TIER_BY_ACCOMMODATION['Sunset Suite'], 60000);
  assert.equal(PLP_TIER_BY_ACCOMMODATION['Smart Room Premium'], 40000);
});

test('formatPeso renders grouped pesos', () => {
  assert.equal(formatPeso(80000), '₱80,000');
  assert.equal(formatPeso(40000), '₱40,000');
});
