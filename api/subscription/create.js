import { randomBytes } from 'node:crypto';
import { getBaseUrl } from '../paypal/_paypal.js';
import { getSupabaseConfigError, insertRow, isSupabaseConfigured } from '../_supabase.js';
import { createPayPalSubscription, ensureMonthlyPlanId, SubscriptionPayPalError } from './_paypal.js';
import { newSubscriptionState, safeReturnPath, setCookies, stateCookie } from './_session.js';

function parseBody(body) {
  if (body && typeof body === 'object') return body;
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return {};
}

function firstNameParts(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  const body = parseBody(req.body);
  const fullName = String(body.name || '').trim().replace(/[\r\n\t]+/g, ' ').slice(0, 120);
  const email = String(body.email || '').trim().toLowerCase();
  const next = safeReturnPath(body.next);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (fullName.length < 2 || !emailPattern.test(email) || email.length > 180) {
    return res.status(400).json({ ok: false, message: 'Enter your name and a valid email address to continue.' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ ok: false, message: getSupabaseConfigError() });
  }

  const state = newSubscriptionState();
  try {
    const planId = await ensureMonthlyPlanId();
    const baseUrl = getBaseUrl(req);
    const subscription = await createPayPalSubscription({ planId, fullName, email, state, baseUrl, next });
    const parts = firstNameParts(fullName);
    const row = {
      provider_subscription_id: subscription.id,
      email,
      full_name: fullName,
      plan_id: subscription.planId,
      custom_id: state,
      status: subscription.status,
      amount_php: 10000,
      currency: 'PHP',
      next_billing_time: null,
      last_verified_at: null,
      raw_response: subscription.raw,
      updated_at: new Date().toISOString(),
    };
    await insertRow('plp_site_subscriptions', row);
    setCookies(res, [stateCookie(state)]);
    return res.status(201).json({
      ok: true,
      approvalUrl: subscription.approvalUrl,
      amount: 10000,
      currency: 'PHP',
      interval: 'MONTH',
    });
  } catch (error) {
    const isPayPal = error instanceof SubscriptionPayPalError;
    const status = isPayPal ? error.status : 503;
    const message = isPayPal
      ? error.message
      : 'Subscription setup could not be saved. Check the PLP subscription database migration and try again.';
    console.error('[plp-subscription] checkout could not be created', {
      code: isPayPal ? error.code : 'SUBSCRIPTION_STORE_FAILED',
      status,
    });
    return res.status(status).json({ ok: false, message });
  }
}
