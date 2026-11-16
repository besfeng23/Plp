// Display-only helpers. They never change stored reservations or payment state.
export function isTestRecord(row = {}) {
  if (row.is_test === true || row.is_demo === true) return true;
  const identifiers = ['booking_reference', 'reference', 'booking_code', 'notification_key', 'provider_event_id', 'provider_reference_id', 'ota_reservation_reference'];
  return identifiers.some(key => /^(mock|test|demo|qa)[-_:]/i.test(String(row[key] || '')))
    || /@(?:[^@]*\.)?example\.invalid$/i.test(String(row.guest_email || row.email || ''))
    || /^\[MOCK QA\]/i.test(String(row.subject || ''));
}

export function recordCurrency(row = {}) {
  const code = String(row.payment_currency || row.currency || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : '';
}

export function recordMoney(value, row = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  const code = recordCurrency(row);
  if (!code) return `${new Intl.NumberFormat('en-US').format(amount)} (currency not recorded)`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'code' }).format(amount);
}

export function totalsByCurrency(rows, valueOf) {
  const totals = new Map();
  for (const row of rows) {
    const value = valueOf(row);
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) continue;
    const currency = recordCurrency(row);
    totals.set(currency, (totals.get(currency) || 0) + Number(value));
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount }));
}
