import { notifyBookingStatus } from '../_notifications.js';
import { selectRows, updateRows } from '../_supabase.js';

function hasStaffAccess(req) {
  const expected = process.env.PLP_STAFF_CODE;
  const provided = req.headers['x-plp-staff-code'];
  return Boolean(expected && provided === expected);
}

async function findRow(reference) {
  const rows = await selectRows('plp_payment_reconciliation', `booking_reference=eq.${encodeURIComponent(reference)}&select=*&limit=1`);
  return rows?.[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!hasStaffAccess(req)) {
    return res.status(401).json({ ok: false, error: 'Staff access required' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const reference = String(body.reference || '').trim();
    const nextStatus = String(body.nextStatus || '').trim();

    if (!reference || !nextStatus) {
      return res.status(400).json({ ok: false, error: 'Missing reference or next status' });
    }

    const current = await findRow(reference);
    if (!current) return res.status(404).json({ ok: false, error: 'Booking not found' });

    const payload = {};
    if (nextStatus === 'CONFIRMED') {
      const verifiedPayment = current.payment_verification_status === 'VERIFIED';
      const successfulPayment = ['SUCCEEDED', 'CAPTURED'].includes(current.payment_status) || ['SUCCEEDED', 'CAPTURED'].includes(current.booking_payment_status);
      if (!verifiedPayment || !successfulPayment) {
        return res.status(409).json({ ok: false, error: 'Deposit payment must be verified first.' });
      }
      payload.status = 'CONFIRMED';
      payload.confirmed_at = new Date().toISOString();
    } else if (nextStatus === 'CANCELLED') {
      payload.status = 'CANCELLED';
      payload.cancelled_at = new Date().toISOString();
    } else if (nextStatus === 'PAYMENT_PROCESSING') {
      payload.status = 'PAYMENT_PROCESSING';
    } else {
      return res.status(400).json({ ok: false, error: 'Unsupported status' });
    }

    const updated = await updateRows('plp_bookings', `booking_reference=eq.${encodeURIComponent(reference)}`, payload);
    let notifications = null;
    try {
      notifications = await notifyBookingStatus(reference, nextStatus);
    } catch (error) {
      notifications = { ok: false, error: error.message };
    }

    return res.status(200).json({ ok: true, row: updated?.[0] || null, notifications });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Booking status update failed', detail: error.message });
  }
}
