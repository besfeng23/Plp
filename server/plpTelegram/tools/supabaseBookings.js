import { isSupabaseConfigured, selectRows } from '../../../api/_supabase.js';

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '';
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone) {
  const clean = String(phone || '').replace(/\s+/g, '');
  if (clean.length < 5) return clean ? '***' : '';
  return `${clean.slice(0, 3)}***${clean.slice(-2)}`;
}

function mapBooking(row) {
  return {
    reference: row.booking_reference || row.reference || '—',
    guestName: row.guest_name || row.name || row.full_name || '—',
    guestEmail: maskEmail(row.guest_email || row.email),
    guestPhone: maskPhone(row.guest_phone || row.phone || row.phone_number || row.whatsapp),
    accommodation: row.accommodation_name || row.accommodation || row.room_name || '—',
    checkIn: row.check_in || '—',
    checkOut: row.check_out || '—',
    status: row.booking_status || row.status || '—',
    paymentStatus: row.payment_status || row.booking_payment_status || '—',
    depositAmount: row.deposit_amount_php || row.payment_amount_php || row.expected_amount_php || 0,
    createdAt: row.created_at || null,
  };
}

async function trySelectRows(table, query) {
  try {
    return { ok: true, rows: await selectRows(table, query), table };
  } catch (error) {
    return { ok: false, rows: [], table, error: error?.message || 'Read failed' };
  }
}

export async function getLatestBookings(limit = 5) {
  if (!isSupabaseConfigured()) return { configured: false, rows: [] };

  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);
  const query = `select=*&order=created_at.desc&limit=${safeLimit}`;
  const sources = ['plp_payment_reconciliation', 'plp_bookings'];
  const failures = [];

  for (const table of sources) {
    const result = await trySelectRows(table, query);
    if (result.ok) return { configured: true, table, rows: (result.rows || []).map(mapBooking) };
    failures.push(`${result.table}: ${result.error}`);
  }

  return {
    configured: true,
    rows: [],
    warning: `Could not read booking tables. ${failures.join(' | ')}`.slice(0, 240),
  };
}

export async function getPaymentExceptions(limit = 5) {
  if (!isSupabaseConfigured()) return { configured: false, rows: [] };

  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);
  const result = await trySelectRows('plp_payment_exceptions', `select=*&order=created_at.desc&limit=${safeLimit}`);
  if (!result.ok) return { configured: true, rows: [], warning: `Could not read payment exceptions. ${result.error}`.slice(0, 240) };
  return { configured: true, rows: result.rows || [] };
}
