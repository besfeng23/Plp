import { displayStatus, money, nightsBetween, pick } from './v3Format.js';

export function summarizeReservation(row) {
  const state = displayStatus(row);
  const checkIn = pick(row, ['check_in']);
  const checkOut = pick(row, ['check_out']);
  return {
    reference: pick(row, ['booking_reference', 'reference']),
    guestName: pick(row, ['guest_name', 'full_name', 'name']),
    guestEmail: pick(row, ['guest_email', 'email']),
    room: pick(row, ['accommodation_name', 'accommodation']),
    checkIn,
    checkOut,
    nights: nightsBetween(checkIn, checkOut),
    total: money(pick(row, ['total_amount_php', 'amount'], 0)),
    deposit: money(pick(row, ['deposit_amount_php', 'payment_amount_php'], 0)),
    balance: money(pick(row, ['balance_amount_php'], 0)),
    statusLabel: state.label,
    statusTone: state.tone,
    isLongStay: nightsBetween(checkIn, checkOut) >= 14,
    isHighTouch: Number(pick(row, ['total_amount_php'], 0)) >= 120000 || nightsBetween(checkIn, checkOut) >= 7,
  };
}

export function buildAttentionQueue(rows, exceptions = [], notifications = []) {
  const queue = [];
  rows.forEach((row) => {
    const summary = summarizeReservation(row);
    if (summary.statusLabel === 'Paid deposit') {
      queue.push({ type: 'revenue', tone: 'good', row, summary, message: 'Deposit verified. Review availability and confirm.' });
    }
    if (summary.isLongStay) {
      queue.push({ type: 'long stay', tone: 'warn', row, summary, message: 'Long stay requires balance, housekeeping rhythm, and concierge review.' });
    }
    if (summary.statusTone === 'bad') {
      queue.push({ type: 'payment risk', tone: 'bad', row, summary, message: 'Payment state needs reconciliation.' });
    }
  });
  exceptions.forEach((item) => queue.push({ type: 'exception', tone: 'bad', row: item, summary: summarizeReservation(item), message: 'Payment exception requires review.' }));
  notifications.filter((item) => String(item.status || '').toUpperCase() === 'FAILED').forEach((item) => queue.push({ type: 'message', tone: 'bad', row: item, summary: summarizeReservation(item), message: 'Message delivery failed.' }));
  return queue;
}
