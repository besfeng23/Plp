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
    const bookingReference = data.reference_id || data.metadata?.booking_reference || event.reference_id;
    const paymentId = data.payment_id || data.payment_request_id || data.capture_id || data.payment_session_id;
    const amount = data.request_amount || data.amount || data.capture_amount;
    const currency = data.currency;
    const status = data.status;

    // Production note:
    // Persist webhookId/paymentId in a database before updating booking state.
    // This demo endpoint verifies authenticity and returns fast acknowledgement.
    console.log('Xendit webhook received', {
      webhookId,
      eventType,
      bookingReference,
      paymentId,
      amount,
      currency,
      status,
    });

    return res.status(200).json({
      ok: true,
      received: true,
      webhookId,
      eventType,
      bookingReference,
      paymentId,
    });
  } catch (error) {
    return res.status(400).json({ ok: false, error: 'Invalid webhook payload' });
  }
}
