// One administration, eight business screens (plan section 4). Each tile is
// gated by exactly one permission from lib/access-control.js; a screen shows
// when the signed-in person can use at least one of its tiles.
import { socialProfiles } from '../../lib/social.js';

export const SCREENS = [
  { id: 'today', label: 'Today', note: 'What needs attention at the resort today.' },
  { id: 'reservations', label: 'Reservations', note: 'Bookings and payments. Open a booking for its details.' },
  { id: 'calendar', label: 'Calendar', note: 'Room availability, blocked dates and housekeeping.' },
  { id: 'guests', label: 'Guests & Requests', note: 'Guest records, concierge requests and follow-up.' },
  { id: 'club', label: 'Pearl Club', note: 'Boracay membership applications and activities.' },
  { id: 'growth', label: 'Growth & Marketing', note: 'Official social accounts and items still waiting on the owners.' },
  { id: 'reports', label: 'Reports & Documents', note: 'Results, website analytics and owner documents.' },
  { id: 'people', label: 'People & Access', note: 'Who can sign in, and what each person can do.' },
];

// Tiles per screen, each gated by one permission (see lib/access-control.js).
export const TILES = {
  today: [
    { id: 'arrivals', label: 'Arrivals', perm: 'reservations' },
    { id: 'in-house', label: 'In house', perm: 'reservations' },
    { id: 'departures', label: 'Departures', perm: 'reservations' },
    { id: 'attention', label: 'Needs attention', perm: 'reservations' },
    { id: 'requests', label: 'New requests', perm: 'concierge' },
    { id: 'tasks', label: 'Open tasks', perm: 'tasks' },
    { id: 'activity', label: 'Recent activity', perm: 'notifications' },
  ],
  reservations: [
    { id: 'all', label: 'All bookings', perm: 'reservations' },
    { id: 'upcoming', label: 'Upcoming stays', perm: 'reservations' },
    { id: 'payments', label: 'Payment review', perm: 'reservations' },
    { id: 'revenue', label: 'Revenue', perm: 'finance.read' },
  ],
  calendar: [
    { id: 'availability', label: 'Availability', perm: 'availability.read' },
    { id: 'blocks', label: 'Blocked dates', perm: 'availability.read' },
    { id: 'block-new', label: 'Block dates', perm: 'availability' },
    { id: 'housekeeping', label: 'Housekeeping', perm: 'tasks' },
  ],
  guests: [
    { id: 'inbox', label: 'Requests', perm: 'concierge' },
    { id: 'directory', label: 'Guest directory', perm: 'reservations' },
    { id: 'tasks', label: 'Tasks', perm: 'tasks' },
  ],
  club: [
    { id: 'register', label: 'Club register', perm: 'club' },
    { id: 'workbook', label: 'Club workbook', perm: 'club' },
  ],
  growth: [
    // Official social accounts, from lib/site-config.js only.
    ...socialProfiles().map(p => ({ id: p.key, label: p.label, perm: 'growth', href: p.url })),
    { id: 'partners', label: 'Partners', perm: 'growth' },
    { id: 'payouts', label: 'Payouts', perm: 'growth' },
  ],
  reports: [
    { id: 'month', label: 'Month in review', perm: 'finance.read' },
    { id: 'interest', label: 'Website interest', perm: 'analytics.read' },
    { id: 'analytics', label: 'Website analytics', perm: 'analytics.read' },
    { id: 'office', label: 'Owner Office', perm: 'office', href: '/owner' },
  ],
  people: [
    { id: 'people', label: 'People', perm: 'access.manage' },
    { id: 'grant', label: 'Add a person', perm: 'access.manage' },
    { id: 'access-history', label: 'Access history', perm: 'access.manage' },
    { id: 'owners', label: 'Owners', perm: 'access.manage' },
    { id: 'system', label: 'System status', perm: 'system' },
  ],
};

// Clearly labeled internal expansion teasers only. Not operating locations.
// No booking, pricing or public opening is offered. Subject to owner approval.
export const EXPANSION_TEASERS = [
  { id: 'spain', title: 'Spain', detail: 'Internal expansion teaser only. Not an operating PLP location. No booking, pricing or public opening is offered. Subject to owner approval.' },
  { id: 'malaysia', title: 'Malaysia', detail: 'Internal expansion teaser only. Not an operating PLP location. No booking, pricing or public opening is offered. Subject to owner approval.' },
  { id: 'indonesia', title: 'Indonesia', detail: 'Internal expansion teaser only. Not an operating PLP location. No booking, pricing or public opening is offered. Subject to owner approval.' },
];

// Internal 90-day marketing preparation and promo brief. Content only;
// shown on Growth & Marketing. Completing them does not open the public site.
export const MARKETING_PHASES = [
  { id: 'days-1-30', title: 'Days 1–30 — Internal systems', detail: 'Private website, branding, sales contact, photo and video inventory, invite-only affiliate architecture and the inquiry workflow. Exit: internal systems operational. Still private.' },
  { id: 'days-31-60', title: 'Days 31–60 — Assets and workflows', detail: 'Produce the promo and social drafts, build the content calendar, and test referrals with internal staff and owners only. No public posts, ads or external affiliate recruitment. Exit: assets approved. Still private.' },
  { id: 'days-61-90', title: 'Days 61–90 — Launch-ready, still private', detail: 'Rehearse inquiries, verify tracking and train staff. Public release still depends on licenses and owner approval, not the calendar. Exit: launch-ready, but still private until cleared.' },
];

export const PROMO_VIDEO_BEATS = [
  { id: 'setting', title: '00–10 sec — The setting', detail: 'Authorized aerial footage of the hillside, ocean and villas. Introduce Pueblo La Perla Boracay.' },
  { id: 'accommodations', title: '10–25 sec — The accommodations', detail: 'Actual footage of Grand Ocean Villa, Sunset Suite and Smart Room Premium.' },
  { id: 'experience', title: '25–40 sec — The experience', detail: 'Genuine pool, terrace and privacy-focused property scenes.' },
  { id: 'atmosphere', title: '40–53 sec — Boracay atmosphere', detail: 'Real island footage, sunset and approved guest-experience scenes.' },
  { id: 'finish', title: '53–60 sec — Brand finish', detail: 'PLP logo, understated tagline and the approved official domain or inquiry channel. Internal previews use a private-preview designation, not a public booking CTA.' },
];

// The four commercial inputs from the retired Growth Plan. Shown on this
// screen only; they are not a checklist and are not stored in the database.
export const OWNER_CONFIRMATIONS = [
  { id: 'rates', title: 'Rates + capacity', detail: 'Approved prices, inclusions and maximum occupancy for each bookable unit.' },
  { id: 'dates', title: 'Available dates', detail: 'Current December–February inventory and who can confirm reservations.' },
  { id: 'transport', title: 'Arrival + transport', detail: 'Actual address/access, beach route and available evening transport.' },
  { id: 'payments', title: 'Official payments', detail: 'Approved deposit method and the authorized recipient or payment link.' },
];

export function visibleTiles(screen, permissions = []) {
  return (TILES[screen] || []).filter(tile => permissions.includes(tile.perm));
}
export function visibleScreens(permissions = []) {
  return SCREENS.filter(screen => screen.id === 'today' || visibleTiles(screen.id, permissions).length > 0);
}
