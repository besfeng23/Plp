import React, { useEffect, useMemo, useRef, useState } from 'react';
import SocialLinks from './SocialLinks.jsx';
import { PaymentCancelView, PaymentSuccessView } from './PaymentReturnViews.jsx';
import { Anchor, ChevronLeft, ChevronRight, MapPin, Menu, Plane, Users, X } from 'lucide-react';
import HomeView from './HomeView.jsx';
import ConciergeView from './ConciergeView.jsx';
import ClubView from './ClubView.jsx';
import SeniorLivingView from './SeniorLivingView.jsx';
import { formatPeso as formatMoney, PLP_ROOMS } from '../lib/pricing.js';
import { CONCIERGE_EMAIL, CONCIERGE_NUMBER, CONCIERGE_NUMBER_DISPLAY } from '../lib/contact.js';
import { PAGE_META, ROUTES, SITE_URL } from '../lib/public-routes.js';

const PATH_TO_VIEW = Object.fromEntries(Object.entries(ROUTES).map(([key, value]) => [value, key]));
PATH_TO_VIEW['/accommodations'] = 'accommodations';
PATH_TO_VIEW['/vip-package'] = 'vip-package';


const IMAGES = {
  grandVilla: '/images/plp-grand-ocean-villa-aerial.webp',
};

const ACCOMMODATIONS = [
  { id: 1, slug: 'grand-ocean-villa', name: 'Grand Ocean Villa', type: 'Villa', bedrooms: 4, description: 'A private hillside sanctuary with sweeping sea views, four bedrooms, generous living space, and a setting designed for families or private groups.', bestFor: 'Families, private groups, longer stays, and private pool living.', features: ['Private Pool', 'Beach View', 'Kitchen', 'Living Room', 'Personalized Service'], imageTag: 'Villa', imageSrc: IMAGES.grandVilla, imageAlt: 'Aerial view of Pueblo La Perla Grand Ocean Villa with private pool and hillside greenery', heroSrc: IMAGES.grandVilla, heroAlt: 'Aerial view of Pueblo La Perla Grand Ocean Villa with private pool and hillside greenery', gallery: [['/images/plp-grand-villa-exterior.webp', 'Grand Ocean Villa exterior on the Pueblo La Perla hillside'], ['/images/plp-pool-ocean-view.webp', 'Pueblo La Perla pool looking out over the ocean'], ['/images/plp-master-bedroom-view.webp', 'Master bedroom with an outward view at Pueblo La Perla'], ['/images/plp-private-breakfast-pool.webp', 'Private breakfast set beside the pool']] },
  { id: 2, slug: 'sunset-suite', name: 'Sunset Suite', type: 'Suite', bedrooms: 2, imageAlt: 'Sunset Suite balcony with Boracay hillside view', description: 'A refined retreat framed by quiet Boracay horizons, made for guests who want privacy while staying close to the island center.', bestFor: 'Couples, small families, and quiet stays close to the island center.', features: ['Balcony', 'Living Room', 'Local Dining', 'Shuttle Access'], imageTag: 'Suite', heroSrc: '/images/plp-sunset-balcony.webp', heroAlt: 'Villa balcony framing a Boracay sunset', gallery: [['/images/plp-sunset-balcony.webp', 'Villa balcony framing a Boracay sunset'], ['/images/plp-day-balcony-sea-view.webp', 'Villa balcony with a daytime sea view'], ['/images/plp-bedroom-balcony-outlook.webp', 'Bedroom opening onto a balcony outlook']] },
  { id: 3, slug: 'smart-room-premium', name: 'Smart Room Premium', type: 'Smart Room', bedrooms: 1, imageAlt: 'Smart Room Premium bedroom with modern controls', description: 'A quiet modern base for solo travelers or couples, with intelligent controls, work comfort, and a calm hillside atmosphere.', bestFor: 'Couples, solo travelers, short stays, and work-friendly island trips.', features: ['IoT Controls', 'Work Desk', 'WiFi', 'Air-conditioning'], imageTag: 'Smart Room', heroSrc: '/images/plp-smart-room-twin-view.webp', heroAlt: 'Smart Room Premium interior with twin layout', gallery: [['/images/plp-smart-room-twin-view.webp', 'Smart Room Premium interior with twin layout'], ['/images/plp-bathroom-vanity-shower.webp', 'Bathroom vanity and shower detail'], ['/images/plp-bath-tub-greenery.webp', 'Bathtub set against hillside greenery']] },
].map(room => ({ ...room, ...PLP_ROOMS.find(item => item.slug === room.slug) }));
const ROOM_BY_SLUG = Object.fromEntries(ACCOMMODATIONS.map((room) => [room.slug, room]));

const EXPERIENCE_GROUPS = [
  ['Water', 'The island by sea.', 'Paraw sailing, island hopping, snorkeling, scuba diving, jet skiing, and curated water activities can be arranged through the team.', '/images/plp-day-balcony-sea-view.webp', 'Sea view from the villa balcony', 'water'],
  ['Wellness', 'Restored in privacy.', 'In-room massage, spa treatments, quiet rituals, and slow days shaped around recovery and stillness.', '/images/plp-wellness-bath-ritual.webp', 'Wellness bath at Pueblo La Perla', 'wellness'],
  ['Private Dining', 'Evenings prepared for you.', 'Sunset dinners, local dining experiences, and intimate meals arranged for families, couples, and private groups.', '/images/plp-private-breakfast-pool.webp', 'A private breakfast set by the pool', 'dining'],
];

const GALLERY_GROUPS = [
  ['The Hillside & Villas', 'The property from the air and the villa exteriors set into the slope above the coast.', [
    ['/images/plp-hero-sunset.webp', 'Pueblo La Perla hillside villas above the Boracay coast at sunset'],
    ['/images/plp-hero-day.webp', 'Daytime aerial of the Pueblo La Perla hillside above the coast'],
    ['/images/plp-grand-villa-exterior.webp', 'Grand Ocean Villa exterior on the Pueblo La Perla hillside'],
    ['/images/plp-villa-golden-exterior.webp', 'Pueblo La Perla villa exterior in golden afternoon light'],
    ['/images/plp-villa-exterior-alt.webp', 'Alternate view of a Pueblo La Perla villa exterior and greenery'],
  ]],
  ['Pool, Deck & Sea Views', 'Pool, terrace, and balcony outlooks over the water.', [
    ['/images/plp-pool-ocean-view.webp', 'Pueblo La Perla pool looking out over the ocean'],
    ['/images/plp-day-balcony-sea-view.webp', 'Villa balcony with a daytime sea view'],
    ['/images/plp-sunset-balcony.webp', 'Villa balcony framing a Boracay sunset'],
    ['/images/plp-poolside-experience.webp', 'Poolside setting at Pueblo La Perla'],
  ]],
  ['Rooms & Suites', 'Interiors of the villa bedrooms and the Smart Room.', [
    ['/images/plp-master-bedroom-view.webp', 'Master bedroom with an outward view at Pueblo La Perla'],
    ['/images/plp-smart-room-twin-view.webp', 'Smart Room Premium interior with twin layout'],
    ['/images/plp-bedroom-balcony-outlook.webp', 'Bedroom opening onto a balcony outlook'],
  ]],
  ['Baths & Wellness', 'Bathrooms and quiet spaces shaped for recovery.', [
    ['/images/plp-bath-tub-greenery.webp', 'Bathtub set against hillside greenery'],
    ['/images/plp-bathroom-vanity-shower.webp', 'Bathroom vanity and shower detail'],
    ['/images/plp-wellness-bath-ritual.webp', 'Wellness bath ritual setting at Pueblo La Perla'],
  ]],
  ['Dining & Evenings', 'Private dining and the property after dark.', [
    ['/images/plp-private-breakfast-pool.webp', 'Private breakfast set beside the pool'],
    ['/images/plp-rooftop-evening-lounge.webp', 'Rooftop evening lounge at Pueblo La Perla'],
    ['/images/plp-hero-evening.webp', 'Pueblo La Perla hillside in the evening'],
  ]],
];


function LegalPageView({ type }) {
  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';
  const intro = isPrivacy ? 'Pueblo La Perla Boracay respects the privacy of guests and website visitors. This Privacy Policy explains how information may be collected and used when you visit the website, submit a reservation inquiry, or apply to Pearl Club Boracay.' : 'These Terms of Service provide general conditions for using the Pueblo La Perla Boracay website and submitting reservation inquiries.';
  const sections = isPrivacy ? [
    ['Information We May Collect', 'When you submit a reservation inquiry, we may collect your name, contact details, dates, accommodation preferences, guest count and any message. Pearl Club membership applications collect your name, email, optional telephone number, 60+ age declaration, consent time and application review status; the online form does not request identity documents, full birth dates or medical information. We may also collect basic technical information, such as device type, browser type, pages visited, and general website usage data, if analytics or performance tools are used.'],
    ['How Information Is Used', 'Information may be used to respond to inquiries, process membership applications, allow PLP staff to assess eligibility and contact applicants, publish confirmed club activities, coordinate reservations, improve the website, and protect service reliability.'],
    ['Sharing of Information', 'Guest inquiry information is not sold. Information may be shared only when necessary to respond to a reservation request, coordinate guest services, comply with legal obligations, or protect the security of the website.'],
    ['Cookies and Analytics', 'Optional analytics are disabled until you choose to allow them. If you consent, PostHog may use a pseudonymous browser identifier and session identifier to count visitors and sessions, together with approved public page paths, button interactions, referring domain, browser and device category, and web performance metrics. We do not send form values, names, email addresses, booking references, or health details. Session replay is disabled. Google Analytics is off unless separately configured. Private owner and staff pages and payment-return pages are excluded. Use Analytics settings to change your choice.'],
    ['Data Security', 'Reasonable technical and organizational measures should be used to protect inquiry information. No website or online transmission can be guaranteed to be completely secure.'],
    ['Data Retention', 'Guest and membership application information should be retained only as long as necessary for staff review, reservations, guest services, legal obligations and legitimate operations. Please contact PLP for correction, withdrawal or deletion requests, subject to applicable recordkeeping obligations.'],
    ['Guest Requests', 'Guests and Pearl Club applicants may request access, correction, withdrawal of an application, or deletion of personal information through the PLP concierge contact channels.'],
    ['Updates', 'This Privacy Policy may be updated from time to time. The latest version should be made available on this page.'],
  ] : [
    ['Website Use', 'The website is provided to introduce Pueblo La Perla Boracay, present accommodation and experience information, and allow visitors to submit reservation inquiries. Visitors agree not to misuse the website, interfere with its operation, attempt unauthorized access, or submit false or harmful information.'],
    ['Pearl Club Applications', 'Submitting an application means the applicant has declared they are at least 60 and consented to staff review. An application is not membership approval, a residential admission, or a paid enrollment. The club team contacts applicants about eligibility and any future terms.'],
    ['Reservation Inquiries', 'Submitting a reservation inquiry does not automatically confirm a booking. Availability, rates, deposit requirements, payment timing, cancellation terms, and final booking details must be confirmed by the PLP team.'],
    ['Rates and Availability', 'Accommodation rates, inclusions, and availability may vary by date, season, guest count, and selected arrangement. Information shown on the website is provided for general guidance and may be updated.'],
    ['Payments and Deposits', 'A deposit or payment may be required to secure a reservation. Payment instructions, accepted methods, deadlines, and balance details will be provided before final confirmation.'],
    ['Cancellations and Changes', 'Cancellation, date-change, refund, and no-show terms may vary depending on the reservation arrangement. Guests should review the confirmed terms before payment.'],
    ['Guest Responsibilities', 'Guests are responsible for providing accurate information, respecting property rules, following safety guidance, and communicating special requests or arrival details in advance.'],
    ['Experiences and Third-Party Services', 'Some experiences, transfers, wellness services, dining arrangements, or island activities may depend on availability, weather, partner providers, or operational conditions.'],
    ['Website Content', 'Images, text, branding, and other website content are provided for informational and promotional purposes. They may not be copied or reused without permission.'],
    ['Limitation', 'The website is provided on an informational basis. Pueblo La Perla Boracay may update website content, policies, rates, and availability at any time.'],
    ['Contact', 'For reservation questions, guests should contact the PLP team through the available inquiry or reservation channels.'],
  ];
  return <main id='main-content' className='min-h-screen bg-[#FAFAF7] pb-24 pt-32'><div className='mx-auto max-w-[980px] px-6 md:px-12'><p className='mb-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7A6A3A]'>Pueblo La Perla Boracay</p><h1 className='mb-8 font-serif text-5xl md:text-6xl'>{title}</h1><p className='mb-14 text-lg leading-relaxed text-[#3F3F3F]'>{intro}</p><div className='space-y-10 border-t border-stone-200 pt-10'>{sections.map(([heading, text]) => <section key={heading}><h2 className='mb-4 font-serif text-3xl'>{heading}</h2><p className='leading-relaxed text-[#3F3F3F]'>{text}</p></section>)}</div></div></main>;
}

function getInitialView() {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return PATH_TO_VIEW[path] || 'home';
}

function ImageBlock({ label, ratio = 'aspect-[4/5]', src, alt }) {
  return <div data-plp-image-fallback='true' className={`relative w-full overflow-hidden bg-stone-200 ${ratio}`}>{src ? <img src={src} alt={alt || label} className='absolute inset-0 h-full w-full object-cover' loading='lazy' /> : <div className='absolute inset-0 flex items-center justify-center px-8 text-center font-serif text-sm uppercase tracking-widest text-stone-500'>{label}</div>}</div>;
}

function PageLink({ target, navigate, children, ...props }) {
  if (['booking','accommodations','experiences'].includes(target)) return <a href={ROUTES[target]} {...props}>{children}</a>;
  const onClick = (event) => {
    // Let the browser handle modified clicks, new tabs, and context menus.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(target);
  };
  return <a href={ROUTES[target] || '/'} onClick={onClick} {...props}>{children}</a>;
}

function PublicNavbar({ view, navigate, isScrolled, isOpen, setIsOpen }) {
  const solid = isScrolled || view !== 'home' || isOpen;
  const navBg = solid ? 'bg-[#FAFAF7] text-[#1A1A1A] border-b border-stone-200' : 'bg-gradient-to-b from-black/75 to-black/35 text-white';
  const logoColor = solid ? 'text-[#1A1A1A]' : 'text-white';
  const itemColor = solid ? 'text-[#1A1A1A] hover:text-[#7A6A3A]' : 'text-white hover:text-white/80';
  const links = [['home', 'Overview'], ['accommodations', 'Accommodation'], ['experiences', 'Experiences'], ['club', 'Pearl Club'], ['gallery', 'Gallery'], ['getting-here', 'Getting Here'], ['booking', 'Reserve']];
  const mobileMenuId = 'public-mobile-menu';
  return <header className={`plp-public-header fixed top-0 z-50 w-full transition-all duration-500 ${navBg}`}>
    <div className='mx-auto flex h-24 max-w-[1400px] items-center justify-between px-5 pt-[var(--safe-top)] md:px-12'>
      <PageLink target='home' navigate={navigate} className={`plp-public-brand ${logoColor}`} aria-label='Pueblo La Perla home'><img className='plp-public-brand__mark' src={solid ? '/brand/PLP_Editorial_Vector_Logo.svg' : '/brand/PLP_Editorial_Reversed_Ivory.svg'} alt='' width='43' height='60' /><span className='plp-public-brand__type'><span className='plp-public-brand__full'>PUEBLO LA PERLA</span><span className='plp-public-brand__short' aria-hidden='true'>PLP</span><span className='plp-public-brand__location'>Boracay</span></span></PageLink>
      <nav className='hidden items-center gap-4 text-xs font-semibold uppercase tracking-[0.14em] xl:flex 2xl:gap-7'>{links.map(([id, label]) => <PageLink key={id} target={id} navigate={navigate} aria-current={view === id ? 'page' : undefined} className={`inline-flex min-h-11 items-center transition-colors ${itemColor} ${id === 'booking' ? 'plp-public-nav-reserve border px-5' : ''}`}>{label}</PageLink>)}</nav>
      <button onClick={() => setIsOpen(!isOpen)} className='min-h-11 min-w-11 p-2 xl:hidden' aria-label={isOpen ? 'Close menu' : 'Open menu'} aria-expanded={isOpen} aria-controls={mobileMenuId}>{isOpen ? <X className={`h-6 w-6 ${logoColor}`} /> : <Menu className={`h-6 w-6 ${logoColor}`} />}</button>
    </div>
    {isOpen && <div id={mobileMenuId} role='navigation' aria-label='Mobile site navigation' className='fixed inset-x-0 bottom-0 top-24 z-40 overflow-y-auto border-t border-stone-200 bg-[#FAFAF7] pb-[calc(6rem+var(--safe-bottom))] xl:hidden'>
      <div className='flex flex-col items-center space-y-8 px-6 pt-14 text-sm font-semibold uppercase tracking-[0.2em] text-[#1A1A1A]'>{links.map(([id, label]) => <PageLink key={id} target={id} navigate={navigate} aria-current={view === id ? 'page' : undefined} className={id === 'booking' ? 'mt-8 flex min-h-11 items-center text-[#7A6A3A]' : 'flex min-h-11 items-center'}>{label}</PageLink>)}<PageLink target='contact' navigate={navigate} className='flex min-h-11 items-center text-xs text-stone-600 hover:text-stone-900'>Contact Inquiry</PageLink></div>
    </div>}
  </header>;
}

function PublicFooter({ navigate }) {
  const explore = [['accommodations', 'Accommodation'], ['experiences', 'Experiences'], ['club', 'Pearl Club'], ['gallery', 'Gallery'], ['getting-here', 'Getting Here'], ['vip-package', 'Exclusive Offer']];
  return <footer className='bg-[#1A1A1A] px-6 pb-32 pt-20 text-white md:px-12 md:pb-20'>
    <div className='mx-auto grid max-w-[1400px] grid-cols-1 gap-12 md:grid-cols-4'>
      <div className='md:col-span-2'><img src='/brand/PLP_Editorial_Reversed_Ivory.svg' alt='' width='45' height='63' className='mb-5 h-[63px] w-[45px] object-contain' /><h3 className='mb-4 font-serif text-2xl tracking-[0.15em]'>PUEBLO LA PERLA</h3><p className='max-w-md text-sm leading-relaxed text-white/75'>A private hillside retreat in Boracay, designed for villa living, wellness, and quiet island experiences.</p></div>
      <div><p className='mb-5 text-xs uppercase tracking-[0.2em] text-[#D0BE7A]'>Explore</p><div className='space-y-3 text-sm text-white/75'>{explore.map(([id, label]) => <PageLink key={id} target={id} navigate={navigate} className='block min-h-8 hover:text-white'>{label}</PageLink>)}</div></div>
      <div><p className='mb-5 text-xs uppercase tracking-[0.2em] text-[#D0BE7A]'>Inquiries</p>
        <a href={'mailto:' + CONCIERGE_EMAIL} className='block text-sm text-white/90 hover:underline'>{CONCIERGE_EMAIL}</a>
        <a href={'tel:' + CONCIERGE_NUMBER} className='mt-2 block text-sm text-white/90 hover:underline'>{CONCIERGE_NUMBER_DISPLAY}</a>
        <SocialLinks className='plp-social--footer mt-5' />
        <PageLink target='booking' navigate={navigate} className='mt-6 inline-flex min-h-11 items-center border-b border-white text-xs uppercase tracking-[0.2em] hover:border-[#D0BE7A] hover:text-[#D0BE7A]'>Reserve</PageLink>
        <PageLink target='contact' navigate={navigate} className='mt-3 block text-sm text-white/70 hover:text-white'>General inquiry</PageLink>
        <div className='mt-6 flex flex-col gap-3 text-sm text-white/70'><PageLink target='privacy-policy' navigate={navigate} className='hover:text-white'>Privacy Policy</PageLink><PageLink target='terms-of-service' navigate={navigate} className='hover:text-white'>Terms of Service</PageLink></div>
      </div>
    </div>
    <div className='mx-auto mt-12 max-w-[1400px] border-t border-white/10 pt-6 text-xs text-white/55'>© 2026 Pueblo La Perla Boracay. All rights reserved.</div>
  </footer>;
}

function MobileActionBar({ navigate, menuOpen = false, view }) {
  if (menuOpen) return null;
  const clubRelated = view === 'club' || view === 'senior-living';
  return <div className='plp-mobile-action fixed inset-x-0 bottom-0 z-40 px-4 md:hidden' style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}>
    <div className='plp-mobile-action__inner'>
      {clubRelated ? <>
        <a href='/club#club-application' className='plp-mobile-action__book'>Apply to Pearl Club</a>
        <a href={view === 'senior-living' ? '/contact?topic=club&purpose=residential-interest' : '/contact?topic=club'} className='plp-mobile-action__concierge'>Ask club team</a>
      </> : <>
        <PageLink target='booking' navigate={navigate} className='plp-mobile-action__book'>Check availability</PageLink>
        <PageLink target='contact' navigate={navigate} className='plp-mobile-action__concierge'>Ask concierge</PageLink>
      </>}
    </div>
  </div>;
}

function EditorialSection({ label, title, text, imageSrc, imageAlt, topic, align = 'right' }) {
  const content = <div className='flex max-w-xl flex-col justify-center'><p className='mb-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7A6A3A]'>{label}</p><h2 className='mb-8 font-serif text-3xl leading-tight text-[#1A1A1A] md:text-5xl'>{title}</h2><p className='whitespace-pre-line text-sm leading-relaxed text-[#3F3F3F] md:text-base'>{text}</p><a className="journey-link mt-4" href={'/contact?topic=' + topic}>Ask concierge about {label.toLowerCase()}</a></div>;
  const image = <ImageBlock label={label} src={imageSrc} alt={imageAlt} />;
  return <div className='mx-auto max-w-[1400px] px-6 py-20 md:px-12 md:py-24'><div className='grid grid-cols-1 items-center gap-16 md:gap-24 lg:grid-cols-2'>{align === 'left' ? <><div className='order-2 lg:order-1'>{content}</div><div className='order-1 lg:order-2'>{image}</div></> : <><div className='order-1'>{image}</div><div className='order-2'>{content}</div></>}</div></div>;
}

function AccommodationsView({ navigate }) {
  return <main id='main-content' className='plp-accommodations-page min-h-screen bg-[#FAFAF7] pb-24 pt-32'>
    <div className='mx-auto max-w-[1400px] px-6 md:px-12'>
      <div className='plp-accommodations-intro mb-12 max-w-3xl md:mb-16'>
        <p className='journey-kicker'>The accommodation collection</p>
        <h1 className='mb-6 font-serif text-5xl md:text-6xl'>Stay somewhere extraordinary.</h1>
        <p className='text-lg leading-relaxed text-[#3F3F3F]'>From a private hillside villa to a quiet suite or modern room, find a space that feels like your own corner of Boracay.</p>
      </div>
      <div className='plp-accommodations-list'>
        {ACCOMMODATIONS.map((acc, index) => <article key={acc.id} className={'plp-accommodation-entry' + (index % 2 !== 0 ? ' plp-accommodation-entry--reverse' : '')}>
          <div className='plp-accommodation-entry__media'>
            <ImageBlock label={acc.name} ratio='aspect-[16/10]' src={acc.heroSrc} alt={acc.heroAlt || acc.name + ' at Pueblo La Perla Boracay'} />
            <span className='plp-accommodation-entry__ordinal' aria-hidden='true'>0{index + 1}</span>
          </div>
          <div className='plp-accommodation-entry__copy'>
            <p className='journey-kicker'>{acc.imageTag}</p>
            <h2>{acc.name}</h2>
            <p className='plp-accommodation-entry__description'>{acc.description}</p>
            <p className='plp-accommodation-entry__best'>Best for: {acc.bestFor}</p>
            <dl className='plp-accommodation-entry__facts'>
              <div><dt>Guests</dt><dd>Up to {acc.capacity}</dd></div>
              <div><dt>Bedrooms</dt><dd>{acc.bedrooms}</dd></div>
              <div><dt>Rate from</dt><dd>{formatMoney(acc.rate)} / night</dd></div>
            </dl>
            <div className='plp-accommodation-entry__features'>{acc.features.map(feature => <span key={feature}>{feature}</span>)}</div>
            <div className='plp-accommodation-entry__actions'>
              <a href={'/booking?room=' + acc.slug} className='journey-primary'>Check dates <ChevronRight size={17} aria-hidden='true' /></a>
              <button onClick={() => navigate(acc.slug)} className='journey-link'>Explore {acc.type.toLowerCase()} <ChevronRight size={16} aria-hidden='true' /></button>
            </div>
          </div>
        </article>)}
      </div>
    </div>
  </main>;
}

function RoomDetailView({ room, navigate }) {
  const others = ACCOMMODATIONS.filter((item) => item.slug !== room.slug);
  return <main id='main-content' className='min-h-screen bg-[#FAFAF7] pb-24'>
    <section className='relative flex min-h-[64svh] w-full items-end overflow-hidden bg-stone-900'>
      <img src={room.heroSrc} alt={room.heroAlt} className='absolute inset-0 h-full w-full object-cover' />
      <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30' />
      <div className='relative z-10 mx-auto w-full max-w-[1400px] px-6 pb-14 pt-32 md:px-12 md:pb-20'>
        <button onClick={() => navigate('accommodations')} className='mb-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80 hover:text-white'>← All accommodation</button>
        <p className='mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90'>{room.type}</p>
        <h1 className='mb-5 max-w-3xl font-serif text-5xl leading-[1.02] text-white md:text-7xl'>{room.name}</h1>
        <p className='max-w-2xl text-sm leading-relaxed text-white/90 md:text-base'>{room.description}</p>
      </div>
    </section>
    <div className='mx-auto max-w-[1400px] px-6 md:px-12'>
      <section className='grid grid-cols-2 gap-px border-b border-stone-200 bg-stone-200 sm:grid-cols-4' aria-label='Room summary'>
        {[['Guests', `Up to ${room.capacity}`], ['Bedrooms', String(room.bedrooms)], ['From', `${formatMoney(room.rate)} / night`], ['Best for', room.bestFor.split(',')[0]]].map(([label, value]) => <div key={label} className='bg-[#FAFAF7] px-5 py-7'><p className='mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A5A2D]'>{label}</p><p className='font-serif text-xl text-[#1A1A1A] md:text-2xl'>{value}</p></div>)}
      </section>
      <section className='grid grid-cols-1 gap-4 pt-16 sm:grid-cols-2 lg:grid-cols-3' aria-label={`${room.name} photographs`}>
        {room.gallery.map(([src, alt], index) => <figure key={src} className={`relative overflow-hidden bg-stone-200 ${index === 0 ? 'sm:col-span-2 lg:col-span-2 aspect-[16/10]' : 'aspect-[4/3]'}`}><img src={src} alt={alt} loading={index === 0 ? 'eager' : 'lazy'} className='absolute inset-0 h-full w-full object-cover' /></figure>)}
      </section>
      <section className='grid grid-cols-1 gap-12 pt-20 md:grid-cols-3 md:gap-10'>
        <div><h2 className='mb-4 font-serif text-2xl'>Best for</h2><p className='text-sm leading-relaxed text-[#3F3F3F]'>{room.bestFor}</p></div>
        <div><h2 className='mb-4 font-serif text-2xl'>In this stay</h2><div className='flex flex-wrap gap-2'>{room.features.map((feature) => <span key={feature} className='bg-stone-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#514c43]'>{feature}</span>)}</div></div>
        <div><h2 className='mb-4 font-serif text-2xl'>Concierge can arrange</h2><ul className='space-y-2 border-l border-[#7A6A3A]/40 pl-5 text-sm leading-relaxed text-[#3F3F3F]'><li>Airport and port transfer coordination</li><li>In-stay dining and celebrations</li><li>Wellness rituals and island activities</li></ul></div>
      </section>
      <section className='mt-16 flex flex-col items-start gap-5 border-t border-stone-200 pt-12 sm:flex-row sm:items-center sm:gap-8'>
        <a href={'/booking?room=' + room.slug} className='border border-[#1A1A1A] px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] transition hover:bg-[#1A1A1A] hover:text-white'>Request {room.name} dates</a>
        <a href={'/contact?topic=stay&room=' + room.slug} className='border-b border-[#1A1A1A] pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] hover:border-[#7A6A3A] hover:text-[#7A6A3A]'>Ask concierge</a>
      </section>
      <p className='mt-8 max-w-2xl text-sm leading-relaxed text-[#6A645B]'>Submitting a request does not confirm a booking. The team will reply by email to confirm availability, rates, deposit details, and next steps.</p>
      <section className='mt-24 border-t border-stone-200 pt-14' aria-label='Other accommodation'>
        <p className='mb-8 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7A6A3A]'>Compare other stays</p>
        <div className='grid grid-cols-1 gap-8 sm:grid-cols-2'>{others.map((item) => <button key={item.slug} onClick={() => navigate(item.slug)} className='group flex items-start justify-between gap-6 border border-stone-200 bg-white/60 p-6 text-left transition-colors hover:border-[#7A6A3A]'><span><span className='mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A5A2D]'>{item.type}</span><span className='block font-serif text-2xl text-[#1A1A1A]'>{item.name}</span><span className='mt-2 block text-sm text-[#3F3F3F]'>Up to {item.capacity} guests · from {formatMoney(item.rate)} / night</span></span><span className='mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7A6A3A] group-hover:text-[#1A1A1A]'>View →</span></button>)}</div>
      </section>
    </div>
  </main>;
}

function ExperiencesView() { return <main id='main-content' className='min-h-screen bg-[#FAFAF7] pb-24 pt-32'><div className='mx-auto max-w-[1400px] px-6 md:px-12'><div className='mb-20 max-w-3xl md:mb-24'><p className='mb-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7A6A3A]'>Experiences</p><h1 className='mb-6 font-serif text-5xl md:text-6xl'>Days shaped by island rhythm.</h1><p className='text-lg leading-relaxed text-[#3F3F3F]'>From water adventures to wellness rituals and private dining, each stay can be quietly arranged around the guest.</p></div><div className='space-y-28 md:space-y-32'>{EXPERIENCE_GROUPS.map(([label,title,text,image,alt,topic],index)=><EditorialSection key={label} label={label} title={title} text={text} imageSrc={image} imageAlt={alt} topic={topic} align={index % 2 === 0 ? 'right' : 'left'} />)}</div></div></main>; }
function GettingHereView({ navigate }) {
  const steps = [
    [Plane, 'Fly to Caticlan or Kalibo', 'Caticlan is the closest airport. If you fly into Kalibo, allow extra time to reach the mainland jetty.'],
    [Anchor, 'Cross to Boracay', 'Take the boat from the mainland jetty to Boracay. Share your flight details so concierge can help coordinate the crossing.'],
    [MapPin, 'Continue to High Boracay', 'Ask concierge to confirm the pickup point and final directions to the resort before you travel.'],
  ];
  return <main id='main-content' className='min-h-screen bg-[#FAFAF7] pb-24 pt-32'>
    <div className='mx-auto max-w-[1200px] px-6 md:px-12'>
      <h1 className='mb-6 font-serif text-5xl leading-tight md:text-6xl'>Getting Here</h1>
      <p className='mb-6 max-w-2xl text-lg leading-relaxed text-[#3F3F3F]'>Pueblo La Perla is in High Boracay, on the hillside near Station 2.</p>
      <a href='/high-boracay-location' className='inline-flex min-h-11 items-center font-semibold text-[#59502C] underline underline-offset-4'>Explore the High Boracay location</a>
      <section className='mt-10 grid gap-9 border-y border-stone-200 py-12 md:grid-cols-3' aria-label='Arrival steps'>
        {steps.map(([Icon, title, text]) => <article key={title}>
          <Icon className='mb-4 h-5 w-5 text-[#7A6A3A]' aria-hidden='true' />
          <h2 className='mb-3 font-serif text-2xl'>{title}</h2>
          <p className='text-sm leading-relaxed text-[#3F3F3F]'>{text}</p>
        </article>)}
      </section>
      <section className='mt-12 max-w-2xl'>
        <h2 className='mb-4 font-serif text-3xl'>Arrange your transfer</h2>
        <p className='mb-6 text-sm leading-relaxed text-[#3F3F3F]'>Share your airport, flight number, arrival time, and group size with concierge. The team will confirm the pickup details.</p>
        <a href='/contact?topic=arrival' className='inline-flex border border-[#1A1A1A] px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] transition hover:bg-[#1A1A1A] hover:text-white'>Contact concierge</a>
      </section>
    </div>
  </main>;
}

function BookingRedirectView(){ useEffect(()=>{ window.location.href='/booking'; },[]); return <div className='min-h-screen bg-[#FAFAF7] px-6 pt-40 text-center'><p className='font-serif text-4xl'>Opening private reservation...</p></div>; }
function VipPackageView({navigate}){ return <main id='main-content' className='min-h-screen bg-[#FAFAF7] pb-24 pt-32'><div className='mx-auto max-w-[1200px] px-6 md:px-12'><p className='mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#7A6A3A]'>Exclusive Offer · Under Review</p><h1 className='mb-8 max-w-4xl font-serif text-5xl leading-tight md:text-6xl'>A private wellness return to Boracay, year after year.</h1><p className='mb-10 max-w-3xl text-lg leading-relaxed text-[#3F3F3F]'>We are exploring a returning-guest wellness arrangement with Pueblo La Perla. No multi-year package is open for purchase or enrollment until its terms have been approved.</p><div className='border-t border-stone-200 py-10'><p className='max-w-3xl text-base leading-8 text-[#3F3F3F]'>Duration, annual stays, inclusions, availability, prices, cancellation rights, and payment terms have not been finalized. Please ask the concierge for information before making any commitment.</p></div><button onClick={()=>navigate('contact')} className='mt-4 inline-flex min-h-12 items-center border-b border-[#1A1A1A] text-sm font-semibold hover:border-[#7A6A3A] hover:text-[#7A6A3A]'>Ask about the proposed offer</button></div></main>; }
const GALLERY_IMAGES = GALLERY_GROUPS.flatMap(([category, , images]) => images.map(([src, alt]) => ({ src, alt, category })));
const GALLERY_FILTERS = ['All', ...GALLERY_GROUPS.map(([title]) => title)];

function GalleryLightbox({ images, index, onClose, onPrev, onNext }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  useEffect(() => { closeButtonRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') onPrev();
      else if (event.key === 'ArrowRight') onNext();
      else if (event.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]),a[href]') || [])];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = document.activeElement;
        if (event.shiftKey && (current === first || !dialogRef.current.contains(current))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (current === last || !dialogRef.current.contains(current))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; };
  }, [onClose, onPrev, onNext]);

  const current = images[index];
  if (!current) return null;
  const multiple = images.length > 1;
  return <div ref={dialogRef} role='dialog' aria-modal='true' aria-label='Gallery image viewer' className='fixed inset-0 z-[60] flex flex-col bg-black/[0.94] pb-[var(--safe-bottom)] pt-[var(--safe-top)]' onClick={onClose}>
    <div className='flex items-center justify-between px-5 py-4 text-white/80 md:px-8'><p className='text-[10px] font-semibold uppercase tracking-[0.2em]'>{current.category} · {index + 1} / {images.length}</p><button ref={closeButtonRef} onClick={onClose} className='flex min-h-11 min-w-11 items-center justify-center text-white hover:text-white/70' aria-label='Close gallery viewer'><X className='h-6 w-6' /></button></div>
    <div className='relative flex flex-1 items-center justify-center overflow-hidden px-4 md:px-16' onClick={(event) => event.stopPropagation()}>
      {multiple && <button onClick={onPrev} className='absolute left-2 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 md:left-6' aria-label='Previous image'><ChevronLeft className='h-7 w-7' /></button>}
      <figure className='flex max-h-full max-w-full flex-col items-center'><img src={current.src} alt={current.alt} className='max-h-[78vh] w-auto max-w-full object-contain' /><figcaption className='mt-4 max-w-2xl px-4 text-center text-xs leading-relaxed text-white/70'>{current.alt}</figcaption></figure>
      {multiple && <button onClick={onNext} className='absolute right-2 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 md:right-6' aria-label='Next image'><ChevronRight className='h-7 w-7' /></button>}
    </div>
  </div>;
}

function GalleryView({ navigate }) {
  const [filter, setFilter] = useState('All');
  const [activeIndex, setActiveIndex] = useState(null);
  const lastTrigger = useRef(null);
  const visible = useMemo(() => filter === 'All' ? GALLERY_IMAGES : GALLERY_IMAGES.filter((image) => image.category === filter), [filter]);
  const openAt = (image, event) => { lastTrigger.current = event.currentTarget; setActiveIndex(visible.findIndex((item) => item.src === image.src)); };
  const close = () => { setActiveIndex(null); requestAnimationFrame(() => lastTrigger.current?.focus()); };
  const step = (delta) => setActiveIndex((current) => (current + delta + visible.length) % visible.length);
  return <main id='main-content' className='min-h-screen bg-[#FAFAF7] pb-24 pt-32'><div className='mx-auto max-w-[1400px] px-6 md:px-12'><div className='mb-12 max-w-3xl md:mb-14'><p className='mb-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7A6A3A]'>Gallery</p><h1 className='mb-6 font-serif text-5xl leading-[1.02] md:text-6xl'>The hillside, room by room.</h1><p className='text-lg leading-relaxed text-[#3F3F3F]'>A visual tour of Pueblo La Perla, grouped by what you came to see — villas and views, interiors, wellness, and quiet island evenings. Every photograph is of the property itself.</p></div>
    <div className='mb-12 flex flex-wrap gap-2.5 border-y border-stone-200 py-5' role='group' aria-label='Filter gallery by category'>{GALLERY_FILTERS.map((label) => { const active = filter === label; return <button key={label} onClick={() => setFilter(label)} aria-pressed={active} className={`min-h-11 rounded-full border px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${active ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white' : 'border-stone-300 bg-transparent text-[#3F3F3F] hover:border-[#7A6A3A] hover:text-[#7A6A3A]'}`}>{label}</button>; })}</div>
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>{visible.map((image, position) => <button key={image.src} onClick={(event) => openAt(image, event)} className='group relative block aspect-[4/3] overflow-hidden bg-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6A5A2D] focus-visible:ring-offset-2' aria-label={`Open image: ${image.alt}`}><img src={image.src} alt={image.alt} loading={position < 6 ? 'eager' : 'lazy'} className='absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105' /><span className='pointer-events-none absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/45 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100'><span className='text-[10px] font-semibold uppercase tracking-[0.18em] text-white'>{image.category}</span></span></button>)}</div>
    <div className='mt-24 border-t border-stone-200 pt-16 text-center'><p className='mb-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7A6A3A]'>Ready to see it in person</p><h2 className='mx-auto mb-10 max-w-2xl font-serif text-4xl leading-tight md:text-5xl'>Choose where you will stay.</h2><div className='flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8'><button onClick={() => navigate('accommodations')} className='border-b border-[#1A1A1A] pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] hover:border-[#7A6A3A] hover:text-[#7A6A3A]'>View accommodation</button><button onClick={() => navigate('booking')} className='border border-[#1A1A1A] px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] transition hover:bg-[#1A1A1A] hover:text-white'>Begin private reservation</button></div></div></div>{activeIndex !== null && <GalleryLightbox images={visible} index={activeIndex} onClose={close} onPrev={() => step(-1)} onNext={() => step(1)} />}</main>;
}
function App(){ const [view,setView]=useState(getInitialView); const [isScrolled,setIsScrolled]=useState(false); const [isOpen,setIsOpen]=useState(false); const navigate=(target)=>{ if (['accommodations', 'experiences', 'booking'].includes(target)) { if (target === 'booking') window.plpTrack?.('click_reserve'); window.location.assign(ROUTES[target]); return; } const path=ROUTES[target] || '/'; window.history.pushState({},'',path); setView(target); setIsOpen(false); window.scrollTo({top:0,behavior:'smooth'}); }; useEffect(()=>{ const onScroll=()=>setIsScrolled(window.scrollY>40); const onPop=()=>setView(getInitialView()); onScroll(); window.addEventListener('scroll',onScroll); window.addEventListener('popstate',onPop); return()=>{window.removeEventListener('scroll',onScroll); window.removeEventListener('popstate',onPop);};},[]); useEffect(()=>{
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const toggle = document.querySelector('[aria-controls="public-mobile-menu"]');
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        toggle?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const menu = document.getElementById('public-mobile-menu');
      if (!menu) return;
      const controls = [toggle, ...menu.querySelectorAll('a[href], button:not([disabled])')].filter(Boolean);
      if (controls.length === 0) return;
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    const onResize = () => { if (window.innerWidth >= 1280) setIsOpen(false); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  },[isOpen]); useEffect(()=>{ const meta=PAGE_META[view]||PAGE_META.home; document.title=meta[0]; let description=document.querySelector('meta[name="description"]'); if(!description){description=document.createElement('meta'); description.setAttribute('name','description'); document.head.appendChild(description);} description.setAttribute('content',meta[1]); let canonical=document.querySelector('link[rel="canonical"]'); if(!canonical){canonical=document.createElement('link'); canonical.setAttribute('rel','canonical'); document.head.appendChild(canonical);} canonical.setAttribute('href',`${SITE_URL}${ROUTES[view] || '/'}`);window.dispatchEvent(new Event('plp:navigation'));
  if (window.location.hash) {
    const target = document.getElementById(window.location.hash.slice(1));
    if (target) requestAnimationFrame(() => target.scrollIntoView());
  }
},[view]); const content=useMemo(()=>{ if(ROOM_BY_SLUG[view]) return <RoomDetailView room={ROOM_BY_SLUG[view]} navigate={navigate}/>; switch(view){ case 'accommodations': return <AccommodationsView navigate={navigate}/>; case 'experiences': return <ExperiencesView/>; case 'club': return <ClubView/>; case 'senior-living': return <SeniorLivingView/>; case 'gallery': return <GalleryView navigate={navigate}/>; case 'getting-here': return <GettingHereView navigate={navigate}/>; case 'vip-package': return <VipPackageView navigate={navigate}/>; case 'booking': return <BookingRedirectView/>; case 'payment-success': return <PaymentSuccessView navigate={navigate}/>; case 'payment-cancel': return <PaymentCancelView navigate={navigate}/>; case 'contact': return <ConciergeView/>; case 'privacy-policy': return <LegalPageView type='privacy'/>; case 'terms-of-service': return <LegalPageView type='terms'/>; default: return <HomeView rooms={ACCOMMODATIONS}/>; }},[view]); return <><a className='skip-link' href='#main-content'>Skip to content</a><PublicNavbar view={view} navigate={navigate} isScrolled={isScrolled} isOpen={isOpen} setIsOpen={setIsOpen}/>{content}<PublicFooter navigate={navigate}/><MobileActionBar navigate={navigate} menuOpen={isOpen} view={view}/></>; }

export default App;
