import test from 'node:test';
import assert from 'node:assert/strict';

process.env.PLP_SUBSCRIPTION_SESSION_SECRET = 'plp-subscription-test-secret-not-for-production';

const {
  accessCookie,
  createAccessToken,
  getAccessSession,
  newSubscriptionState,
  safeReturnPath,
  stateCookie,
  verifyAccessToken,
} = await import('../api/subscription/_session.js');

test('subscription access tokens verify and expose only the subscription reference', () => {
  const token = createAccessToken('I-TESTSUBSCRIPTIONID', Date.now() + 60_000);
  assert.deepEqual(verifyAccessToken(token).subscriptionId, 'I-TESTSUBSCRIPTIONID');
});

test('tampered, expired, and malformed access tokens are rejected', () => {
  const expired = createAccessToken('I-TESTSUBSCRIPTIONID', Date.now() - 1);
  const valid = createAccessToken('I-TESTSUBSCRIPTIONID', Date.now() + 60_000);
  assert.equal(verifyAccessToken(expired), null);
  assert.equal(verifyAccessToken(valid + 'tampered'), null);
  assert.equal(verifyAccessToken('not-a-token'), null);
});

test('access cookie is HttpOnly, SameSite, Secure in production and short-lived', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const cookie = accessCookie('I-TESTSUBSCRIPTIONID').cookie;
    assert.match(cookie, /^plp_site_access=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /; Secure/);
    assert.match(cookie, /Max-Age=1800/);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('signed access cookie is parsed into a valid session', () => {
  const issued = accessCookie('I-TESTSUBSCRIPTIONID').cookie;
  const request = { headers: { cookie: issued.split(';')[0] } };
  assert.equal(getAccessSession(request).subscriptionId, 'I-TESTSUBSCRIPTIONID');
});

test('subscription state tokens are random and state cookies are short-lived', () => {
  assert.notEqual(newSubscriptionState(), newSubscriptionState());
  assert.match(stateCookie(newSubscriptionState()), /HttpOnly/);
  assert.match(stateCookie(newSubscriptionState()), /Max-Age=600/);
});

test('return URLs remain same-site paths and subscription/API routes cannot be targeted', () => {
  assert.equal(safeReturnPath('/booking?room=villa#dates'), '/booking?room=villa#dates');
  assert.equal(safeReturnPath('https://attacker.example'), '/');
  assert.equal(safeReturnPath('//attacker.example'), '/');
  assert.equal(safeReturnPath('/api/subscription/status'), '/');
  assert.equal(safeReturnPath('/subscribe?next=/'), '/');
});
