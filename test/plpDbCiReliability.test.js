import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('dependencies are pinned to exact versions and a lockfile is committed', () => {
  const pkg = JSON.parse(read('package.json'));
  for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must be pinned (got ${version})`);
  }
  assert.ok(existsSync(new URL('../package-lock.json', import.meta.url)), 'package-lock.json committed');
  assert.doesNotMatch(read('.gitignore'), /^package-lock\.json$/m);
  const lock = JSON.parse(read('package-lock.json'));
  for (const [name, version] of Object.entries(pkg.dependencies)) {
    assert.equal(lock.packages[`node_modules/${name}`]?.version, version, `${name} lock matches package.json`);
  }
});

test('CI installs from the lockfile and rebuilds the database in a throwaway Postgres', () => {
  const wf = read('.github/workflows/plp-subscription-gate.yml');
  assert.match(wf, /npm ci/);
  assert.doesNotMatch(wf, /npm install/);
  assert.match(wf, /image: postgres:17/);
  assert.match(wf, /scripts\/verify-db-migrations\.sh/);
  assert.doesNotMatch(wf, /secrets\./, 'CI database job uses no repository secrets');
});

test('core booking schema is captured as reviewable pending migrations, not applied migrations', () => {
  const baseline = read('supabase/pending/20261015100000_plp_core_booking_baseline.sql');
  for (const obj of ['plp_accommodations', 'plp_guests', 'plp_bookings', 'plp_payments', 'plp_payment_events',
    'plp_blocked_dates', 'plp_notifications', 'create_booking_atomic', 'confirm_booking_atomic',
    'create_paypal_payment_atomic', 'record_paypal_capture_atomic', 'enforce_reservation_inventory',
    'plp_payment_reconciliation', 'plp_availability_calendar']) {
    assert.match(baseline, new RegExp(`plp_runtime\\.${obj}\\b`), `${obj} captured`);
  }
  assert.match(baseline, /migration repair --status applied 20261015100000/);
  assert.match(baseline, /enable row level security/);
  assert.doesNotMatch(baseline, /\bdrop\s+(table|function|view|schema)\b/i, 'baseline never drops anything');
  assert.doesNotMatch(baseline, /grant[^;]*to (anon|authenticated)/i, 'no browser-role grants');
  const applied = readdirSync(new URL('../supabase/migrations/', import.meta.url));
  assert.ok(!applied.some(f => f.includes('core_booking_baseline') || f.includes('relocate_staff_tasks')), 'still pending');
  const readme = read('supabase/pending/README.md');
  assert.match(readme, /20261015100000_plp_core_booking_baseline\.sql/);
  assert.match(readme, /20261015100100_plp_runtime_relocate_staff_tasks_and_ota\.sql/);
});

test('the database verifier refuses Supabase-hosted URLs (production is never touched)', () => {
  let code = 0;
  try {
    execFileSync('bash', ['scripts/verify-db-migrations.sh'], {
      cwd: new URL('..', import.meta.url), stdio: 'pipe',
      env: { ...process.env, PLP_VERIFY_DATABASE_URL: 'postgresql://postgres@db.example.supabase.co:5432/postgres' },
    });
  } catch (error) { code = error.status; }
  assert.equal(code, 2);
});

test('the Supabase Preview check and recovery steps are documented', () => {
  const doc = read('docs/database/plp-database-reproducibility.md');
  assert.match(doc, /sxxpyyyaiylucgsylbhx/);
  assert.match(doc, /Remote migration versions not found/);
  assert.match(doc, /## Recovery/);
  assert.match(read('docs/HANDOFF.md'), /plp-database-reproducibility\.md/);
});

test('no service-role key or JWT is committed in source, scripts or migrations', () => {
  const files = execFileSync('git', ['ls-files', 'api', 'lib', 'src', 'scripts', 'supabase', '.github'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const f of files) {
    const text = read(f);
    assert.doesNotMatch(text, /eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, `${f} contains a JWT`);
    assert.doesNotMatch(text, /sb_secret_[A-Za-z0-9]{10,}/, `${f} contains a Supabase secret key`);
  }
});
