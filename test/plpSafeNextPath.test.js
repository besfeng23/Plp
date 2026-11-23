import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNextPath, ownerSignInUrl } from '../lib/safe-next-path.js';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('only same-origin relative paths are accepted as a post-login return', () => {
  assert.equal(safeNextPath('/admin'), '/admin');
  assert.equal(safeNextPath('/admin?x=1'), '/admin');
  for (const bad of ['', 'https://evil.example/', '//evil.example', '/\\evil', '/%2f%2fevil.example', '/owner', '/', '../etc', '/foo/../bar', 'plp-growth-plan', 'javascript:alert(1)']) {
    assert.equal(safeNextPath(bad), '', bad);
  }
  assert.equal(ownerSignInUrl('/admin'), 'https://plp-boracay.vercel.app/owner?next=%2Fadmin');
  assert.equal(ownerSignInUrl('https://evil.example'), 'https://plp-boracay.vercel.app/owner');
});

test('owner sign-in honours a same-origin next path after a link or code sign-in', () => {
  const app = read('src/owner/OwnerApp.jsx');
  assert.match(app, /safeNextPath/);
  assert.match(app, /location\.replace\(next\)/);
  assert.match(read('lib/owner-auth.js'), /ownerSignInUrl\(next\)/);
  assert.match(read('lib/owner-handler.js'), /requestOwnerEmail\(env, fetch, target, input\.next\)/);
  assert.doesNotMatch(app, /plp-growth-plan/);
});
