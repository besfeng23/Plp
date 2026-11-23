import { getPayPalHealthConfig } from './_paypal.js';
import { hasLegacyStaffAccess } from '../../lib/staff-access.js';

// Configuration readiness is operational information: staff only, never public.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!hasLegacyStaffAccess(req)) return res.status(401).json({ ok: false, error: 'Staff access required' });
  return res.status(200).json(getPayPalHealthConfig(req));
}
