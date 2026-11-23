import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeCancel, describeSuccess, returnReference } from '../src/paymentReturn.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const q = s => new URLSearchParams(s);

test('booking page loads analytics exactly once and the script refuses a second setup', () => {
  const html = read('booking.html');
  assert.equal(html.split('src="/analytics.js"').length - 1, 1);
  const js = read('public/analytics.js');
  assert.match(js, /if \(window\.__plpAnalyticsLoaded\) return;\s*window\.__plpAnalyticsLoaded = true;/);
});

test('consent notice never covers the booking calendar or the mobile action bar', () => {
  assert.match(read('booking.html'), /<body data-plp-consent="inline">/);
  const js = read('public/analytics.js');
  assert.match(js, /dataset\.plpConsent !== 'float'/);
  assert.match(js, /policy\.before\(analyticsPanel\)/, 'inline notice sits in the page flow, after the booking form');
  assert.match(js, /--plp-consent-offset/, 'floating notice is lifted above the mobile action bar');
  assert.match(js, /document\.body\.style\.paddingBottom/, 'page reserves space while the notice shows');
  const css = read('public/analytics-consent.css');
  assert.match(css, /\[data-inline\] \{ position: static;/);
  assert.match(css, /bottom: var\(--plp-consent-offset, 0px\)/);
  assert.doesNotMatch(css, /bottom: calc\(80px/, 'no hard-coded overlap position');
  assert.match(css, /\[hidden\] \{ display: none !important; \}/);
});

test('room name and price are shown separately so neither is truncated at 390px', () => {
  const js = read('src/booking.js');
  assert.match(js, /new Option\(room\.name, room\.key\)/);
  assert.match(js, /' per night · up to ' \+ selected\.capacity \+ ' guests'/);
  assert.match(read('booking.html'), /<span class="room-meta" id="roomMeta"><\/span>/);
});

test('a verified PayPal return is clearly different from a bare or unpaid visit', () => {
  const paid = describeSuccess(q('bookingId=PLP-ABC123&provider=paypal&paypalOrderId=5O190127TN364715T&captureId=3C679366HH908993F'));
  assert.equal(paid.state, 'paid');
  assert.match(paid.title, /deposit was received/i);
  assert.match(paid.body, /final once they confirm/);
  const bare = describeSuccess(q(''));
  assert.equal(bare.state, 'unknown');
  assert.match(bare.body, /not confirmed/);
});

test('cancel and failure returns say exactly what happened, and never invite a double payment', () => {
  assert.equal(describeCancel(q('bookingId=PLP-ABC123&provider=paypal')).state, 'cancelled');
  assert.match(describeCancel(q('provider=paypal')).body, /No deposit was taken/);
  const review = describeCancel(q('provider=paypal&reason=AMOUNT_MISMATCH'));
  assert.equal(review.state, 'review');
  assert.match(review.body, /do not pay again/i);
  assert.equal(describeCancel(q('reason=CAPTURE_NOT_COMPLETED')).state, 'failed');
  assert.equal(describeCancel(q('reason=invalid-payment-return')).state, 'incomplete');
});

test('return pages invent no response times, opening hours or WhatsApp promises', () => {
  const shown = [describeSuccess(q('provider=paypal&paypalOrderId=5O190127TN364715T')), describeSuccess(q('')),
    ...['', 'AMOUNT_MISMATCH', 'CAPTURE_NOT_COMPLETED', 'x'].map(reason => describeCancel(q(reason ? 'reason=' + reason : '')))];
  for (const info of shown) {
    assert.doesNotMatch(`${info.kicker} ${info.title} ${info.body}`, /within|24 ?h|\bhours?\b|whatsapp|minutes|today|tomorrow/i);
  }
  assert.doesNotMatch(read('src/PaymentReturnViews.jsx'), />[^<]*(within|hours?|whatsapp)[^<]*</i);
  assert.doesNotMatch(read('src/App.jsx'), /Pending reference/);
});

test('reference shown on return pages is validated', () => {
  assert.equal(returnReference(q('bookingId=PLP-ABC123'), null), 'PLP-ABC123');
  assert.equal(returnReference(q('bookingId=<script>'), null), null);
  assert.equal(returnReference(q(''), { booking: { reference: 'PLP-XYZ789' } }), 'PLP-XYZ789');
  assert.equal(returnReference(q(''), null), null);
});
