import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNextPath, ownerSignInUrl } from '../lib/safe-next-path.js';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('only same-origin relative paths are accepted as a post-login return', () => {
  assert.equal(safeNextPath('/plp-growth-plan'), '/plp-growth-plan');
  assert.equal(safeNextPath('/admin'), '/admin');
  assert.equal(safeNextPath('/plp-growth-plan?x=1'), '/plp-growth-plan');
  for (const bad of ['', 'https://evil.example/', '//evil.example', '/\\evil', '/%2f%2fevil.example', '/owner', '/', '../etc', '/foo/../bar', 'plp-growth-plan', 'javascript:alert(1)']) {
    assert.equal(safeNextPath(bad), '', bad);
  }
  assert.equal(ownerSignInUrl('/plp-growth-plan'), 'https://plp-boracay.vercel.app/owner?next=%2Fplp-growth-plan');
  assert.equal(ownerSignInUrl('https://evil.example'), 'https://plp-boracay.vercel.app/owner');
});

test('owner sign-in returns to the Growth Plan, and the page stays honest about unshared progress', () => {
  const app = read('src/owner/OwnerApp.jsx');
  assert.match(app, /safeNextPath/);
  assert.match(app, /location\.replace\(next\)/);
  assert.match(read('lib/owner-auth.js'), /ownerSignInUrl\(next\)/);
  assert.match(read('lib/owner-handler.js'), /requestOwnerEmail\(env, fetch, target, input\.next\)/);
  const plan = read('private/plp-growth-plan.html');
  assert.match(plan, /Saved on this device — shared progress starts once the database update is approved/);
});
