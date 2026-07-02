// Single source of truth for Pueblo La Perla nightly pricing.
//
// These are the premium nightly rates (PHP) per accommodation tier. The server
// booking route (api/bookings.js) computes the authoritative amount and 30%
// deposit from PLP_TIER_BY_ACCOMMODATION, so no browser-supplied amount can ever
// override what is charged. Static HTML pages (booking.html, accommodation.html,
// the SEO villa landing pages) carry these same values inline because they are
// served without a bundler — if you change the numbers here, update those pages
// too. Anything importable (api/*, src/*) should import from this file instead of
// hardcoding a rate.
export const PLP_PRICES = {
  premium: 80000, // Grand Ocean Villa   (top tier)
  mid: 60000,     // Sunset Suite        (middle tier)
  entry: 40000,   // Smart Room Premium  (entry tier)
};

// Maps the canonical accommodation names used across the booking form, API,
// admin, OTA managers, and structured data to their nightly rate.
export const PLP_TIER_BY_ACCOMMODATION = {
  'Grand Ocean Villa': PLP_PRICES.premium,
  'Sunset Suite': PLP_PRICES.mid,
  'Smart Room Premium': PLP_PRICES.entry,
};

// Deposit charged at checkout as a fraction of the full stay total.
export const PLP_DEPOSIT_RATE = 0.3;

// Formats a peso amount the same way every surface does: "₱80,000".
export function formatPeso(value) {
  return '₱' + Number(value || 0).toLocaleString('en-PH');
}
