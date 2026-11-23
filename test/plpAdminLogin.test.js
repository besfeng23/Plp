import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('admin login leads with work email, keeps the shared staff code as a secondary path, and honours same-origin next', () => {
  const ui = read('src/admin/PlpAdminApp.jsx');
  assert.match(ui, /StaffAccountSignIn/);
  assert.match(ui, /Use staff code/);
  assert.match(ui, /Use work email/);
  assert.match(ui, /plp-admin-login__or/);
  assert.match(ui, /safeNextPath/);
  assert.match(ui, /location\.replace\(next\)/);
  assert.match(ui, /htmlFor="plp-admin-code"/);
  assert.match(ui, /staff-verify/);
  const css = read('src/admin/plp-enterprise-admin.css');
  assert.match(css, /\.plp-admin-login__or/);
  assert.match(css, /\.plp-admin-login__secondary/);
});
