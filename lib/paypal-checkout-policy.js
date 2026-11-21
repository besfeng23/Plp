// Pure, provider-independent expiry and terminal-state checkout policy.
export function isCheckoutAllowed(booking, now = Date.now()) {
  if (booking?.expires_at) {
    const expiration = Date.parse(booking.expires_at);
    if (!Number.isFinite(expiration) || expiration <= now) return false;
  }
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
