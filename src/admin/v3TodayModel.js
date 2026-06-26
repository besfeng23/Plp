import { buildAttentionQueue, summarizeReservation } from './v3ReservationModel.js';
import { displayStatus, pick } from './v3Format.js';

export function buildTodaySnapshot(rows = [], issues = [], messages = []) {
  const today = new Date().toISOString().slice(0, 10);
  const arrivals = rows.filter((row) => pick(row, ['check_in']) === today);
  const departures = rows.filter((row) => pick(row, ['check_out']) === today);
  const inHouse = rows.filter((row) => pick(row, ['check_in']) <= today && pick(row, ['check_out']) > today);
  const paidDeposits = rows.filter((row) => displayStatus(row).label === 'Paid deposit');
  const highTouch = rows.filter((row) => summarizeReservation(row).isHighTouch);
  const failedMessages = messages.filter((row) => String(row.status || '').toUpperCase() === 'FAILED');

  return {
    date: today,
    arrivals,
    departures,
    inHouse,
    paidDeposits,
    highTouch,
    failedMessages,
    issues,
    attention: buildAttentionQueue(rows, issues, messages),
  };
}
