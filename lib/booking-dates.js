const DAY_MS = 86_400_000;
const resortDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayAtResort(now = new Date()) {
  return resortDate.format(now);
}

export function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && dateKey(parsed) === value;
}

export function nightsBetween(checkIn, checkOut) {
  if (!validDate(checkIn) || !validDate(checkOut) || checkOut <= checkIn) return 0;
  return (Date.parse(checkOut) - Date.parse(checkIn)) / DAY_MS;
}

export function shiftMonth(month, offset) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

// Checkout is exclusive for both reservations and administrative date blocks.
export function* occupiedNights(checkIn, checkOut) {
  for (let day = Date.parse(checkIn); day < Date.parse(checkOut); day += DAY_MS) {
    yield dateKey(new Date(day));
  }
}
