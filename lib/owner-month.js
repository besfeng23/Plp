import { isTestRecord } from './admin-records.js';

const settledStays = new Set(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT']);
const closed = new Set(['CANCELLED', 'CANCELED', 'VOIDED', 'EXPIRED', 'REFUNDED']);

export function monthBounds(month) {
  if (typeof month !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, number] = month.split('-').map(Number);
  // Resort months start at midnight in Boracay (UTC+08:00).
  return {
    start: new Date(Date.UTC(year, number - 1, 1, -8)).toISOString(),
    end: new Date(Date.UTC(year, number, 1, -8)).toISOString(),
  };
}

export async function websiteBookingMonth(month, selectRows) {
  const bounds = monthBounds(month);
  const rooms = new Map();
  const result = { requests: 0, confirmed: 0, closed: 0, other: 0 };
  let after = '';
  for (;;) {
    const query = new URLSearchParams({
      select: 'id,booking_reference,accommodation_name,status,payment_status,guest:plp_guests(email)',
      source: 'eq.website', order: 'id.asc', limit: '250',
    });
    query.append('created_at', 'gte.' + bounds.start);
    query.append('created_at', 'lt.' + bounds.end);
    if (after) query.set('id', 'gt.' + after);
    const rows = await selectRows('plp_bookings', query.toString());
    if (!Array.isArray(rows)) throw new Error('Booking summary unavailable');
    for (const row of rows) {
      if (isTestRecord({ ...row, email: row.guest?.email })) continue;
      result.requests++;
      const name = row.accommodation_name || 'Accommodation unspecified';
      rooms.set(name, (rooms.get(name) || 0) + 1);
      if (closed.has(row.status) || row.payment_status === 'REFUNDED') result.closed++;
      else if (settledStays.has(row.status)) result.confirmed++;
      else result.other++;
    }
    if (!rows.length) break;
    after = rows.at(-1).id;
  }
  return { ...result, rooms: [...rooms].map(([name, requests]) => ({ name, requests })).sort((a,b) => b.requests - a.requests || a.name.localeCompare(b.name)) };
}
