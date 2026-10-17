import { selectRows, updateRows } from '../_supabase.js';
import { getValidatedMonthlyPlanId, getPayPalSubscription, SubscriptionPayPalError } from './_paypal.js';
import { accessCookie, clearAccessCookie, getAccessSession, setCookies } from './_session.js';

function encodeFilterValue(value) {
  return encodeURIComponent(String(value));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, active: false, message: 'Method not allowed.' });
  }

  const session = getAccessSession(req);
  if (!session) {
    setCookies(res, [clearAccessCookie()]);
    return res.status(200).json({ ok: true, active: false });
  }

  try {
    const filter = `provider_subscription_id=eq.${encodeFilterValue(session.subscriptionId)}&select=provider_subscription_id,email,full_name,plan_id,status,next_billing_time&limit=1`;
    const [row, expectedPlanId] = await Promise.all([
      selectRows('plp_site_subscriptions', filter).then((rows) => rows?.[0] || null),
      getMonthlyPlanId(),
    ]);
    if (!row || !expectedPlanId || row.plan_id !== expectedPlanId) {
      setCookies(res, [clearAccessCookie()]);
      return res.status(200).json({ ok: true, active: false });
    }

    const details = await getPayPalSubscription(session.subscriptionId);
    const active = details.id === session.subscriptionId &&
      details.plan_id === expectedPlanId &&
      String(details.status || '').toUpperCase() === 'ACTIVE';

    await updateRows('plp_site_subscriptions', filter.split('&')[0], {
      status: details.status || row.status,
      email: details.subscriber?.email_address || row.email,
      plan_id: details.plan_id || row.plan_id,
      next_billing_time: details.billing_info?.next_billing_time || null,
      last_verified_at: new Date().toISOString(),
      raw_response: details,
      updated_at: new Date().toISOString(),
    });

    if (!active) {
      setCookies(res, [clearAccessCookie()]);
      return res.status(200).json({ ok: true, active: false, status: details.status || 'INACTIVE' });
    }

    // Refresh a short-lived access session only after PayPal confirms it is
    // still ACTIVE and its plan matches the server-configured monthly plan.
    const refreshed = accessCookie(session.subscriptionId);
    setCookies(res, [refreshed.cookie]);
    return res.status(200).json({
      ok: true,
      active: true,
      status: 'ACTIVE',
      email: details.subscriber?.email_address || row.email,
      nextBillingTime: details.billing_info?.next_billing_time || null,
    });
  } catch (error) {
    console.error('[plp-subscription] status verification failed', {
      code: error instanceof SubscriptionPayPalError ? error.code : 'SUBSCRIPTION_STATUS_CHECK_FAILED',
      status: error instanceof SubscriptionPayPalError ? error.status : 500,
    });
    return res.status(503).json({
      ok: false,
      active: false,
      message: 'PayPal subscription status could not be verified. Refresh and try again.',
    });
  }
}
