import { PLP_CURRENCY } from './pricing.js';

// Compare our persisted PayPal order with the provider return token BEFORE
// issuing a charge. A caller-controlled bookingRef must never be sufficient to
// capture an unrelated order.
const payableBookingStatuses = new Set(['PENDING_PAYMENT', 'PAYMENT_PROCESSING']);
const payablePaymentStatuses = new Set(['PENDING', 'PAYMENT_PROCESSING', 'PROCESSING', 'CREATED']);
const paidPaymentStatuses = new Set(['SUCCEEDED', 'CAPTURED']);

export function evaluatePayPalCapture({ booking, payment, bookingRef, orderToken, now = Date.now() }) {
  const fail = reason => ({ decision: 'reject', reason });
  if (!booking || !payment || !bookingRef || !orderToken) return fail('missing_record');
  if (String(booking.booking_reference) !== String(bookingRef) ||
      String(payment.provider_reference_id) !== String(bookingRef) ||
      String(payment.provider_session_id) !== String(orderToken) ||
      String(payment.booking_id) !== String(booking.id)) return fail('order_mismatch');

  const currency = String(payment.currency || '').toUpperCase();
  if (currency !== PLP_CURRENCY ||
      !Number.isFinite(Number(payment.amount_php)) ||
      Number(payment.amount_php) <= 0 ||
      Number(payment.amount_php) !== Number(booking.deposit_amount_php)) return fail('amount_or_currency_mismatch');

  const bookingStatus = String(booking.status || '').toUpperCase();
  const paymentStatus = String(payment.status || '').toUpperCase();
  const verification = String(payment.verification_status || '').toUpperCase();

  // The provider may redirect twice. Never capture a verified order again.
  if (verification === 'VERIFIED') {
    if (paidPaymentStatuses.has(paymentStatus) &&
        ['PAID_DEPOSIT', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'].includes(bookingStatus)) {
      return { decision: 'already_paid', reason: 'previously_verified' };
    }
    return fail('requires_reconciliation');
  }

  if (!payableBookingStatuses.has(bookingStatus) ||
      !payablePaymentStatuses.has(paymentStatus) ||
      !['PENDING', 'PROCESSING', ''].includes(verification)) return fail('not_payable');

  if (booking.expires_at) {
    const expiresAt = Date.parse(booking.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return fail('hold_expired');
  }
  return { decision: 'capture', reason: 'matched_pending_order' };
}
