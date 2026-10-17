import {
  getPayPalAccessToken as getCheckoutAccessToken,
  getPayPalApiBase,
} from '../paypal/_paypal.js';
import { insertRow, selectRows } from '../_supabase.js';

const PLAN_CONFIG_KEY = 'paypal_monthly_plan_id';
export const MONTHLY_AMOUNT = '10000.00';
export const MONTHLY_CURRENCY = 'PHP';

export class SubscriptionPayPalError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = 'SubscriptionPayPalError';
    this.code = code;
    this.status = status;
  }
}

async function paypalRequest(path, { method = 'GET', body, requestId } = {}) {
  const accessToken = await getCheckoutAccessToken();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Prefer: 'return=representation',
  };
  if (requestId) headers['PayPal-Request-Id'] = requestId;

  let response;
  try {
    response = await fetch(`${getPayPalApiBase()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new SubscriptionPayPalError('PAYPAL_UNAVAILABLE', 'PayPal could not be reached. Please try again.', 502);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('[plp-subscription] PayPal request failed', {
      path,
      status: response.status,
      issue: data?.name || data?.details?.[0]?.issue || 'unknown',
    });
    throw new SubscriptionPayPalError(
      'PAYPAL_SUBSCRIPTION_API_ERROR',
      'PayPal could not complete subscription setup. Confirm that Subscriptions API access is enabled for this merchant account.',
      502,
    );
  }
  return data || {};
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value));
}

export async function getMonthlyPlanId() {
  if (process.env.PAYPAL_SUBSCRIPTION_PLAN_ID) return String(process.env.PAYPAL_SUBSCRIPTION_PLAN_ID).trim();

  const rows = await selectRows(
    'plp_site_subscription_config',
    `setting_key=eq.${encodeFilterValue(PLAN_CONFIG_KEY)}&select=setting_value&limit=1`,
  );
  return rows?.[0]?.setting_value || null;
}

export async function validateMonthlyPlanId(planId) {
  if (!planId) {
    throw new SubscriptionPayPalError('PAYPAL_PLAN_NOT_CONFIGURED', 'The monthly PayPal subscription plan is not configured.', 503);
  }
  const plan = await paypalRequest(`/v1/billing/plans/${encodeURIComponent(planId)}`);
  const cycle = (plan.billing_cycles || []).find((item) => String(item.tenure_type || '').toUpperCase() === 'REGULAR');
  const frequency = cycle?.frequency || {};
  const price = cycle?.pricing_scheme?.fixed_price || {};
  const valid = plan.id === planId &&
    String(plan.status || '').toUpperCase() === 'ACTIVE' &&
    String(frequency.interval_unit || '').toUpperCase() === 'MONTH' &&
    Number(frequency.interval_count) === 1 &&
    Number(price.value) === 10000 &&
    String(price.currency_code || '').toUpperCase() === 'PHP';
  if (!valid) {
    throw new SubscriptionPayPalError(
      'PAYPAL_PLAN_MISMATCH',
      'The configured PayPal plan does not match the required active ₱10,000 PHP monthly subscription.',
      503,
    );
  }
  return planId;
}

export async function getValidatedMonthlyPlanId() {
  return validateMonthlyPlanId(await getMonthlyPlanId());
}

export async function ensureMonthlyPlanId() {
  const configured = await getMonthlyPlanId();
  if (configured) return validateMonthlyPlanId(configured);

  const product = await paypalRequest('/v1/catalogs/products', {
    method: 'POST',
    requestId: `plp-product-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    body: {
      name: 'Pueblo La Perla Website Access',
      description: 'Monthly subscription for access to Pueblo La Perla website services.',
      type: 'SERVICE',
      category: 'SOFTWARE',
    },
  });
  if (!product?.id) {
    throw new SubscriptionPayPalError('PAYPAL_PRODUCT_CREATE_FAILED', 'PayPal did not return a product ID for the subscription.', 502);
  }

  const plan = await paypalRequest('/v1/billing/plans', {
    method: 'POST',
    requestId: `plp-plan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    body: {
      product_id: product.id,
      name: 'PLP Monthly Website Access — PHP 10,000',
      description: 'Recurring monthly access to Pueblo La Perla website services.',
      billing_cycles: [{
        frequency: { interval_unit: 'MONTH', interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: { value: MONTHLY_AMOUNT, currency_code: MONTHLY_CURRENCY },
        },
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 1,
      },
    },
  });
  if (!plan?.id) {
    throw new SubscriptionPayPalError('PAYPAL_PLAN_CREATE_FAILED', 'PayPal did not return a monthly billing plan ID.', 502);
  }

  if (String(plan.status || '').toUpperCase() !== 'ACTIVE') {
    await paypalRequest(`/v1/billing/plans/${encodeURIComponent(plan.id)}/activate`, {
      method: 'POST',
      requestId: `plp-activate-${plan.id}`,
      body: {},
    });
  }

  // Verify the provider's stored plan, not just the requested amount.
  await validateMonthlyPlanId(plan.id);

  try {
    await insertRow('plp_site_subscription_config', {
      setting_key: PLAN_CONFIG_KEY,
      setting_value: plan.id,
      updated_at: new Date().toISOString(),
    });
    return plan.id;
  } catch (error) {
    // Concurrent first-time checkouts may provision two candidate plans. Use
    // the persisted winner and never depend on an unpersisted plan ID.
    const winner = await getMonthlyPlanId().catch(() => null);
    if (winner) return validateMonthlyPlanId(winner);
    throw error;
  }
}

export async function createPayPalSubscription({ planId, fullName, email, state, baseUrl, next }) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  const givenName = (parts.shift() || 'PLP').slice(0, 80);
  const surname = (parts.join(' ') || 'Subscriber').slice(0, 80);
  const returnUrl = `${baseUrl}/api/subscription/activate?state=${encodeURIComponent(state)}&next=${encodeURIComponent(next)}`;
  const cancelUrl = `${baseUrl}/subscribe?cancelled=1&next=${encodeURIComponent(next)}`;

  const data = await paypalRequest('/v1/billing/subscriptions', {
    method: 'POST',
    requestId: `plp-sub-${state.slice(0, 32)}`,
    body: {
      plan_id: planId,
      custom_id: state,
      subscriber: {
        name: { given_name: givenName, surname },
        email_address: String(email).trim().toLowerCase(),
      },
      application_context: {
        brand_name: 'Pueblo La Perla Boracay',
        locale: 'en-PH',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
        },
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    },
  });

  const approvalUrl = data.links?.find((item) => item.rel === 'approve')?.href;
  if (!data?.id || !approvalUrl) {
    throw new SubscriptionPayPalError('PAYPAL_APPROVAL_URL_MISSING', 'PayPal did not provide an approval link for this subscription.', 502);
  }
  return { id: data.id, planId: data.plan_id || planId, status: data.status || 'APPROVAL_PENDING', approvalUrl, raw: data };
}

export async function getPayPalSubscription(subscriptionId) {
  if (!subscriptionId || !/^I-[A-Z0-9-]{5,49}$/i.test(String(subscriptionId))) {
    throw new SubscriptionPayPalError('INVALID_SUBSCRIPTION_ID', 'The PayPal subscription reference is invalid.', 400);
  }
  return paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export async function cancelPayPalSubscription(subscriptionId) {
  return paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    body: { reason: 'Subscriber requested cancellation on the Pueblo La Perla website.' },
    requestId: `plp-cancel-${subscriptionId}`,
  });
}
