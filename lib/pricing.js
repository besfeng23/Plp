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
