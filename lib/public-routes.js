// Shared public route identity for the React app and server-delivered HTML.
// Keep customer-facing claims qualified until the resort owner has verified them.
export const SITE_URL = 'https://plp-boracay.vercel.app';

export const ROUTES = {
  home: '/',
  accommodations: '/accommodation',
  'grand-ocean-villa': '/accommodation/grand-ocean-villa',
  'sunset-suite': '/accommodation/sunset-suite',
  'smart-room-premium': '/accommodation/smart-room-premium',
  experiences: '/experiences',
  gallery: '/gallery',
  'getting-here': '/getting-here',
  'vip-package': '/exclusive-offer',
  booking: '/booking',
  'payment-success': '/booking/success',
  'payment-cancel': '/booking/cancel',
  contact: '/contact',
  'privacy-policy': '/privacy-policy',
  'terms-of-service': '/terms-of-service',
};

export const PAGE_META = {
  home: ['Pueblo La Perla Boracay | Private Hillside Villas', 'A private hillside retreat in Boracay with villas, suites, wellness, transfers, and curated island experiences.'],
  accommodations: ['Accommodation | Pueblo La Perla Boracay', 'Explore Pueblo La Perla villas, suites, and smart rooms designed for privacy, comfort, and quiet Boracay stays.'],
  'grand-ocean-villa': ['Grand Ocean Villa | Pueblo La Perla Boracay', 'A private four-bedroom hillside villa for up to 8 guests, with private pool atmosphere and sea views above Boracay.'],
  'sunset-suite': ['Sunset Suite | Pueblo La Perla Boracay', 'A two-bedroom suite for up to 4 guests, framed by quiet Boracay horizons and close to the island center.'],
  'smart-room-premium': ['Smart Room Premium | Pueblo La Perla Boracay', 'A calm, modern one-bedroom room for up to 2 guests, with intelligent controls and a quiet hillside atmosphere.'],
  experiences: ['Experiences | Pueblo La Perla Boracay', 'Water activities, private dining, wellness rituals, and island experiences that may be arranged with Pueblo La Perla Boracay.'],
  gallery: ['Gallery | Pueblo La Perla Boracay', 'A visual tour of Pueblo La Perla Boracay: hillside villas, pool and sea views, interiors, wellness baths, private dining, and island evenings.'],
  'getting-here': ['Getting Here | Pueblo La Perla Boracay', 'Arrival guidance through Caticlan or Kalibo, with port and transfer coordination available on request.'],
  'vip-package': ['Exclusive Offer | Pueblo La Perla Boracay', 'Enquire about a proposed long-stay wellness package for returning guests to Boracay. Final terms are provided privately.'],
  booking: ['Reserve Your Stay | Pueblo La Perla Boracay', 'Send a private reservation request for Pueblo La Perla Boracay villas, suites, and smart rooms.'],
  'payment-success': ['Reservation Verification | Pueblo La Perla Boracay', 'Your reservation return page. Final confirmation follows provider verification and resort review.'],
  'payment-cancel': ['Reservation Not Completed | Pueblo La Perla Boracay', 'Continue your Pueblo La Perla reservation or contact concierge for assistance.'],
  contact: ['Concierge | Pueblo La Perla Boracay', 'Reach the Pueblo La Perla Boracay concierge by email or phone for villa reservations and private inquiries.'],
  'privacy-policy': ['Privacy Policy | Pueblo La Perla Boracay', 'Learn how Pueblo La Perla Boracay handles reservation inquiry information, privacy, cookies, and guest data.'],
  'terms-of-service': ['Terms of Service | Pueblo La Perla Boracay', 'Review the general website use, reservation inquiry, payment, cancellation, and guest responsibility terms for Pueblo La Perla Boracay.'],
};

// These routes share the React shell; Vercel serves each a route-specific built
// HTML file, so crawlers and social previews receive correct metadata without JS.
export const SPA_HTML_ROUTES = {
  gallery: ['The hillside, room by room.', 'Explore Pueblo La Perla Boracay photography, villas, interiors, pools, and coastal outlooks.'],
  'getting-here': ['Getting Here', 'Arrival information for Pueblo La Perla Boracay. Contact the concierge to coordinate your preferred transfer arrangements.'],
  'vip-package': ['Exclusive Offer', 'Ask the Pueblo La Perla team about a proposed returning-guest wellness stay. Package terms require individual confirmation.'],
  contact: ['Speak with the concierge.', 'Contact Pueblo La Perla Boracay for reservation requests, arrival arrangements, and private inquiries.'],
  'privacy-policy': ['Privacy Policy', 'Read how Pueblo La Perla Boracay handles information shared by guests and website visitors.'],
  'terms-of-service': ['Terms of Service', 'Review the website terms and understand that reservation inquiries are subject to confirmation.'],
  'grand-ocean-villa': ['Grand Ocean Villa', 'Explore the hillside villa, its accommodation details, and how to request preferred dates.'],
  'sunset-suite': ['Sunset Suite', 'Explore the two-bedroom suite and request preferred dates through the concierge-led reservation process.'],
  'smart-room-premium': ['Smart Room Premium', 'Explore the premium room and request preferred dates for your stay in Boracay.'],
  'payment-success': ['Reservation verification', 'Your reservation return is being verified. Final confirmation follows payment verification and resort review.'],
  'payment-cancel': ['Reservation not completed', 'Your reservation was not completed. Contact concierge for help with next steps.'],
};
