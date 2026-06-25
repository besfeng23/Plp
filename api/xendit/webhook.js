import { notifyPaymentException, notifyPaymentVerified } from '../_notifications.js';
import { getSupabaseConfigError, isSupabaseConfigured, recordXenditWebhook } from '../_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!process.env.XENDIT_WEBHOOK_TOKEN) {
    return res.status(503).json({ ok: false, error: 'Xendit webhook token is not configured' });
  }

  const callbackToken = req.headers['x-callback-token'];
  if (callbackToken !== process.env.XENDIT_WEBHOOK_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Invalid webhook token' });
  }

  try {
    const event = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const data = event.data || event;
    const webhookId = req.headers['webhook-id'] || event.id || data.id;
    const eventType = event.event || event.event_type || event.type || 'unknown';
    const reference = data.reference_id || data.metadata?.booking_reference || event.reference_id;
    const providerPaymentId = data.payment_id || data.payment_request_id || data.capture_id || data.payment_session_id;
    const amount = data.request_amount || data.amount || data.capture_amount;
    const currency = data.currency;
    const status = data.status;

    if (!isSupabaseConfigured()) {
      return res.status(202).json({
        ok: true,
        received: true,
        persisted: false,
        warning: getSupabaseConfigError(),
        webhookId,
        eventType,
        reference,
        providerPaymentId,
      });
    }

    const persisted = await recordXenditWebhook({
      webhookId,
      eventType,
      reference,
      providerPaymentId,
      amount,
      currency,
      status,
      payload: event,
    });

    let notifications = null;
    if (!persisted.duplicate && reference) {
      try {
        if (persisted.verificationStatus === 'VERIFIED' && ['SUCCEEDED', 'CAPTURED'].includes(persisted.paymentStatus)) {
          notifications = await notifyPaymentVerified(reference);
        } else if (persisted.verificationStatus && !['VERIFIED', 'DUPLICATE'].includes(persisted.verificationStatus)) {
          notifications = await notifyPaymentException({
            reference,
            verificationStatus: persisted.verificationStatus,
            verificationNote: persisted.verificationNote,
            webhookId,
            eventType,
          });
        }
      } catch (error) {
        notifications = { ok: false, error: error.message };
      }
    }

    return res.status(200).json({
      ok: true,
      received: true,
      persisted: true,
      duplicate: persisted.duplicate,
      paymentStatus: persisted.paymentStatus,
      verificationStatus: persisted.verificationStatus,
      verificationNote: persisted.verificationNote,
      notifications,
      webhookId,
      eventType,
      reference,
      providerPaymentId,
    });
  } catch (error) {
    return res.status(400).json({ ok: false, error: 'Invalid webhook payload', detail: error.message });
  }
}
