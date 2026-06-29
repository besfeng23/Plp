export class SafePayPalError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'SafePayPalError';
    this.code = code;
    this.status = status;
  }
}

export function getBaseUrlSource(req) {
  if (process.env.NEXT_PUBLIC_BASE_URL) return 'NEXT_PUBLIC_BASE_URL';
  if (process.env.SITE_URL) return 'SITE_URL';
  if (process.env.PUBLIC_SITE_URL) return 'PUBLIC_SITE_URL';
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return 'VERCEL_PROJECT_PRODUCTION_URL';
  if (process.env.VERCEL_URL) return 'VERCEL_URL';
  if (req?.headers?.['x-forwarded-host'] || req?.headers?.host) return 'request_host';
  return 'fallback';
}

export function getPayPalHealthConfig(req) {
  return {
    ok: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY),
    mode: getPayPalMode(),
    hasClientId: Boolean(process.env.PAYPAL_CLIENT_ID),
    hasClientSecret: Boolean(process.env.PAYPAL_CLIENT_SECRET),
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    hasSupabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    baseUrlSource: getBaseUrlSource(req),
  };
}

const PAYPAL_API_BASE = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

export function getBaseUrl(req) {
  const configured = process.env.NEXT_PUBLIC_BASE_URL || process.env.SITE_URL || process.env.PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host || 'plp-boracay.vercel.app';
  const proto = req?.headers?.['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export function getPayPalMode() {
  const mode = String(process.env.PAYPAL_MODE || process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
  return mode === 'live' ? 'live' : 'sandbox';
}

export function getPayPalApiBase() {
  return PAYPAL_API_BASE[getPayPalMode()];
}

function getPayPalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new SafePayPalError('PAYPAL_NOT_CONFIGURED', 'PayPal checkout is not configured.', 503);
  }

  return { clientId, clientSecret };
}

export async function getPayPalAccessToken() {
  const { clientId, clientSecret } = getPayPalCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    throw new SafePayPalError('PAYPAL_NOT_CONFIGURED', `PayPal OAuth failed with status ${response.status}.`, 503);
  }

  return data.access_token;
}

function safeText(value, fallback, max = 120) {
  const cleaned = String(value || fallback || '').replace(/[\r\n\t]+/g, ' ').trim();
  return cleaned.slice(0, max) || fallback;
}

export function getBookingReference(booking) {
  return safeText(booking?.reference || booking?.booking_reference || booking?.id, `PLP-${Date.now().toString().slice(-8)}`, 64).replace(/[^a-zA-Z0-9_-]/g, '');
}

export function getDepositAmount(booking) {
  const amount = Number(booking?.deposit || booking?.paymentDue || booking?.deposit_amount_php || 0);
  if (!Number.isFinite(amount) || amount < 1) {
    throw new SafePayPalError('PAYPAL_ORDER_CREATE_FAILED', 'Missing or invalid PayPal deposit amount.', 400);
  }

  return amount.toFixed(2);
}

export async function createPayPalOrder({ booking, req }) {
  const accessToken = await getPayPalAccessToken();
  const baseUrl = getBaseUrl(req);
  const reference = getBookingReference(booking);
  const amount = getDepositAmount(booking);
  const accommodation = safeText(booking?.accommodation, 'Pueblo La Perla stay', 80);
  const dateRange = safeText(`${booking?.checkIn || ''} to ${booking?.checkOut || ''}`, 'Reservation deposit', 100);

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: reference,
        custom_id: reference,
        description: `Pueblo La Perla reservation deposit ${reference}`.slice(0, 127),
        amount: {
          currency_code: 'PHP',
          value: amount,
          breakdown: {
            item_total: {
              currency_code: 'PHP',
              value: amount,
            },
          },
        },
        items: [
          {
            name: `${accommodation} deposit`.slice(0, 127),
            description: dateRange.slice(0, 127),
            quantity: '1',
            unit_amount: {
              currency_code: 'PHP',
              value: amount,
            },
            category: 'DIGITAL_GOODS',
          },
        ],
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: 'Pueblo La Perla Boracay',
          locale: 'en-PH',
          landing_page: 'LOGIN',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: `${baseUrl}/api/paypal/capture?bookingRef=${encodeURIComponent(reference)}`,
          cancel_url: `${baseUrl}/booking/cancel?bookingId=${encodeURIComponent(reference)}&provider=paypal`,
        },
      },
    },
  };

  const response = await fetch(`${getPayPalApiBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) {
    throw new SafePayPalError('PAYPAL_ORDER_CREATE_FAILED', `PayPal order creation failed with status ${response.status}.`, 502);
  }

  const approveUrl = data.links?.find((link) => link.rel === 'payer-action' || link.rel === 'approve')?.href;
  if (!approveUrl) throw new SafePayPalError('PAYPAL_ORDER_CREATE_FAILED', 'PayPal did not return an approval URL for this checkout order.', 502);

  return {
    id: data.id,
    reference,
    amount,
    currency: 'PHP',
    approveUrl,
    raw: data,
  };
}

export async function capturePayPalOrder(orderId) {
  if (!orderId) throw new Error('Missing PayPal order token.');
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${getPayPalApiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) {
    throw new Error(data?.message || data?.details?.[0]?.description || `PayPal capture failed with status ${response.status}`);
  }

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0] || null;
  return {
    orderId: data.id,
    captureId: capture?.id || null,
    status: data.status || capture?.status || 'UNKNOWN',
    captureStatus: capture?.status || null,
    amount: capture?.amount?.value || data.purchase_units?.[0]?.amount?.value || null,
    currency: capture?.amount?.currency_code || data.purchase_units?.[0]?.amount?.currency_code || null,
    raw: data,
  };
}
