import { createPayPalPaymentRecord } from '../paypal/_db.js';
import { createPayPalOrder } from '../paypal/_paypal.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const booking = body.booking || body;

    if (!booking?.reference || !booking?.name || !booking?.email) {
      return res.status(400).json({ ok: false, error: 'Missing booking reference or guest details' });
    }

    const order = await createPayPalOrder({ booking, req });
    const session = {
      provider: 'PAYPAL',
      checkoutUrl: order.approveUrl,
      paypalOrderId: order.id,
      paymentSessionId: order.id,
      referenceId: order.reference,
      status: 'CREATED',
      amount: Number(order.amount),
      currency: order.currency,
    };

    const { databasePayment, databaseWarning } = await createPayPalPaymentRecord({
      bookingReference: order.reference,
      session,
      amount: Number(order.amount),
      checkoutUrl: order.approveUrl,
      rawResponse: order.raw,
    });

    return res.status(201).json({
      ok: true,
      ...session,
      databasePayment,
      databaseWarning,
      note: 'PayPal checkout order created. Redirect the guest to checkoutUrl to approve the 30% deposit.',
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Unable to create PayPal checkout session', detail: error.message });
  }
}
