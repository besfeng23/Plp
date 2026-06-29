import { createPayPalPaymentRecord } from '../paypal/_db.js';
import { SafePayPalError, createPayPalOrder } from '../paypal/_paypal.js';

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

    let databasePayment = null;
    let databaseWarning = null;
    try {
      ({ databasePayment, databaseWarning } = await createPayPalPaymentRecord({
        bookingReference: order.reference,
        session,
        amount: Number(order.amount),
        checkoutUrl: order.approveUrl,
        rawResponse: order.raw,
      }));
    } catch (storeError) {
      return res.status(503).json({
        ok: false,
        error: 'Unable to store PayPal checkout session',
        code: 'PAYPAL_SESSION_STORE_FAILED',
        detail: 'PayPal order was created but could not be stored in the payment table.',
      });
    }

    if (databaseWarning || !databasePayment) {
      return res.status(503).json({
        ok: false,
        error: 'Unable to store PayPal checkout session',
        code: databaseWarning ? 'SUPABASE_NOT_CONFIGURED' : 'PAYPAL_SESSION_STORE_FAILED',
        detail: databaseWarning ? 'Payment database is not configured.' : 'No payment row was created for this PayPal order.',
      });
    }

    return res.status(201).json({
      ok: true,
      ...session,
      databasePayment: {
        id: databasePayment.id,
        provider: databasePayment.provider,
        provider_session_id: databasePayment.provider_session_id,
        status: databasePayment.status,
        verification_status: databasePayment.verification_status,
      },
      databaseWarning: null,
      note: 'PayPal checkout order created. Redirect the guest to checkoutUrl to approve the 30% deposit.',
    });
  } catch (error) {
    const code = error instanceof SafePayPalError ? error.code : 'PAYPAL_ORDER_CREATE_FAILED';
    const status = error instanceof SafePayPalError ? error.status : 500;
    return res.status(status).json({
      ok: false,
      error: 'Unable to create PayPal checkout session',
      code,
      detail: error instanceof SafePayPalError ? error.message : 'PayPal checkout could not be started safely.',
    });
  }
}
