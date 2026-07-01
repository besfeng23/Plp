import { findBookingByReference } from '../_supabase.js';
import { createPayPalPaymentRecord } from '../paypal/_db.js';
import { SafePayPalError, createPayPalOrder } from '../paypal/_paypal.js';

function safeCheckoutStartupError(res, status, { code, detail }) {
  return res.status(status).json({
    ok: false,
    error: 'Unable to create PayPal checkout session',
    code,
    detail,
  });
}

function bookingReferenceFrom(input) {
  return String(input?.reference || input?.booking_reference || input?.id || '').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const submittedBooking = body.booking || body;
    const bookingReference = bookingReferenceFrom(submittedBooking);

    if (!bookingReference) {
      return res.status(400).json({ ok: false, error: 'Missing booking reference' });
    }

    const storedBooking = await findBookingByReference(bookingReference);
    if (!storedBooking) {
      return res.status(404).json({ ok: false, error: 'Booking request was not found for checkout' });
    }

    const order = await createPayPalOrder({ booking: storedBooking, req });
    const session = {
      provider: 'PAYPAL',
      checkoutUrl: order.approveUrl,
      paypalOrderId: order.id,
      paymentSessionId: order.id,
      referenceId: order.reference,
      status: 'DEPOSIT_CHECKOUT_CREATED',
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
      return safeCheckoutStartupError(res, 503, {
        code: 'PAYMENT_TABLE_INSERT_FAILED',
        detail: 'PayPal order was created but the payment row could not be written safely.',
      });
    }

    if (databaseWarning) {
      return safeCheckoutStartupError(res, 503, {
        code: 'SUPABASE_NOT_CONFIGURED',
        detail: 'Payment database is not configured.',
      });
    }

    if (!databasePayment?.id) {
      return safeCheckoutStartupError(res, 503, {
        code: 'PAYMENT_TABLE_INSERT_FAILED',
        detail: 'No payment row was created for this PayPal order.',
      });
    }

    if (String(databasePayment.provider_session_id || '') !== String(order.id)) {
      return safeCheckoutStartupError(res, 503, {
        code: 'PAYPAL_SESSION_STORE_FAILED',
        detail: 'The stored PayPal session did not match the created PayPal order.',
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
      note: 'Secure deposit checkout created from the stored booking amount. Final booking confirmation still requires resort review after payment verification.',
    });
  } catch (error) {
    const code = error instanceof SafePayPalError ? error.code : 'PAYPAL_ORDER_CREATE_FAILED';
    const status = error instanceof SafePayPalError ? error.status : 500;
    return safeCheckoutStartupError(res, status, {
      code,
      detail: error instanceof SafePayPalError ? error.message : 'PayPal checkout could not be started safely.',
    });
  }
}
