import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const contrast = (a,b) => {
  const lum = str => {
    const rgb = [1,3,5].map(i => parseInt(str.slice(i,i+2),16)/255)
      .map(c => c <= .04045 ? c / 12.92 : ((c+.055)/1.055)**2.4);
    return rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722;
  };
  const [hi,lo] = [lum(a),lum(b)].sort((a,b)=>b-a);
  return (hi+.05)/(lo+.05);
};

test('PLP brand mark is consistently sourced from the existing verified favicon',()=>{
  for(const path of ['src/App.jsx','src/admin/PlpEnterpriseAdminApp.jsx','public/accommodation.html','public/experiences.html','booking.html'])
    assert.ok(file(path).includes('/favicon.svg'), path);
});

test('public navigation is responsive and static routes share the same site shell',()=>{
  const app = file('src/App.jsx');
  const css = file('src/index.css');
  const placement = file('public/image-placement.css');
  assert.match(app,/plp-public-header fixed/);
  assert.match(css,/\.plp-public-brand__full/);
  assert.match(css,/@media \(max-width: 430px\)/);
  assert.ok(app.includes('menuOpen={isOpen}'));
  assert.match(app,/event\.key\s*===\s*'Escape'/);
  assert.ok(!placement.includes('.plp-mobile-action')); // Static-only dock selectors must not bleed into React.
  assert.ok(placement.includes('[data-plp-mobile-action="true"]'));
  assert.ok(placement.includes('[data-plp-hero]::before { content: none !important; }'));
  for(const path of ['public/accommodation.html','public/experiences.html']){
    const html=file(path);
    assert.ok(html.includes('/plp-static-shell.css'),path);
    assert.ok(html.includes('class="plp-static-menu"'),path);
    assert.ok(html.includes('Check availability'),path);
    assert.ok(html.includes('Ask concierge'),path);
  }
});

test('static editorial photography provides descriptive image alternatives',()=>{
  const rooms=file('public/accommodation.html'),experiences=file('public/experiences.html');
  assert.equal((rooms.match(/class="visual[^"]*"[^>]*><img /g)||[]).length,9);
  assert.equal((experiences.match(/class="visual[^"]*"[^>]*><img /g)||[]).length,3);
  for(const html of [rooms,experiences]) assert.ok(!/<img[^>]*alt=""/.test(html.replace(/<a class="brand"[^>]+><img[^>]*>/g,'')));
});

test('Club remains a proposed Boracay pilot with higher-reading-size copy and secondary regional vision',()=>{
  const club=file('src/ClubView.jsx'),css=file('src/index.css');
  assert.ok(club.includes('plp-future-chapter'));
  assert.ok(club.includes('Photography shows Pueblo La Perla property settings.'));
  assert.ok(club.includes('not confirmed Club sessions'));
  assert.match(css,/\.plp-club-program__body p \{ font-size:1rem;/);
  assert.ok(club.includes('No PLP–Changi Beach Club partnership'));
});

test('admin dashboard derives signals only through staff-authenticated endpoints',()=>{
  const app=file('src/admin/PlpEnterpriseAdminApp.jsx'),css=file('src/admin/plp-enterprise-admin.css');
  assert.ok(app.includes("'X-PLP-Staff-Code': code"));
  assert.ok(app.includes("action: 'concierge-inbox', status: 'NEW', scope: 'all'"));
  assert.ok(!app.includes("ClubAdminView"), 'Club administration is withheld until launch');
  assert.ok(!app.includes("operation=admin-activities"), 'Club API must not be called by staff dashboard');
  assert.ok(app.includes("refreshedAt={syncAt}"));
  assert.ok(app.includes('Data temporarily unavailable'));
  assert.ok(css.includes('.plp-day-quicklinks__grid--single'));
});

test('audit contrast colors exceed WCAG AA 4.5:1 for normal text',()=>{
  assert.ok(contrast('#55564f','#fffefa')>=4.5);
  assert.ok(contrast('#5f605a','#fffefa')>=4.5);
  assert.ok(contrast('#625636','#fffefa')>=4.5);
  assert.ok(contrast('#6b5a35','#faf9f5')>=4.5);
});

test('unapproved tariffs are labelled provisional without altering pricing or checkout contracts',()=>{
  const rate=file('lib/pricing.js'),rooms=file('public/accommodation.html'),booking=file('booking.html');
  for(const tier of ['premium: 1000','mid: 1000','entry: 1000'])assert.ok(rate.includes(tier));
  assert.ok(rooms.includes('Provisional website estimate / night'));
  assert.ok(rooms.includes('Pending approved tariff'));
  assert.ok(booking.includes('Provisional website estimate:'));
  assert.match(file('index.html'),/<title>Pueblo La Perla Boracay \| Private Hillside Villas<\/title>/);
});

test('open mobile menu covers the viewport below the header, not just the first link',()=>{
  const css=file('src/index.css');
  const app=file('src/App.jsx');
  assert.doesNotMatch(css,/\.plp-public-header\s*>\s*div\s*\{\s*height:/);
  assert.match(css,/\.plp-public-header\s*>\s*div:first-child\s*\{\s*height:\s*88px;/);
  assert.match(css,/#public-mobile-menu\s*\{[^}]*height:\s*calc\(100dvh - 88px\)/);
  assert.match(css,/#public-mobile-menu\s*\{[^}]*overflow-y:\s*auto/);
  assert.ok(app.includes('Mobile site navigation'));
  assert.ok(app.includes("document.body.style.overflow = 'hidden'"));
  assert.ok(app.includes("document.body.style.overflow = previousOverflow"));
  assert.ok(app.includes('menuOpen={isOpen}'));
  assert.ok(app.includes("toggle?.focus()"));
});
