const STATUS_NAMES = {
  REQUEST_RECEIVED: 'Request received',
  PENDING: 'Request received',
  PENDING_PAYMENT: 'Awaiting deposit',
  PENDING_DEPOSIT: 'Awaiting deposit',
  AWAITING_DEPOSIT: 'Awaiting deposit',
  PAYMENT_PROCESSING: 'Payment processing',
  PAID_DEPOSIT: 'Deposit verified · Awaiting confirmation',
  DEPOSIT_VERIFIED: 'Deposit verified · Awaiting confirmation',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked in',
  CHECKED_OUT: 'Checked out',
  CANCELLED: 'Cancelled',
  CANCELED: 'Cancelled',
  VOIDED: 'Cancelled',
  REFUNDED: 'Refunded',
};

export function rowField(row, names, fallback = '') {
  for (const name of names) {
    const value = row?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return fallback;
}

export function statusKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export function bookingStatus(value) {
  const normalized = statusKey(value);
  return STATUS_NAMES[normalized] || (normalized ? 'Review needed' : 'Request received');
}

export function reservationReference(row) {
  return String(rowField(row, ['booking_reference', 'reference', 'booking_code'], '—'));
}

export function guestName(row) {
  return String(rowField(row, ['guest_name', 'name', 'full_name'], 'Not provided'));
}

export function checkIn(row) {
  return String(rowField(row, ['check_in', 'arrival_date', 'checkIn'])).slice(0, 10);
}

export function checkOut(row) {
  return String(rowField(row, ['check_out', 'departure_date', 'checkOut'])).slice(0, 10);
}

export function php(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount) : '—';
}

export function manilaToday(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isPaymentReview(row) {
  const payment = statusKey(rowField(row, ['payment_status', 'booking_payment_status']));
  const booking = statusKey(rowField(row, ['booking_status', 'status']));
  const verification = statusKey(rowField(row, ['payment_verification_status']));
  if (['CANCELLED', 'CANCELED', 'VOIDED', 'REFUNDED'].includes(booking)) return false;
  if (['UNMATCHED_REFERENCE', 'UNMATCHED_PAYMENT', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'FAILED', 'ORDER_ID_MISMATCH', 'ORDER_SESSION_MISSING', 'CAPTURE_NOT_COMPLETED'].includes(verification)) return true;
  if (['FAILED', 'ERROR', 'REJECTED'].includes(payment)) return true;
  return ['PAYMENT_PROCESSING', 'PAID_DEPOSIT', 'DEPOSIT_VERIFIED'].includes(booking) && verification !== 'VERIFIED';
}

export function needsStaffReview(row) {
  const booking = statusKey(rowField(row, ['booking_status', 'status']));
  return isPaymentReview(row) || ['PAID_DEPOSIT', 'DEPOSIT_VERIFIED', 'PENDING', 'REQUEST_RECEIVED'].includes(booking);
}

export function summarizeRecords(rows = [], exceptions = [], notifications = [], tasks = [], today = manilaToday()) {
  const validRows = Array.isArray(rows) ? rows : [];
  const active = validRows.filter((row) => !['CANCELLED', 'CANCELED', 'VOIDED', 'REFUNDED'].includes(statusKey(rowField(row, ['booking_status', 'status']))));
  // A paid deposit or an unconfirmed request is not evidence a guest has checked in.
  const inHouse = active.filter((row) => ['CONFIRMED', 'CHECKED_IN'].includes(statusKey(rowField(row, ['booking_status', 'status']))) && checkIn(row) && checkOut(row) && checkIn(row) <= today && checkOut(row) > today);
  const review = validRows.filter(needsStaffReview);
  // Verified historical payments for cancelled/refunded bookings must not be
  // presented as current verified deposits on the operational revenue screen.
  const verified = active.filter((row) => statusKey(row.payment_verification_status) === 'VERIFIED' && statusKey(row.payment_status) !== 'REFUNDED');
  return {
    arrivals: active.filter((row) => checkIn(row) === today),
    departures: active.filter((row) => checkOut(row) === today),
    inHouse,
    review,
    upcoming: active.filter((row) => checkIn(row) >= today).sort((a, b) => checkIn(a).localeCompare(checkIn(b))).slice(0, 12),
    exceptionCount: Array.isArray(exceptions) ? exceptions.length : 0,
    notificationCount: Array.isArray(notifications) ? notifications.length : 0,
    openTasks: Array.isArray(tasks) ? tasks.filter((task) => !['done', 'cancelled'].includes(String(task.status || '').toLowerCase())) : [],
    confirmedValue: validRows.filter((row) => statusKey(row.booking_status) === 'CONFIRMED' && statusKey(row.payment_status) !== 'REFUNDED').reduce((total, row) => total + (Number(row.total_amount_php) || 0), 0),
    verifiedDeposits: verified.reduce((total, row) => total + (Number(row.deposit_amount_php ?? row.payment_amount_php) || 0), 0),
  };
}

export function buildGuestRoster(rows = []) {
  const guests = new Map();
  rows.forEach((row) => {
    const email = String(rowField(row, ['guest_email', 'email'])).trim().toLowerCase();
    const key = email || `booking:${reservationReference(row)}`;
    const entry = guests.get(key) || { key, name: guestName(row), email, reservations: [], requests: [] };
    entry.reservations.push(row);
    const request = rowField(row, ['special_requests', 'guest_notes', 'notes', 'message']);
    if (request) entry.requests.push({ reference: reservationReference(row), text: String(request) });
    guests.set(key, entry);
  });
  return [...guests.values()].sort((a, b) => a.name.localeCompare(b.name));
}
