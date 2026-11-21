import { monthBounds } from './owner-month.js';

// Anonymous event totals are NOT unique visitors, approved club members,
// reservation confirmations, payments, or verified revenue.
const PAGE_SIZE = 500;
const MAX_PAGES = 20;
const FUNNEL_KEYS = Object.freeze({
  view_page: 'pageViews',
  click_reserve: 'reserveClicks',
  start_booking: 'bookingStarts',
  submit_booking: 'bookingSubmits',
  booking_created: 'bookingRequestsRecorded',
  submit_enquiry: 'enquiriesSent',
  submit_club_enquiry: 'clubEnquiriesSent',
  submit_residential_interest: 'residentialInterestsSent',
});

export async function websiteInterestFunnel(month, selectRows) {
  const bounds = monthBounds(month);
  if (!bounds) throw new TypeError('Invalid monthly reporting window');
  const metrics = Object.fromEntries(Object.values(FUNNEL_KEYS).map(name => [name, 0]));
  let complete = false;
  let scanned = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams();
    query.set('select', 'event_name');
    // Exclude legacy unclassified events from this consent-only funnel.
    query.set('payload->>collection', 'eq.plp_consent_v2');
    query.append('created_at', 'gte.' + bounds.start);
    query.append('created_at', 'lt.' + bounds.end);
    query.set('order', 'created_at.asc,id.asc');
    query.set('limit', String(PAGE_SIZE));
    query.set('offset', String(page * PAGE_SIZE));
    const rows = await selectRows('plp_analytics_events', query.toString());
    if (!Array.isArray(rows)) throw new Error('Analytics unavailable');
    for (const row of rows) {
      const key = FUNNEL_KEYS[row.event_name];
      if (key) metrics[key] += 1;
    }
    scanned += rows.length;
    if (rows.length < PAGE_SIZE) { complete = true; break; }
  }
  return { month, complete, scanned, metrics: complete ? metrics : null };
}
