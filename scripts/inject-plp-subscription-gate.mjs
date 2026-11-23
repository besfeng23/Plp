import fs from 'node:fs/promises';
import path from 'node:path';
import { subscriptionGateEnabled } from '../lib/subscription-gate.js';

const outputDir = path.join(process.cwd(), 'dist');
const skippedSegments = new Set(['subscribe', 'tg', 'telegram']);

async function htmlFiles(dir, relative = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const rel = path.posix.join(relative, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skippedSegments.has(entry.name.toLowerCase()) || /admin|ops|photo-library/i.test(entry.name)) continue;
      result.push(...await htmlFiles(full, rel));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      if (/admin|ops|photo-library/i.test(rel)) continue;
      result.push({ full, rel });
    }
  }
  return result;
}

function inject(html) {
  if (html.includes('data-plp-subscription-gate="true"')) return html;
  const head = `
    <script data-plp-subscription-gate="true">document.documentElement.classList.add('plp-subscription-checking');</script>
    <style data-plp-subscription-gate-style="true">
      html.plp-subscription-checking,html.plp-subscription-checking body{background:#050505!important}
      html.plp-subscription-checking body{visibility:hidden!important}
    </style>
    <script src="/subscription-gate.js" defer data-plp-subscription-gate-script="true"></script>
  `;
  return html.replace(/<head([^>]*)>/i, (tag) => tag + head);
}

if (subscriptionGateEnabled()) {
  for (const file of await htmlFiles(outputDir)) {
    const original = await fs.readFile(file.full, 'utf8');
    const updated = inject(original);
    if (updated !== original) {
      await fs.writeFile(file.full, updated, 'utf8');
      console.log(`subscription gate injected: ${file.rel}`);
    }
  }
}

// While the gate is disabled the subscription offer is not approved for the
// public: publish a neutral, non-indexed notice instead of the checkout page.
// Enabling PLP_SUBSCRIPTION_GATE_ENABLED restores the original page on the next build.
const SUBSCRIBE_UNAVAILABLE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>Not available · Pueblo La Perla Boracay</title><style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#080807;color:#f4f0e6;font-family:Georgia,serif;text-align:center;padding:24px}a{color:#c5b27b}</style></head><body><main><h1>This page is not available.</h1><p><a href="/">Return to Pueblo La Perla Boracay</a></p></main></body></html>`;
if (!subscriptionGateEnabled()) {
  const subscribePage = path.join(outputDir, 'subscribe', 'index.html');
  try {
    await fs.access(subscribePage);
    await fs.writeFile(subscribePage, SUBSCRIBE_UNAVAILABLE_HTML, 'utf8');
    console.log('subscription gate disabled: /subscribe unpublished');
  } catch { /* no subscribe page in this output */ }
}
