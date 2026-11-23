// Completion wave B: homepage video poster and still-image fallback.
// A scrolled live check confirmed the blank panels in earlier screenshots
// were a lazy-load capture artifact; image paths were not changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the hillside video has an eager poster and a still-image fallback if the video fails', () => {
  const src = read('src/VideoSection.jsx');
  assert.match(src, /plp-hillside-villas\.jpeg/);
  assert.match(src, /loading='eager'/);
  assert.match(src, /backgroundImage: "url\('\/images\/plp-hillside-villas\.jpeg'\)"/);
  assert.match(src, /poster='\/images\/plp-hillside-villas\.jpeg'/);
  assert.match(src, /setVideoFailed\(true\)/);
  assert.match(src, /!videoFailed/);
  assert.match(read('src/HomeView.jsx'), /plp-pool-ocean-view\.webp/);
  assert.match(read('src/HomeView.jsx'), /plp-private-breakfast-pool\.webp/);
});
