import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../public/admin-qa-polish.js', import.meta.url), 'utf8');

function renderStatus(boardRendered) {
  const panel = { innerHTML: '' };
  const doc = {
    getElementById(id) {
      if (id === 'admin-qa-polish') return panel;
      if (id === 'adminQaPolishStyle') return { id };
      if (id === 'availabilityBoardWrap') return { firstElementChild: boardRendered ? {} : null };
      return null;
    }
  };
  const browserWindow = { addEventListener() {} };
  runInNewContext(script, { window: browserWindow, document: doc, setTimeout: (fn) => fn() });
  return panel.innerHTML;
}

test('admin QA reports a rendered availability board as loaded', () => {
  assert.match(renderStatus(true), /<strong>Availability Board<\/strong><span>Loaded<\/span>/);
});

test('admin QA does not mark an unrendered availability board as loaded', () => {
  assert.match(renderStatus(false), /<strong>Availability Board<\/strong><span>Waiting \/ unavailable<\/span>/);
});
