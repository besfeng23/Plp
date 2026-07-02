import { isSupabaseConfigured, selectRows } from '../../../api/_supabase.js';

const clean = (v, f = '—') => String(v || f).replace(/[\r\n]+/g, ' ').slice(0, 160);
const money = (v) => Number(v || 0) ? `PHP ${Number(v || 0).toLocaleString('en-US')}` : '—';

async function read(table, query) {
  if (!isSupabaseConfigured()) return { configured: false, rows: [] };
  try { return { configured: true, rows: await selectRows(table, query) || [] }; }
  catch (error) { return { configured: true, rows: [], warning: clean(error?.message, 'Read failed') }; }
}

export async function ownerBrief() {
  const r = await read('plp_owner_today', 'select=*&limit=1');
  if (!r.configured) return 'Owner brief:\nSupabase is not configured.';
  if (r.warning) return `Owner brief:\n${r.warning}`;
  const x = r.rows[0];
  if (!x) return 'Owner brief:\nNo owner summary found.';
  return `Owner brief:\nArrivals today: ${x.arrivals_today}\nCheckouts today: ${x.checkouts_today}\nPending bookings: ${x.pending_bookings}\nCollected today: ${money(x.collected_today_php)}\nPending deposits: ${money(x.pending_deposits_php)}\nPayment exceptions: ${x.open_payment_exceptions}\nConcierge open: ${x.open_concierge_requests}\nMaintenance open: ${x.open_maintenance_tickets}\nHousekeeping incomplete: ${x.incomplete_housekeeping_tasks}\nOwner alerts: ${x.open_owner_alerts}`;
}

export async function donorBrief() {
  const r = await read('plp_donor_safe_summary', 'select=*&limit=1');
  if (!r.configured) return 'Donor update:\nSupabase is not configured.';
  if (r.warning) return `Donor update:\n${r.warning}`;
  const x = r.rows[0];
  if (!x) return 'Donor update:\nNo donor summary found.';
  return `Donor update:\nBookings this month: ${x.bookings_this_month}\nGross booking value: ${money(x.gross_booking_value_php)}\nCompleted improvements: ${x.completed_improvements}\nActive improvements: ${x.active_improvements}\nAverage review rating: ${x.avg_review_rating ? Number(x.avg_review_rating).toFixed(2) : '—'}\nGuest-private details are hidden.`;
}

function list(title, r, map, empty = 'None found.') {
  if (!r.configured) return `${title}:\nSupabase is not configured.`;
  if (r.warning) return `${title}:\n${r.warning}`;
  if (!r.rows.length) return `${title}:\n${empty}`;
  return `${title}:\n${r.rows.map(map).join('\n')}`;
}

export async function arrivalsToday() {
  const today = new Date().toISOString().slice(0, 10);
  const r = await read('plp_payment_reconciliation', `select=*&check_in=eq.${today}&order=created_at.desc&limit=10`);
  return list('Arrivals today', r, x => `${clean(x.booking_reference)} — ${clean(x.guest_name)} — ${clean(x.accommodation_name)} — ${clean(x.booking_status)} / ${clean(x.payment_status)}`);
}

export async function checkoutsToday() {
  const today = new Date().toISOString().slice(0, 10);
  const r = await read('plp_payment_reconciliation', `select=*&check_out=eq.${today}&order=created_at.desc&limit=10`);
  return list('Checkouts today', r, x => `${clean(x.booking_reference)} — ${clean(x.guest_name)} — ${clean(x.accommodation_name)} — ${clean(x.booking_status)}`);
}

export async function maintenanceSummary() {
  const r = await read('plp_maintenance_tickets', 'select=*&status=in.(OPEN,IN_PROGRESS)&order=created_at.desc&limit=8');
  return list('Maintenance', r, x => `${clean(x.severity)} — ${clean(x.title)} — ${clean(x.status)} — revenue risk ${x.revenue_risk ? 'yes' : 'no'}`);
}

export async function housekeepingSummary() {
  const r = await read('plp_housekeeping_tasks', 'select=*&status=neq.DONE&order=task_date.asc,due_at.asc&limit=8');
  return list('Housekeeping', r, x => `${clean(x.task_date)} — ${clean(x.task_type)} — ${clean(x.status)} — ${clean(x.assigned_to)}`);
}

export async function conciergeSummary() {
  const r = await read('plp_concierge_requests', 'select=*&status=in.(OPEN,IN_PROGRESS)&order=created_at.desc&limit=8');
  return list('Concierge', r, x => `${clean(x.priority)} — ${clean(x.category)} — ${clean(x.title)} — ${clean(x.status)}`);
}

export async function expensesSummary() {
  const r = await read('plp_expenses', 'select=*&order=expense_date.desc,created_at.desc&limit=8');
  return list('Expenses', r, x => `${clean(x.expense_date)} — ${clean(x.category)} — ${clean(x.description)} — ${money(x.amount_php)}`);
}

export async function reviewsSummary() {
  const r = await read('plp_reviews', 'select=*&order=received_at.desc&limit=8');
  return list('Reviews', r, x => `${clean(x.source)} — rating ${x.rating || '—'} — ${clean(x.title || x.sentiment || x.status)}`);
}

export async function channelSummary() {
  const r = await read('plp_channel_integrations', 'select=*&order=display_name.asc&limit=10');
  return list('OTA/channel status', r, x => `${clean(x.display_name)} — ${clean(x.status)}${x.last_error ? ` — ${clean(x.last_error)}` : ''}`);
}

export async function websiteFunnel() {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const r = await read('plp_website_events', `select=event_name,occurred_at&occurred_at=gte.${since}&limit=500`);
  if (!r.configured) return 'Website funnel:\nSupabase is not configured.';
  if (r.warning) return `Website funnel:\n${r.warning}`;
  const c = r.rows.reduce((a, x) => { a[x.event_name] = (a[x.event_name] || 0) + 1; return a; }, {});
  const views = c.view_booking || 0, submits = c.submit_booking || 0;
  return `Website funnel, last 7 days:\nBooking views: ${views}\nBooking starts: ${c.start_booking || 0}\nBooking submits: ${submits}\nBooking conversion: ${views ? ((submits / views) * 100).toFixed(1) + '%' : '—'}\nReserve clicks: ${c.click_reserve || 0}`;
}

export async function attentionSummary() {
  const a = await read('plp_owner_alerts', 'select=*&status=eq.OPEN&order=created_at.desc&limit=8');
  return list('Needs attention', a, x => `${clean(x.severity)} — ${clean(x.title)} — ${clean(x.status)}`, 'No open owner alerts.');
}
