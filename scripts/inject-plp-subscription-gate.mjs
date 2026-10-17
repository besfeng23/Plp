import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
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

for (const file of await htmlFiles(publicDir)) {
  const original = await fs.readFile(file.full, 'utf8');
  const updated = inject(original);
  if (updated !== original) {
    await fs.writeFile(file.full, updated, 'utf8');
    console.log(`subscription gate injected: ${file.rel}`);
  }
}
