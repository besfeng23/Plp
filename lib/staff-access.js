import { timingSafeEqual } from 'node:crypto';

// Compatibility boundary only. Keep legacy staff access working until each
// person has a provisioned, revocable identity; never log either secret.
export function hasLegacyStaffAccess(req, configured = process.env.PLP_STAFF_CODE) {
  const supplied = req?.headers?.['x-plp-staff-code'];
  if (typeof configured !== 'string' || configured.length === 0 ||
      typeof supplied !== 'string' || supplied.length === 0 || supplied.length > 256) return false;
  const expected = Buffer.from(configured, 'utf8');
  const actual = Buffer.from(supplied, 'utf8');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
