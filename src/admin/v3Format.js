export const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH')}`;

export function safe(value, fallback = '—') {
  return value === undefined || value === null || value === '' ? fallback : value;
}

export function pick(row, keys, fallback = '') {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key];
  }
  return fallback;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function nightsBetween(start, end) {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 86400000);
}

export function displayStatus(row) {
  const verification = String(pick(row, ['payment_verification_status', 'verification_status'], '')).toUpperCase();
  const payment = String(pick(row, ['payment_status', 'booking_payment_status'], '')).toUpperCase();
  const booking = String(pick(row, ['booking_status', 'status'], '')).toUpperCase();

  if (booking === 'CONFIRMED') return { label: 'Confirmed', tone: 'good' };
  if (booking === 'CANCELLED') return { label: 'Cancelled', tone: 'bad' };
  if (verification === 'VERIFIED' && ['SUCCEEDED', 'CAPTURED'].includes(payment)) return { label: 'Paid deposit', tone: 'good' };
  if (verification && !['VERIFIED', 'PENDING'].includes(verification)) return { label: verification, tone: 'bad' };
  if (payment === 'FAILED' || payment === 'EXPIRED') return { label: payment, tone: 'bad' };
  if (payment === 'PROCESSING' || booking === 'PAYMENT_PROCESSING') return { label: 'Payment review', tone: 'warn' };
  return { label: booking || payment || 'Pending', tone: 'warn' };
}
