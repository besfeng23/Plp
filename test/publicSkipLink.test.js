import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('public shell exposes one keyboard skip link after React mounts', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const count = (source) => (source.match(/class(?:Name)?=['"]skip-link['"]/g) || []).length;

  assert.equal(count(html), 0, 'HTML loading shell must not duplicate the React link');
  assert.equal(count(app), 1, 'React shell must expose a single keyboard skip link');
  assert.match(app, /href=['"]#main-content['"]/);
});
