// Single source of truth for Pueblo La Perla nightly pricing.
//
// These are the premium nightly rates (USD) per accommodation tier. The server
// booking route computes the authoritative quote from this catalog. The
// booking calendar imports it, and the static-page build renders its rates.
export const PLP_CURRENCY = 'USD';

export const PLP_PRICES = {
  premium: 1000, // Grand Ocean Villa   (top tier)
  mid: 1000,     // Sunset Suite        (middle tier)
  entry: 1000,   // Smart Room Premium  (entry tier)
};

// Maps the canonical accommodation names used across the booking form, API,
// admin, OTA managers, and structured data to their nightly rate.
export const PLP_ROOMS = [
  { key: 'grandOceanVilla', slug: 'grand-ocean-villa', name: 'Grand Ocean Villa', rate: PLP_PRICES.premium, capacity: 8 },
  { key: 'sunsetSuite', slug: 'sunset-suite', name: 'Sunset Suite', rate: PLP_PRICES.mid, capacity: 4 },
  { key: 'smartRoomPremium', slug: 'smart-room-premium', name: 'Smart Room Premium', rate: PLP_PRICES.entry, capacity: 2 },
];

export const PLP_TIER_BY_ACCOMMODATION = Object.fromEntries(PLP_ROOMS.map(room => [room.name, room.rate]));

// Deposit charged at checkout as a fraction of the full stay total.
export const PLP_DEPOSIT_RATE = 0.3;

export function quoteStay(room, nights) {
  const amount = nights * room.rate;
  const deposit = Math.round(amount * PLP_DEPOSIT_RATE);
  return { amount, deposit, balance: amount - deposit };
}

// Formats a money amount in the given currency. Catalog currency is USD.
export function formatMoney(value, currency = PLP_CURRENCY) {
  const amount = Number(value || 0);
  const code = String(currency || PLP_CURRENCY).toUpperCase();
  try {
    return new Intl.NumberFormat(code === 'PHP' ? 'en-PH' : 'en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString('en-US')}`;
  }
}

// Backward-compatible alias; formats in the current catalog currency (USD).
export function formatPeso(value) {
  return formatMoney(value);
}

// Explicit currency label for booking and payment surfaces ("USD 1,000").
export function formatUsd(value) {
  const amount = Number(value || 0);
  return 'USD ' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount);
}

export function roomByName(name) {
  return PLP_ROOMS.find(room => room.name === String(name || '')) || null;
}

// Server-side price authority. Recomputes the stay from the catalog; returns
// null when the accommodation or stay length cannot be priced.
export function authoritativeQuote(accommodationName, nights) {
  const room = roomByName(accommodationName);
  const n = Number(nights);
  if (!room || !Number.isInteger(n) || n < 1 || n > 60) return null;
  return { currency: PLP_CURRENCY, rate: room.rate, nights: n, ...quoteStay(room, n) };
}

// Legacy column compatibility mapping. Columns named *_php predate the USD
// catalog; they hold amounts in the record's own currency and must NOT be read
// as pesos by name. Payments carry an explicit `currency` column. Bookings carry
// none, so a booking is identified as USD only when its stored nightly rate and
// totals match the current USD catalog; otherwise its currency is unrecorded.
export const LEGACY_AMOUNT_COLUMNS = Object.freeze({
  plp_bookings: Object.freeze({ rate: 'rate_per_night_php', total: 'total_amount_php', deposit: 'deposit_amount_php', balance: 'balance_amount_php' }),
  plp_payments: Object.freeze({ amount: 'amount_php', currency: 'currency' }),
  plp_payment_events: Object.freeze({ amount: 'amount_php', expected: 'expected_amount_php', currency: 'currency' }),
});

export function bookingAmounts(row = {}) {
  const c = LEGACY_AMOUNT_COLUMNS.plp_bookings;
  const rate = Number(row[c.rate]), total = Number(row[c.total]), deposit = Number(row[c.deposit]), balance = Number(row[c.balance]);
  const quote = authoritativeQuote(row.accommodation_name, row.nights);
  const matchesCatalog = Boolean(quote && rate === quote.rate && total === quote.amount && deposit === quote.deposit);
  return { currency: matchesCatalog ? PLP_CURRENCY : '', rate, total, deposit, balance, matchesCatalog, expected: quote };
}
