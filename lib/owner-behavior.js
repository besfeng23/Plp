import { monthBounds } from './owner-month.js';
import { PUBLIC_ANALYTICS_EVENTS, safeAnalyticsPath } from './analytics-policy.js';

// Consented anonymous event counts are not people, sessions or linked funnels.
const PAGE_SIZE = 500, MAX_PAGES = 20;
const ACTIONS = Object.freeze({
  click_reserve: 'reserveClicks', start_booking: 'bookingStarts',
  submit_booking: 'bookingSubmits', booking_created: 'bookingRequests',
  submit_enquiry: 'enquiries', submit_club_enquiry: 'clubEnquiries',
  submit_residential_interest: 'residentialInterests', select_room: 'roomSelections',
  click_email: 'emailClicks', click_phone: 'phoneClicks',
});
export function summarizeWebsiteBehavior(rows, month) {
  if (!monthBounds(month)) throw new TypeError('Invalid reporting month');
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = new Map(Array.from({ length: count }, (_, i) => {
    const date = month + '-' + String(i + 1).padStart(2, '0');
    return [date, { date, pageViews: 0, actions: 0 }];
  }));
  const metrics = { pageViews: 0, ...Object.fromEntries(Object.values(ACTIONS).map(k => [k, 0])) };
  const pages = new Map();
  let classified = 0;
  for (const r of rows) {
    if (!r || !PUBLIC_ANALYTICS_EVENTS.has(r.event_name)) continue;
    const path = safeAnalyticsPath(r.page_path);
    const time = new Date(r.created_at).getTime();
    if (!path || !Number.isFinite(time)) continue;
    // PLP Boracay uses UTC+08 year-round; convert from UTC before grouping.
    const date = new Date(time + 28800000).toISOString().slice(0, 10);
    const day = days.get(date);
    if (!day) continue;
    classified++;
    if (!pages.has(path)) pages.set(path, { path, pageViews: 0, actions: 0, reserveClicks: 0, enquiries: 0 });
    const p = pages.get(path);
    if (r.event_name === 'view_page') { metrics.pageViews++; p.pageViews++; day.pageViews++; }
    else {
      const key = ACTIONS[r.event_name];
      if (key) metrics[key]++;
      p.actions++; day.actions++;
      if (r.event_name === 'click_reserve') p.reserveClicks++;
      if (['submit_enquiry', 'submit_club_enquiry', 'submit_residential_interest'].includes(r.event_name)) p.enquiries++;
    }
  }
  const topPages = [...pages.values()].sort((a,b) => b.pageViews - a.pageViews || b.actions - a.actions || a.path.localeCompare(b.path)).slice(0, 20);
  return { month, classified, metrics, daily: [...days.values()], topPages,
    actionCounts: Object.entries(ACTIONS).map(([event, key]) => ({ event, count: metrics[key] })) };
}
export async function websiteBehaviorReport(month, selectRows) {
  const bounds = monthBounds(month);
  if (!bounds) throw new TypeError('Invalid reporting month');
  const records = [];
  let complete = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams();
    q.set('select', 'event_name,page_path,created_at');
    q.set('payload->>collection', 'eq.plp_consent_v2');
    q.append('created_at', 'gte.' + bounds.start);
    q.append('created_at', 'lt.' + bounds.end);
    q.set('order', 'created_at.asc,id.asc');
    q.set('limit', String(PAGE_SIZE));
    q.set('offset', String(page * PAGE_SIZE));
    const rows = await selectRows('plp_analytics_events', q.toString());
    if (!Array.isArray(rows)) throw new Error('Source unavailable');
    records.push(...rows);
    if (rows.length < PAGE_SIZE) { complete = true; break; }
  }
  return complete ? { ...summarizeWebsiteBehavior(records, month), complete: true, scanned: records.length, source: 'consented-first-party' }
    : { month, complete: false, scanned: records.length, source: 'consented-first-party',
        metrics: null, topPages: null, daily: null, actionCounts: null };
}
