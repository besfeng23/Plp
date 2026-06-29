import { getBaseUrl, getPayPalMode } from './_paypal.js';

export default function handler(req, res) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  const derivedBaseUrl = getBaseUrl(req);

  res.status(200).json({
    ok: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    mode: getPayPalMode(),
    hasClientId: Boolean(process.env.PAYPAL_CLIENT_ID),
    hasClientSecret: Boolean(process.env.PAYPAL_CLIENT_SECRET),
    baseUrl: {
      configured: Boolean(configuredBaseUrl),
      value: configuredBaseUrl ? configuredBaseUrl.replace(/\/$/, '') : derivedBaseUrl,
      source: configuredBaseUrl ? 'NEXT_PUBLIC_BASE_URL' : 'derived',
    },
  });
}
