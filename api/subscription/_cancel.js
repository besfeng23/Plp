import { getPayPalSubscription } from './_paypal.js';
import { cancelPayPalSubscription } from './_paypal.js';
import { updateRows } from '../_supabase.js';
import { clearAccessCookie, getAccessSession, setCookies } from './_session.js';

function encodeFilterValue(value) {
  return encodeURIComponent(String(value));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  const baseOrigin = process.env.NEXT_PUBLIC_BASE_URL || process.env.SITE_URL || process.env.PUBLIC_SITE_URL;
  const origin = String(req.headers?.origin || '');
  if (origin && baseOrigin && origin !== baseOrigin.replace(/\/$/, '')) {
    return res.status(403).json({ ok: false, message: 'Request origin could not be verified.' });
  }

  const session = getAccessSession(req);
  if (!session) {
    setCookies(res, [clearAccessCookie()]);
    return res.status(401).json({ ok: false, message: 'No active subscription session was found.' });
  }

  try {
    const details = await getPayPalSubscription(session.subscriptionId);
    if (details.id !== session.subscriptionId) {
      setCookies(res, [clearAccessCookie()]);
      return res.status(403).json({ ok: false, message: 'Subscription reference could not be verified.' });
    }
    if (String(details.status || '').toUpperCase() === 'ACTIVE') {
      await cancelPayPalSubscription(session.subscriptionId);
    }

    await updateRows(
      'plp_site_subscriptions',
      `provider_subscription_id=eq.${encodeFilterValue(session.subscriptionId)}`,
      {
        status: 'CANCELLED',
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    );
    setCookies(res, [clearAccessCookie()]);
    return res.status(200).json({ ok: true, message: 'The PayPal subscription cancellation request was sent.' });
  } catch {
    return res.status(502).json({
      ok: false,
      message: 'PayPal could not cancel the subscription. You can also manage recurring payments in your PayPal account.',
    });
  }
}
