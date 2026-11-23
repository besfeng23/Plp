// One administration, eight business screens (plan section 4). Each tile is
// gated by exactly one permission from lib/access-control.js; a screen shows
// when the signed-in person can use at least one of its tiles.
export const SCREENS = [
  { id: 'today', label: 'Today', note: 'What needs attention at the resort today.' },
  { id: 'reservations', label: 'Reservations', note: 'Bookings and payments. Open a booking for its details.' },
  { id: 'calendar', label: 'Calendar', note: 'Room availability, blocked dates and housekeeping.' },
  { id: 'guests', label: 'Guests & Requests', note: 'Guest records, concierge requests and follow-up.' },
  { id: 'club', label: 'Pearl Club', note: 'Boracay membership applications and activities.' },
  { id: 'growth', label: 'Growth & Marketing', note: 'The marketing plan and its progress.' },
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
    { id: 'plan', label: 'Marketing plan', perm: 'growth', href: '/plp-growth-plan.html' },
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

export function visibleTiles(screen, permissions = []) {
  return (TILES[screen] || []).filter(tile => permissions.includes(tile.perm));
}
export function visibleScreens(permissions = []) {
  return SCREENS.filter(screen => screen.id === 'today' || visibleTiles(screen.id, permissions).length > 0);
}
