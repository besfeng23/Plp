import { findAccommodationByName, insertRow, selectRows, updateRows } from './_supabase.js';

function enc(value) {
  return encodeURIComponent(String(value));
}

function datesAreUsable(startDate, endDate) {
  const shape = /^\d{4}-\d{2}-\d{2}$/;
  if (!shape.test(String(startDate || '')) || !shape.test(String(endDate || ''))) return false;
  return new Date(`${endDate}T00:00:00Z`) > new Date(`${startDate}T00:00:00Z`);
}

export async function getAccommodation(name) {
  const accommodation = await findAccommodationByName(name);
  if (!accommodation || !accommodation.is_active) return null;
  return accommodation;
}

export async function getAvailabilityConflicts({ accommodationName, accommodationId, checkIn, checkOut, excludeReference }) {
  if (!datesAreUsable(checkIn, checkOut)) {
    return { available: false, invalidDateRange: true, activeBookings: [], blockedDates: [], conflictCount: 0 };
  }

  const accommodation = accommodationId ? { id: accommodationId, name: accommodationName } : await getAccommodation(accommodationName);
  if (!accommodation?.id) {
    return { available: false, missingAccommodation: true, activeBookings: [], blockedDates: [], conflictCount: 0 };
  }

  const activeBookings = await selectRows(
    'plp_active_booking_holds',
    `accommodation_id=eq.${enc(accommodation.id)}&check_in=lt.${enc(checkOut)}&check_out=gt.${enc(checkIn)}&select=*`
  );
  const filteredBookings = excludeReference
    ? activeBookings.filter((row) => row.booking_reference !== excludeReference)
    : activeBookings;

  const blockedDates = await selectRows(
    'plp_active_blocked_dates',
    `accommodation_id=eq.${enc(accommodation.id)}&start_date=lt.${enc(checkOut)}&end_date=gt.${enc(checkIn)}&select=*`
  );

  return {
    accommodation,
    available: filteredBookings.length === 0 && blockedDates.length === 0,
    activeBookings: filteredBookings,
    blockedDates,
    conflictCount: filteredBookings.length + blockedDates.length,
  };
}

export async function requireAvailability(input) {
  const result = await getAvailabilityConflicts(input);
  if (result.available) return result;
  return {
    ...result,
    error: result.invalidDateRange
      ? 'Invalid date range.'
      : result.missingAccommodation
        ? 'Accommodation is not active.'
        : 'Selected accommodation is not available for those dates.',
  };
}

export async function listAvailabilityCalendar(limit = 200) {
  return selectRows('plp_availability_calendar', `select=*&order=start_date.asc&limit=${Number(limit) || 200}`);
}

export async function listBlockedDates(limit = 200) {
  return selectRows('plp_active_blocked_dates', `select=*&order=start_date.asc&limit=${Number(limit) || 200}`);
}

export async function createBlockedDate({ accommodationName, startDate, endDate, reason, createdBy }) {
  const accommodation = await getAccommodation(accommodationName);
  if (!accommodation?.id) return { ok: false, error: 'Accommodation is not active.' };

  const conflicts = await getAvailabilityConflicts({ accommodationId: accommodation.id, accommodationName, checkIn: startDate, checkOut: endDate });
  if (conflicts.invalidDateRange) return { ok: false, error: 'Invalid date range.' };
  if (conflicts.activeBookings.length > 0) return { ok: false, error: 'Date block overlaps an active booking.', conflicts: conflicts.activeBookings };

  const row = await insertRow('plp_blocked_dates', {
    accommodation_id: accommodation.id,
    start_date: startDate,
    end_date: endDate,
    reason: String(reason || 'Manual staff block').slice(0, 300),
    source: 'admin',
    status: 'ACTIVE',
    created_by: String(createdBy || 'staff').slice(0, 120),
  });
  return { ok: true, row };
}

export async function cancelBlockedDate(id) {
  const rows = await updateRows('plp_blocked_dates', `id=eq.${enc(id)}`, { status: 'CANCELLED' });
  return rows?.[0] || null;
}
