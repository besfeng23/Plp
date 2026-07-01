import { createPayPalPaymentRecord } from '../paypal/_db.js';
import { SafePayPalError, createPayPalOrder } from '../paypal/_paypal.js';
import { findBookingByReference, getSupabaseConfigError, isSupabaseConfigured, selectRows } from '../_supabase.js';

function safeCheckoutStartupError(res, status, { code, detail }) {
  return res.status(status).json({
    ok: false,
    error: 'Unable to create PayPal checkout session',
    code,
    detail,
  });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value));
}

async function requestMatchesPersistedGuest({ booking, persistedBooking }) {
  const submittedEmail = normalizeEmail(booking?.email);
  const guestId = persistedBooking?.guest_id;
  if (!submittedEmail || !guestId) return false;

  const guests = await selectRows('plp_guests', `id=eq.${encodeFilterValue(guestId)}&select=email,normalized_email&limit=1`);
  const guest = guests?.[0];
  const persistedEmail = normalizeEmail(guest?.normalized_email || guest?.email);
  return Boolean(persistedEmail && submittedEmail === persistedEmail);
}

function isCheckoutAllowed(booking) {
  const bookingStatus = String(booking?.status || '').trim().toUpperCase();
  const paymentStatus = String(booking?.payment_status || '').trim().toUpperCase();
  const terminalBookingStatuses = new Set([
    'PAID_DEPOSIT',
    'DEPOSIT_VERIFIED',
    'CONFIRMED',
    'CANCELLED',
    'VOIDED',
    'FAILED',
    'EXPIRED',
    'REFUNDED',
  ]);
  const terminalPaymentStatuses = new Set([
    'SUCCEEDED',
    'CAPTURED',
    'VERIFIED',
    'FAILED',
    'CANCELLED',
    'VOIDED',
    'EXPIRED',
    'REFUNDED',
  ]);

  return !terminalBookingStatuses.has(bookingStatus) && !terminalPaymentStatuses.has(paymentStatus);
}

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

    if (!isSupabaseConfigured()) {
      return safeCheckoutStartupError(res, 503, {
        code: 'SUPABASE_NOT_CONFIGURED',
        detail: getSupabaseConfigError() || 'Payment database is not configured.',
      });
    }

    const persistedBooking = await findBookingByReference(booking.reference);
    if (!persistedBooking) {
      return safeCheckoutStartupError(res, 404, {
        code: 'BOOKING_NOT_FOUND',
        detail: 'No matching reservation request was found for this reference.',
      });
    }

    const ownsBooking = await requestMatchesPersistedGuest({ booking, persistedBooking });
    if (!ownsBooking) {
      return safeCheckoutStartupError(res, 404, {
        code: 'BOOKING_NOT_FOUND',
        detail: 'No matching reservation request was found for this reference.',
      });
    }

    if (!isCheckoutAllowed(persistedBooking)) {
      return safeCheckoutStartupError(res, 409, {
        code: 'CHECKOUT_NOT_AVAILABLE_FOR_STATUS',
        detail: 'Checkout is not available for this booking in its current payment state.',
      });
    }

    // Never trust a client-supplied deposit amount: the checkout order is always created
    // for the deposit already computed and persisted server-side by /api/bookings.
    const authoritativeBooking = { ...booking, deposit: persistedBooking.deposit_amount_php, paymentDue: persistedBooking.deposit_amount_php };

    const order = await createPayPalOrder({ booking: authoritativeBooking, req });
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
      note: 'PayPal checkout order created. Redirect the guest to checkoutUrl to approve the 30% deposit.',
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
