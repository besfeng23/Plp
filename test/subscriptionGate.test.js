import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import subscription from '../api/subscription.js';

test('the subscription gate is opt-in for the generated guest pages', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'plp-subscription-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = join(root, 'dist');
  await mkdir(output);
  const html = '<!doctype html><html><head><title>PLP</title></head><body></body></html>';
  const files = ['index.html', 'booking.html', 'admin.html'];
  await Promise.all(files.map(file => writeFile(join(output, file), html)));
  const script = fileURLToPath(new URL('../scripts/inject-plp-subscription-gate.mjs', import.meta.url));

  const run = (flag) => {
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, PLP_SUBSCRIPTION_GATE_ENABLED: flag },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  };

  run('');
  assert.equal(await readFile(join(output, 'index.html'), 'utf8'), html);
  assert.equal(await readFile(join(output, 'booking.html'), 'utf8'), html);
  run('true');
  assert.match(await readFile(join(output, 'index.html'), 'utf8'), /data-plp-subscription-gate="true"/);
  assert.match(await readFile(join(output, 'booking.html'), 'utf8'), /data-plp-subscription-gate="true"/);
  assert.equal(await readFile(join(output, 'admin.html'), 'utf8'), html);
});

test('subscription checkout stays unavailable with the public site configuration', async (t) => {
  const previousFlag = process.env.PLP_SUBSCRIPTION_GATE_ENABLED;
  delete process.env.PLP_SUBSCRIPTION_GATE_ENABLED;
  t.after(() => {
    if (previousFlag !== undefined) process.env.PLP_SUBSCRIPTION_GATE_ENABLED = previousFlag;
  });
  const outbound = t.mock.method(globalThis, 'fetch', () => assert.fail('No provider call is expected'));
  const response = {
    setHeader() {},
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; },
  };
  await subscription({ method: 'POST', query: { operation: 'create' } }, response);
  assert.equal(response.code, 404);
  assert.equal(response.payload.ok, false);
  assert.equal(outbound.mock.callCount(), 0);
});

test('the consolidated subscription routes preserve method checks and reject unknown operations', async () => {
  const response = () => ({
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    send() { return this; },
    json() { return this; },
  });
  for (const [operation, allowed] of [['activate', 'GET'], ['cancel', 'POST'], ['status', 'GET']]) {
    const res = response();
    await subscription({ method: 'DELETE', query: { operation } }, res);
    assert.equal(res.code, 405);
    assert.equal(res.headers.Allow, allowed);
  }
  const res = response();
  await subscription({ method: 'POST', query: { operation: 'unknown' } }, res);
  assert.equal(res.code, 404);
});
