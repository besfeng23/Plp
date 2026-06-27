import { formatDate, money, nightsBetween, pick } from './v3Format.js';
import { summarizeReservation } from './v3ReservationModel.js';

export function buildGuestProfiles(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    const summary = summarizeReservation(row);
    if (!summary.guestEmail) return;
    const existing = map.get(summary.guestEmail) || {
      email: summary.guestEmail,
      name: summary.guestName,
      stays: 0,
      totalValue: 0,
      highTouch: false,
      reservations: [],
    };
    existing.stays += 1;
    existing.totalValue += Number(pick(row, ['total_amount_php'], 0));
    existing.highTouch = existing.highTouch || summary.isHighTouch;
    existing.reservations.push(row);
    map.set(summary.guestEmail, existing);
  });
  return [...map.values()].sort((a, b) => b.totalValue - a.totalValue);
}

export function buildHousekeepingTasks(rows = [], blocks = []) {
  const tasks = [];
  rows.slice(0, 24).forEach((row) => {
    const summary = summarizeReservation(row);
    ['Pre-arrival inspection', 'Villa cleaning', 'Linen setup', 'Pool readiness', 'AC check', 'Welcome setup'].forEach((task) => {
      tasks.push({
        title: task,
        reservation: summary.reference,
        room: summary.room,
        guest: summary.guestName,
        due: `Before ${formatDate(summary.checkIn)}`,
        status: 'Open',
      });
    });
  });
  blocks.slice(0, 12).forEach((block) => {
    tasks.push({
      title: pick(block, ['reason'], 'Maintenance block'),
      reservation: 'Blocked date',
      room: pick(block, ['accommodation_name', 'accommodation'], 'Property'),
      guest: 'Operations',
      due: `${formatDate(pick(block, ['start_date']))} → ${formatDate(pick(block, ['end_date']))}`,
      status: 'Scheduled',
    });
  });
  return tasks;
}

export function buildConciergeChecklist(rows = []) {
  return rows.slice(0, 24).map((row) => {
    const summary = summarizeReservation(row);
    return {
      reference: summary.reference,
      guest: summary.guestName,
      room: summary.room,
      arrival: formatDate(summary.checkIn),
      stay: `${summary.nights} nights`,
      value: summary.total,
      highTouch: summary.isHighTouch,
      items: ['Airport transfer', 'Boat transfer', 'Welcome drinks', 'Private chef option', 'Spa or massage', 'Special setup'],
    };
  });
}

export function buildAvailabilitySummary(rows = [], blocks = []) {
  const rooms = ['Grand Ocean Villa', 'Sunset Suite', 'Smart Room Premium'];
  return rooms.map((room) => {
    const reservations = rows.filter((row) => pick(row, ['accommodation_name', 'accommodation']) === room);
    const blocked = blocks.filter((row) => pick(row, ['accommodation_name', 'accommodation']) === room);
    const longStays = reservations.filter((row) => nightsBetween(pick(row, ['check_in']), pick(row, ['check_out'])) >= 7);
    return {
      room,
      reservations: reservations.length,
      blocked: blocked.length,
      longStays: longStays.length,
      totalValue: money(reservations.reduce((sum, row) => sum + Number(pick(row, ['total_amount_php'], 0)), 0)),
    };
  });
}
