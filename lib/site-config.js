// Single source of truth for PLP business identity and owner directory.
// Never put credentials here. Owner email addresses are configuration, not
// code: they come from environment variables (see docs/HANDOFF.md).

export const SITE = Object.freeze({
  businessName: 'Pueblo La Perla Boracay',
  shortName: 'Pueblo La Perla',
  url: 'https://plp-boracay.vercel.app',
  // Existing published contact details — unchanged until the owners authorize new ones.
  conciergeEmail: 'mfr@e-mango.com',
  conciergePhone: '+639178872980',
  conciergePhoneDisplay: '+63 917 887 2980',
  // Official social profiles. TikTok stays null until the owners confirm the handle.
  social: Object.freeze({
    facebook: 'https://www.facebook.com/PuebloLaPerlaBoracay',
    instagram: 'https://www.instagram.com/pueblolaperlaboracay/',
    tiktok: null,
  }),
  // When contact details change, list the old values here; the static-page
  // build rewrites any remaining occurrences to the current values.
  previousConciergeEmails: Object.freeze([]),
  previousConciergePhones: Object.freeze([]),
});

export const DEFAULT_OWNER_NAME = 'Owner';
const EMAIL = /^[^@\s,;=]+@[^@\s,;=]+\.[^@\s,;=]+$/;
const normal = value => String(value || '').trim().toLowerCase();

// Owner allow-list. PLP_OWNER_EMAILS="a@x.com,b@y.com" (preferred); the legacy
// single PLP_OWNER_EMAIL stays as a fallback so existing production keeps working.
export function ownerEmails(env = process.env) {
  const listed = String(env.PLP_OWNER_EMAILS || '').split(/[,;\s]+/).map(normal).filter(Boolean);
  const source = listed.length ? listed : [normal(env.PLP_OWNER_EMAIL)];
  return [...new Set(source.filter(email => EMAIL.test(email)))].slice(0, 10);
}

// Display names: PLP_OWNER_DISPLAY_NAMES="a@x.com=Name One;b@y.com=Name Two".
export function ownerDisplayName(email, env = process.env) {
  const key = normal(email);
  for (const pair of String(env.PLP_OWNER_DISPLAY_NAMES || '').split(';')) {
    const at = pair.indexOf('=');
    if (at < 1) continue;
    if (normal(pair.slice(0, at)) === key) {
      const name = pair.slice(at + 1).replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 80);
      if (name) return name;
    }
  }
  return DEFAULT_OWNER_NAME;
}

export function isOwnerEmail(email, env = process.env) {
  return ownerEmails(env).includes(normal(email));
}
