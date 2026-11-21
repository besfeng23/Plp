import { randomBytes } from 'node:crypto';

// 96 bits of unpredictable entropy. Legacy references remain readable, but new
// ones are not derived from the server clock or guest data.
export function createBookingReference() {
  return 'PLP-' + randomBytes(12).toString('hex').toUpperCase();
}
