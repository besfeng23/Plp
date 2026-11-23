// Describes what a guest returning from PayPal should be told. Pure, so it is unit-tested.
// /booking/success is only reached from api/paypal/capture.js after a verified capture
// (paypalOrderId [+ captureId]); a bare visit proves nothing, so it is shown as "not confirmed".
// No response times, opening hours or WhatsApp availability are promised here.

const REFERENCE = /^[A-Za-z0-9_-]{6,64}$/;
const NEEDS_REVIEW = new Set(['ORDER_ID_MISMATCH', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'payment-needs-review',
  'payment-review-required', 'capture-not-verified', 'UNMATCHED_PAYMENT', 'UNMATCHED_REFERENCE']);
const NOT_PAID = new Set(['CAPTURE_NOT_COMPLETED', 'DECLINED', 'VOIDED', 'FAILED']);

export function returnReference(params, stored) {
  const fromUrl = params.get('bookingId') || params.get('bookingRef');
  const candidate = fromUrl || stored?.booking?.reference || '';
  return REFERENCE.test(candidate) ? candidate : null;
}

export function describeSuccess(params) {
  const paid = params.get('provider') === 'paypal' && /^[A-Za-z0-9_-]{6,128}$/.test(params.get('paypalOrderId') || '');
  if (paid) {
    return {
      state: 'paid', kicker: 'Deposit received',
      title: 'Your deposit was received.',
      body: 'PayPal confirmed the deposit and it matched your request. The PLP reservation team now reviews the stay; your booking is final once they confirm it to you.',
    };
  }
  return {
    state: 'unknown', kicker: 'Reservation request',
    title: 'We could not confirm a payment here.',
    body: 'This page did not receive a completed payment. If you paid, keep your PayPal receipt and contact concierge with your reference. Your stay is not confirmed yet.',
  };
}

export function describeCancel(params) {
  const reason = params.get('reason') || '';
  if (!reason) {
    return {
      state: 'cancelled', kicker: 'Checkout cancelled',
      title: 'You left checkout before paying.',
      body: 'No deposit was taken and your stay is not confirmed. You can try again with the same dates or ask concierge for help.',
    };
  }
  if (NEEDS_REVIEW.has(reason)) {
    return {
      state: 'review', kicker: 'Payment needs review',
      title: 'Your payment needs a manual check.',
      body: 'Please do not pay again. The PLP team will review this payment against your request. Your stay is not confirmed until they contact you.',
    };
  }
  if (NOT_PAID.has(reason)) {
    return {
      state: 'failed', kicker: 'Payment not completed',
      title: 'PayPal did not complete the payment.',
      body: 'No deposit was received and your stay is not confirmed. You can try again or contact concierge.',
    };
  }
  return {
    state: 'incomplete', kicker: 'Checkout incomplete',
    title: 'The payment return was incomplete.',
    body: 'We could not match this return to a payment. Please do not pay again before checking with concierge. Your stay is not confirmed.',
  };
}
