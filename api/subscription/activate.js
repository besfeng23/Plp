import { getBaseUrl } from '../paypal/_paypal.js';
import { selectRows, updateRows } from '../_supabase.js';
import { getMonthlyPlanId, getPayPalSubscription, SubscriptionPayPalError } from './_paypal.js';
import { accessCookie, clearStateCookie, getStateCookie, safeReturnPath, setCookies } from './_session.js';

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function redirect(res, location, cookies = []) {
  if (cookies.length) setCookies(res, cookies);
  res.statusCode = 303;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return res.end();
}

function subscribeUrl(req, code, next) {
  const baseUrl = getBaseUrl(req);
  const url = new URL('/subscribe', baseUrl);
  if (code) url.searchParams.set('error', code);
  if (next && next !== '/') url.searchParams.set('next', next);
  return url.toString();
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed.');
  }

  const query = req.query || {};
  const state = String(firstQueryValue(query.state) || '');
  const subscriptionId = String(firstQueryValue(query.subscription_id) || firstQueryValue(query.token) || '');
  const next = safeReturnPath(firstQueryValue(query.next));
  const baseUrl = getBaseUrl(req);

  if (!state || !subscriptionId || state !== getStateCookie(req)) {
    return redirect(res, subscribeUrl(req, 'verification_failed', next), [clearStateCookie()]);
  }

  try {
    const [row] = await selectRows(
      'plp_site_subscriptions',
      `provider_subscription_id=eq.${encodeFilterValue(subscriptionId)}&select=provider_subscription_id,email,full_name,plan_id,custom_id,status&limit=1`,
    );
    if (!row || row.custom_id !== state) {
      return redirect(res, subscribeUrl(req, 'verification_failed', next), [clearStateCookie()]);
    }

    const [details, expectedPlanId] = await Promise.all([
      getPayPalSubscription(subscriptionId),
      getMonthlyPlanId(),
    ]);
    const status = String(details.status || '').toUpperCase();
    const verified = details.id === subscriptionId &&
      Boolean(expectedPlanId) &&
      details.plan_id === expectedPlanId &&
      row.plan_id === expectedPlanId &&
      details.custom_id === state &&
      status === 'ACTIVE';

    if (!verified) {
      await updateRows('plp_site_subscriptions', `provider_subscription_id=eq.${encodeFilterValue(subscriptionId)}`, {
        status: details.status || row.status,
        raw_response: details,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return redirect(res, subscribeUrl(req, 'subscription_not_active', next), [clearStateCookie()]);
    }

    const nextBillingTime = details.billing_info?.next_billing_time || null;
    await updateRows('plp_site_subscriptions', `provider_subscription_id=eq.${encodeFilterValue(subscriptionId)}`, {
      email: details.subscriber?.email_address || row.email,
      status,
      plan_id: details.plan_id,
      next_billing_time: nextBillingTime,
      last_verified_at: new Date().toISOString(),
      raw_response: details,
      updated_at: new Date().toISOString(),
    });

    const issued = accessCookie(subscriptionId);
    return redirect(res, new URL(next, baseUrl).toString(), [issued.cookie, clearStateCookie()]);
  } catch (error) {
    console.error('[plp-subscription] activation verification failed', {
      code: error instanceof SubscriptionPayPalError ? error.code : 'ACTIVATION_CHECK_FAILED',
      status: error instanceof SubscriptionPayPalError ? error.status : 500,
    });
    return redirect(res, subscribeUrl(req, 'verification_unavailable', next), [clearStateCookie()]);
  }
}
