// Public analytics accepts only anonymous, consented event categories and known
// page PATHS. Never persist raw query strings, referrers, user agents, submitted
// content, session identifiers, or arbitrary payload fields.
export const PUBLIC_ANALYTICS_EVENTS = new Set([
  'view_page', 'click_reserve', 'click_email', 'click_phone',
  'select_room', 'start_booking', 'submit_booking', 'booking_created',
  'submit_enquiry', 'submit_club_enquiry', 'submit_residential_interest',
]);

export const PUBLIC_ANALYTICS_PATHS = new Set([
  '/', '/accommodation', '/accommodations', '/accommodation/grand-ocean-villa',
  '/accommodation/sunset-suite', '/accommodation/smart-room-premium',
  '/experiences', '/club', '/senior-living', '/gallery', '/getting-here',
  '/booking', '/contact', '/exclusive-offer', '/reservation-policy',
  '/privacy-policy', '/terms-of-service', '/private-villas-boracay',
  '/boracay-villa-with-private-pool', '/boracay-family-villa',
  '/boracay-wellness-stay', '/high-boracay-location',
]);

export function safeAnalyticsPath(raw) {
  if (typeof raw !== 'string' || raw.length > 120 || raw.includes('?') ||
      raw.includes('#') || raw.includes('\\') || /[\s%]/.test(raw) ||
      !raw.startsWith('/') || raw.startsWith('//')) return null;
  const path = raw.replace(/\/+$/, '') || '/';
  return PUBLIC_ANALYTICS_PATHS.has(path) ? path : null;
}

export function safeAnalyticsEvent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      body.privacyConsent !== true || !PUBLIC_ANALYTICS_EVENTS.has(body.event)) return null;
  const path = safeAnalyticsPath(body.path);
  return path ? { event_name: body.event, page_path: path } : null;
}
