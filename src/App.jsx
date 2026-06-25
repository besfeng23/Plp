import React, { useEffect, useMemo, useState } from 'react';
import {
  Anchor,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Menu,
  Plane,
  Star,
  Users,
  X,
} from 'lucide-react';
import VideoSection from './VideoSection.jsx';

const SITE_URL = 'https://plp-boracay.vercel.app';
const DEPOSIT_RATE = 0.3;

const ROUTES = {
  home: '/',
  accommodations: '/accommodation',
  experiences: '/experiences',
  'getting-here': '/getting-here',
  'vip-package': '/exclusive-offer',
  booking: '/booking',
  'payment-success': '/booking/success',
  'payment-cancel': '/booking/cancel',
  contact: '/contact',
  'guest-login': '/guest',
  'guest-portal': '/guest/portal',
  'admin-login': '/admin',
  'admin-dashboard': '/admin/dashboard',
};

const PATH_TO_VIEW = Object.fromEntries(Object.entries(ROUTES).map(([key, value]) => [value, key]));
PATH_TO_VIEW['/accommodations'] = 'accommodations';
PATH_TO_VIEW['/vip-package'] = 'vip-package';

const PAGE_META = {
  home: ['Pueblo La Perla Boracay | Private Villas and Island Experiences', 'A private hillside retreat in Boracay with villas, wellness, curated island experiences, and VIP long-stay offers minutes from Station 2.'],
  accommodations: ['Accommodation | Pueblo La Perla Boracay', 'Explore Pueblo La Perla villas, suites, and smart rooms designed for privacy, comfort, and quiet Boracay stays.'],
  experiences: ['Experiences | Pueblo La Perla Boracay', 'Water activities, wellness rituals, private dining, and island experiences arranged through Pueblo La Perla Boracay.'],
  'getting-here': ['Getting Here | Pueblo La Perla Boracay', 'Arrival guidance through Caticlan or Kalibo with port pickup and transfer coordination.'],
  'vip-package': ['VIP Wellness Package | Pueblo La Perla Boracay', 'A five-year Pueblo La Perla VIP Wellness offer with four nights annually and a private digital entitlement ledger.'],
  booking: ['Reserve Your Stay | Pueblo La Perla Boracay', 'Reserve your Pueblo La Perla Boracay stay with a secure reservation deposit and concierge confirmation.'],
  'payment-success': ['Payment Verification | Pueblo La Perla Boracay', 'Your Pueblo La Perla payment return page. Final confirmation follows payment verification.'],
  'payment-cancel': ['Payment Not Completed | Pueblo La Perla Boracay', 'Retry or contact Pueblo La Perla concierge if your reservation payment was not completed.'],
  contact: ['Reserve and Inquire | Pueblo La Perla Boracay', 'Send a private reservation or VIP Wellness Package inquiry to the Pueblo La Perla Boracay team.'],
};

const IMAGES = {
  homeAccommodation: '/images/plp-villa-close-aerial.jpeg',
  grandVilla: '/images/plp-grand-ocean-villa-aerial.jpeg',
};

const ACCOMMODATIONS = [
  {
    id: 1,
    name: 'Grand Ocean Villa',
    type: 'Villa',
    rate: 40000,
    capacity: 8,
    bedrooms: 4,
    description: 'A private hillside sanctuary with sweeping sea views, designed for profound seclusion and effortless island living.',
    features: ['Private Pool', 'Beach View', 'Kitchen', 'Living Room', 'Personalized Service'],
    imageTag: 'VILLA',
    imageSrc: IMAGES.grandVilla,
    imageAlt: 'Aerial view of Pueblo La Perla Grand Ocean Villa with private pool and hillside greenery',
  },
  {
    id: 2,
    name: 'Sunset Suite',
    type: 'Suite',
    rate: 18000,
    capacity: 4,
    bedrooms: 2,
    description: 'Elevated comfort framed by Boracay’s quiet horizons. A refined retreat minutes away from the island’s vibrant center.',
    features: ['Balcony', 'Living Room', 'Local Dining', 'Shuttle Access'],
    imageTag: 'SUITE',
  },
  {
    id: 3,
    name: 'Smart Room Premium',
    type: 'Smart Room',
    rate: 8000,
    capacity: 2,
    bedrooms: 1,
    description: 'A modern, quiet base. Intelligent controls meet muted luxury for the discerning solo traveler or couple.',
    features: ['IoT Controls', 'Work Desk', 'WiFi', 'Air-conditioning'],
    imageTag: 'SMART ROOM',
  },
];

const EXPERIENCE_GROUPS = [
  ['Water', 'The island by sea.', 'Paraw sailing, island hopping, snorkeling, scuba diving, jet skiing, and curated water activities arranged through our team.', '[ Water Activities Image ]'],
  ['Wellness', 'Restored in privacy.', 'In-room massage, spa treatments, quiet rituals, and slow days shaped around recovery and stillness.', '[ Spa and Massage Image ]'],
  ['Private Dining', 'Evenings prepared for you.', 'Sunset dinners, local dining experiences, and intimate meals arranged for families, couples, and private groups.', '[ Sunset Dinner Image ]'],
];

const INITIAL_BOOKINGS = [
  { id: 'BKG-001', reference: 'BKG-001', guest: 'Demo Guest', unit: 'Grand Ocean Villa', checkIn: '2026-07-01', checkOut: '2026-07-04', status: 'Confirmed', paymentStatus: 'Deposit Verified', amount: 120000, deposit: 36000, balance: 84000 },
  { id: 'BKG-002', reference: 'BKG-002', guest: 'Sample Lead', unit: 'Sunset Suite', checkIn: '2026-07-05', checkOut: '2026-07-07', status: 'Pending Deposit', paymentStatus: 'Awaiting Xendit Checkout', amount: 36000, deposit: 10800, balance: 25200 },
];
const INITIAL_LEADS = [{ id: 'LD-001', name: 'Sample Prospect', email: 'prospect@example.com', interest: 'VIP Wellness Package', status: 'Proposal Sent', phone: '0917-000-0000', value: 300000, nextStep: 'Follow up payment' }];
const INITIAL_VIP_MEMBERS = [{ id: 'VIP-101', name: 'Demo Member', contractValue: 300000, totalEntitlement: 20, usedNights: 8, remainingNights: 12, validUntil: '2030-12-01' }];
const INITIAL_VIP_LEDGER = [
  { id: 'LED-001', type: 'credit', nights: 20, label: 'Package entitlement activated', date: '2024-12-01' },
  { id: 'LED-002', type: 'debit', nights: 4, label: 'Grand Ocean Villa stay', date: '2025-01-05' },
];

function getInitialView() {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return PATH_TO_VIEW[path] || 'home';
}

function formatMoney(value) {
  return `₱${Number(value || 0).toLocaleString('en-PH')}`;
}

function countNights(checkIn, checkOut) {
  const diff = new Date(`${checkOut}T00:00:00`) - new Date(`${checkIn}T00:00:00`);
  return Number.isFinite(diff) && diff > 0 ? Math.round(diff / 86400000) : 0;
}

function SectionDivider() {
  return <div className='flex w-full justify-center py-20'><div className='h-16 w-px bg-stone-300' /></div>;
}

function ImageBlock({ label, ratio = 'aspect-[4/5]', src, alt }) {
  return (
    <div className={`relative w-full overflow-hidden bg-stone-200 ${ratio}`}>
      {src ? (
        <img src={src} alt={alt || label} className='absolute inset-0 h-full w-full object-cover' loading='lazy' />
      ) : (
        <div className='absolute inset-0 flex items-center justify-center px-8 text-center font-serif text-sm uppercase tracking-widest text-stone-400'>{label}</div>
      )}
    </div>
  );
}

function PublicNavbar({ view, navigate, isScrolled, isOpen, setIsOpen }) {
  const solid = isScrolled || view !== 'home';
  const navBg = solid ? 'bg-[#FAFAF7] text-[#1A1A1A] border-b border-stone-200' : 'bg-transparent text-white';
  const logoColor = solid ? 'text-[#1A1A1A]' : 'text-white';
  const itemColor = solid ? 'text-[#1A1A1A] hover:text-[#9A8A5A]' : 'text-white hover:text-white/70';
  const links = [['home', 'Overview'], ['accommodations', 'Accommodation'], ['experiences', 'Experiences'], ['vip-package', 'Exclusive Offer'], ['getting-here', 'Getting Here'], ['booking', 'Reserve']];
  return (
    <header className={`fixed top-0 z-50 w-full transition-all duration-500 ${navBg}`}>
      <div className='mx-auto flex h-24 max-w-[1400px] items-center justify-between px-6 md:px-12'>
        <button onClick={() => navigate('home')} className={`flex flex-col items-center ${logoColor}`}>
          <span className='font-serif text-2xl font-medium tracking-[0.15em]'>PUEBLO LA PERLA</span>
          <span className='mt-1 text-[10px] uppercase tracking-[0.3em] opacity-70'>Boracay</span>
        </button>
        <nav className='hidden items-center space-x-10 text-[11px] font-medium uppercase tracking-[0.2em] lg:flex'>
          {links.map(([id, label]) => (
            <button key={id} onClick={() => navigate(id)} className={`transition-colors ${itemColor}`}>{label}</button>
          ))}
        </nav>
        <button onClick={() => setIsOpen(!isOpen)} className='p-2 lg:hidden' aria-label='Open menu'>
          {isOpen ? <X className={`h-6 w-6 ${logoColor}`} /> : <Menu className={`h-6 w-6 ${logoColor}`} />}
        </button>
      </div>
      {isOpen && (
        <div className='fixed inset-0 top-24 z-40 overflow-y-auto border-t border-stone-200 bg-[#FAFAF7] lg:hidden'>
          <div className='flex flex-col items-center space-y-8 pt-16 text-sm uppercase tracking-[0.2em] text-[#1A1A1A]'>
            {links.map(([id, label]) => <button key={id} onClick={() => navigate(id)} className={id === 'booking' ? 'mt-8 text-[#9A8A5A]' : ''}>{label}</button>)}
            <button onClick={() => navigate('contact')} className='text-[10px] text-stone-400 hover:text-stone-600'>Contact Inquiry</button>
            <div className='my-8 h-12 w-px bg-stone-300' />
            <button onClick={() => navigate('guest-login')} className='text-[10px] text-stone-400 hover:text-stone-600'>Guest Portal</button>
          </div>
        </div>
      )}
    </header>
  );
}

function PublicFooter({ navigate }) {
  return (
    <footer className='bg-[#1A1A1A] px-6 py-20 text-white md:px-12'>
      <div className='mx-auto grid max-w-[1400px] grid-cols-1 gap-12 md:grid-cols-4'>
        <div className='md:col-span-2'>
          <h3 className='mb-4 font-serif text-2xl tracking-[0.15em]'>PUEBLO LA PERLA</h3>
          <p className='max-w-md text-sm leading-relaxed text-white/60'>A private hillside retreat in Boracay, designed for villa living, wellness, and quiet island experiences.</p>
        </div>
        <div>
          <p className='mb-5 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>Explore</p>
          <div className='space-y-3 text-sm text-white/60'>
            <button onClick={() => navigate('accommodations')} className='block hover:text-white'>Accommodation</button>
            <button onClick={() => navigate('experiences')} className='block hover:text-white'>Experiences</button>
            <button onClick={() => navigate('vip-package')} className='block hover:text-white'>Exclusive Offer</button>
            <button onClick={() => navigate('getting-here')} className='block hover:text-white'>Getting Here</button>
          </div>
        </div>
        <div>
          <p className='mb-5 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>Inquiries</p>
          <p className='text-sm text-white/60'>plpvillas@gmail.com</p>
          <button onClick={() => navigate('booking')} className='mt-6 border-b border-white pb-1 text-[11px] uppercase tracking-[0.2em] hover:border-[#9A8A5A] hover:text-[#9A8A5A]'>Reserve</button>
          <button onClick={() => navigate('contact')} className='mt-4 block text-xs text-white/40 hover:text-white'>General inquiry</button>
        </div>
      </div>
    </footer>
  );
}

function MobileActionBar({ navigate }) {
  return (
    <div className='fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-[#FAFAF7]/95 px-4 py-3 backdrop-blur md:hidden'>
      <div className='grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-[0.18em]'>
        <button onClick={() => navigate('booking')} className='bg-[#1A1A1A] px-3 py-3 text-white'>Reserve</button>
        <a href='mailto:plpvillas@gmail.com' className='border border-stone-300 px-3 py-3 text-[#1A1A1A]'>Email</a>
        <button onClick={() => navigate('contact')} className='border border-stone-300 px-3 py-3 text-[#1A1A1A]'>Concierge</button>
      </div>
    </div>
  );
}

function TrustStrip() {
  return (
    <section className='border-y border-stone-200 bg-[#F3F0E8] px-6 py-10 md:px-12'>
      <div className='mx-auto grid max-w-[1200px] grid-cols-1 gap-8 text-sm text-[#4A4A4A] md:grid-cols-3'>
        <div className='flex items-start gap-4'><CreditCard className='mt-1 h-5 w-5 text-[#9A8A5A]' /><div><p className='mb-1 font-medium text-[#1A1A1A]'>Secure reservation deposit</p><p>Pay the deposit online before the team verifies final confirmation.</p></div></div>
        <div className='flex items-start gap-4'><CheckCircle2 className='mt-1 h-5 w-5 text-[#9A8A5A]' /><div><p className='mb-1 font-medium text-[#1A1A1A]'>Concierge verified</p><p>PLP confirms availability and stay details after payment verification.</p></div></div>
        <div className='flex items-start gap-4'><LockKeyhole className='mt-1 h-5 w-5 text-[#9A8A5A]' /><div><p className='mb-1 font-medium text-[#1A1A1A]'>Powered by Xendit</p><p>GCash, Maya, cards, bank transfer, and QR options can be enabled.</p></div></div>
      </div>
    </section>
  );
}

function EditorialSection({ label, title, text, imagePlaceholder, imageSrc, imageAlt, align = 'right' }) {
  const content = (
    <div className='flex max-w-xl flex-col justify-center'>
      <p className='mb-6 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>{label}</p>
      <h2 className='mb-8 font-serif text-3xl leading-tight text-[#1A1A1A] md:text-5xl'>{title}</h2>
      <p className='whitespace-pre-line text-sm leading-relaxed text-[#4A4A4A] md:text-base'>{text}</p>
    </div>
  );
  const image = <ImageBlock label={imagePlaceholder} src={imageSrc} alt={imageAlt} />;
  return (
    <div className='mx-auto max-w-[1400px] px-6 py-24 md:px-12'>
      <div className='grid grid-cols-1 items-center gap-16 md:gap-24 lg:grid-cols-2'>
        {align === 'left' ? <><div className='order-2 lg:order-1'>{content}</div><div className='order-1 lg:order-2'>{image}</div></> : <><div className='order-1'>{image}</div><div className='order-2'>{content}</div></>}
      </div>
    </div>
  );
}

function HomeView({ navigate }) {
  return (
    <div className='min-h-screen bg-[#FAFAF7]'>
      <section className='relative flex h-screen w-full items-center justify-center overflow-hidden bg-stone-900'>
        <div className='absolute inset-0 bg-[#050505]' />
        <div className='absolute inset-0 flex items-center justify-center font-serif text-xs uppercase tracking-[0.5em] text-stone-700'>[ Cinematic Aerial of Hillside Villas ]</div>
        <div className='relative z-10 mt-20 flex flex-col items-center px-6 text-center'>
          <p className='mb-6 text-[10px] uppercase tracking-[0.3em] text-white/80'>Boracay, Philippines</p>
          <h1 className='mb-8 font-serif text-5xl tracking-wide text-white md:text-7xl'>Pueblo La Perla</h1>
          <p className='mb-12 max-w-lg text-sm font-light leading-relaxed text-white/90 md:text-base'>A private hillside retreat above Boracay’s white sands, where villa living, wellness, and island experiences unfold in quiet seclusion.</p>
          <div className='flex flex-col items-center gap-5 text-[11px] font-medium uppercase tracking-[0.2em] sm:flex-row sm:space-x-8'>
            <button onClick={() => navigate('accommodations')} className='text-white hover:text-white/70'>Explore the resort</button>
            <div className='hidden h-1 w-1 rounded-full bg-white/30 sm:block' />
            <button onClick={() => navigate('booking')} className='border border-white px-7 py-4 text-white transition hover:bg-white hover:text-[#1A1A1A]'>Reserve your stay</button>
          </div>
        </div>
      </section>
      <section className='mx-auto max-w-3xl px-6 py-32 text-center'>
        <p className='font-serif text-2xl leading-relaxed text-[#1A1A1A] md:text-4xl'>Elevated above the island&apos;s vibrant center, Pueblo La Perla is a sanctuary of grand villas and suites. High Boracay living, just minutes from Station 2.</p>
      </section>
      <TrustStrip />
      <VideoSection />
      <EditorialSection label='Accommodation' title='Private pool villas, elevated suites, and quiet spaces.' text='Five grand villas stand as the centerpiece of the retreat, offering four spacious bedrooms, private living areas, fully equipped kitchens, and sweeping beach views. For shorter stays, our suites and smart rooms provide intelligent comfort and profound quiet.' imagePlaceholder='[ Villa Interior View ]' imageSrc={IMAGES.homeAccommodation} imageAlt='Pueblo La Perla white villas surrounded by Boracay hillside greenery' />
      <SectionDivider />
      <EditorialSection label='Experiences' title='Curated island moments, from water to wellness.' text='The surrounding waters offer a canvas for exploration. Engage in island hopping, paraw sailing, or scuba diving. Inside the retreat, private dining and wellness rituals can be arranged around your stay.' imagePlaceholder='[ Curated Island Experience ]' align='left' />
    </div>
  );
}

function AccommodationsView({ navigate }) {
  return (
    <div className='min-h-screen bg-[#FAFAF7] pb-24 pt-32'>
      <div className='mx-auto max-w-[1400px] px-6 md:px-12'>
        <div className='mb-24 max-w-3xl'>
          <h1 className='mb-6 font-serif text-5xl md:text-6xl'>Accommodation</h1>
          <p className='text-lg leading-relaxed text-[#4A4A4A]'>Spacious, private, and deeply connected to the island landscape. From grand multi-bedroom villas to intelligent premium rooms.</p>
        </div>
        <div className='space-y-32'>
          {ACCOMMODATIONS.map((acc, index) => {
            const deposit = Math.round(acc.rate * DEPOSIT_RATE);
            return (
              <div key={acc.id} className={`flex flex-col gap-12 lg:gap-24 ${index % 2 !== 0 ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
                <div className='w-full lg:w-3/5'><ImageBlock label={`[ ${acc.name} Image ]`} ratio='aspect-[16/10]' src={acc.imageSrc} alt={acc.imageAlt || `${acc.name} at Pueblo La Perla Boracay`} /></div>
                <div className='flex w-full flex-col justify-center lg:w-2/5'>
                  <p className='mb-4 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>{acc.imageTag}</p>
                  <h2 className='mb-6 font-serif text-3xl md:text-4xl'>{acc.name}</h2>
                  <p className='mb-8 leading-relaxed text-[#4A4A4A]'>{acc.description}</p>
                  <div className='mb-8 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-stone-200 pt-6 text-sm text-[#4A4A4A]'>
                    <div className='flex items-center'><Users className='mr-3 h-4 w-4 text-stone-400' /> Up to {acc.capacity} Guests</div>
                    <div className='flex items-center'><MapPin className='mr-3 h-4 w-4 text-stone-400' /> {acc.bedrooms} Bedrooms</div>
                    <div className='col-span-2 text-[#1A1A1A]'>From {formatMoney(acc.rate)} / night · reservation deposit from {formatMoney(deposit)}</div>
                  </div>
                  <div className='mb-10 flex flex-wrap gap-2'>{acc.features.map((feature) => <span key={feature} className='bg-stone-100 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em]'>{feature}</span>)}</div>
                  <button onClick={() => navigate('booking')} className='self-start border-b border-[#1A1A1A] pb-1 text-[11px] uppercase tracking-[0.2em] hover:border-[#9A8A5A] hover:text-[#9A8A5A]'>Reserve with deposit</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExperiencesView() {
  return (
    <div className='min-h-screen bg-[#FAFAF7] pb-24 pt-32'>
      <div className='mx-auto max-w-[1400px] px-6 md:px-12'>
        <div className='mb-24 max-w-3xl'>
          <p className='mb-6 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>Experiences</p>
          <h1 className='mb-6 font-serif text-5xl md:text-6xl'>Days shaped by island rhythm.</h1>
          <p className='text-lg leading-relaxed text-[#4A4A4A]'>From water adventures to wellness rituals and private dining, each stay can be quietly arranged around the guest.</p>
        </div>
        <div className='space-y-32'>{EXPERIENCE_GROUPS.map(([label, title, text, image], index) => <EditorialSection key={label} label={label} title={title} text={text} imagePlaceholder={image} align={index % 2 === 0 ? 'right' : 'left'} />)}</div>
      </div>
    </div>
  );
}

function GettingHereView() {
  return (
    <div className='min-h-screen bg-[#FAFAF7] pb-24 pt-32'>
      <div className='mx-auto max-w-[1200px] px-6 md:px-12'>
        <p className='mb-6 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>Getting Here</p>
        <h1 className='mb-10 font-serif text-5xl md:text-6xl'>Arrival, quietly arranged.</h1>
        <p className='mb-20 max-w-3xl text-lg leading-relaxed text-[#4A4A4A]'>Guests may arrive through Caticlan or Kalibo. Our team can coordinate port pickup, transfers, and private arrival assistance to Pueblo La Perla in High Boracay.</p>
        <div className='grid grid-cols-1 gap-10 border-t border-stone-200 pt-12 md:grid-cols-3'>
          <div><Plane className='mb-6 h-5 w-5 text-[#9A8A5A]' /><h3 className='mb-4 font-serif text-2xl'>By Air</h3><p className='text-sm leading-relaxed text-[#4A4A4A]'>Fly into Caticlan for the shortest transfer, or Kalibo for wider flight options.</p></div>
          <div><Anchor className='mb-6 h-5 w-5 text-[#9A8A5A]' /><h3 className='mb-4 font-serif text-2xl'>By Port</h3><p className='text-sm leading-relaxed text-[#4A4A4A]'>Our team can assist with port coordination and arrival timing.</p></div>
          <div><MapPin className='mb-6 h-5 w-5 text-[#9A8A5A]' /><h3 className='mb-4 font-serif text-2xl'>To the Retreat</h3><p className='text-sm leading-relaxed text-[#4A4A4A]'>Pueblo La Perla is located in High Boracay, minutes from Station 2.</p></div>
        </div>
      </div>
    </div>
  );
}

function BookingRequestView({ onCreateBooking }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', accommodation: 'Grand Ocean Villa', checkIn: '', checkOut: '', guests: 2, message: '' });
  const [status, setStatus] = useState({ tone: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selected = ACCOMMODATIONS.find((item) => item.name === form.accommodation) || ACCOMMODATIONS[0];
  const nights = countNights(form.checkIn, form.checkOut);
  const amount = nights * selected.rate;
  const deposit = Math.round(amount * DEPOSIT_RATE);
  const balance = Math.max(amount - deposit, 0);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (nights < 1) {
      setStatus({ tone: 'error', message: 'Check-out date must be after check-in date.' });
      return;
    }
    setIsSubmitting(true);
    setStatus({ tone: 'neutral', message: 'Creating reservation and preparing secure Xendit checkout...' });
    let bookingPayload = null;
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Booking API failed');
      bookingPayload = result.booking;
      onCreateBooking(bookingPayload);

      const checkoutResponse = await fetch('/api/xendit/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking: bookingPayload }),
      });
      const checkout = await checkoutResponse.json().catch(() => null);
      if (!checkoutResponse.ok || !checkout?.checkoutUrl) {
        throw new Error(checkout?.error || 'Xendit checkout is not configured yet.');
      }
      window.localStorage.setItem('plp_pending_payment', JSON.stringify({ booking: bookingPayload, checkout, savedAt: new Date().toISOString() }));
      window.location.href = checkout.checkoutUrl;
    } catch (error) {
      if (!bookingPayload) {
        bookingPayload = { reference: `PLP-${String(Date.now()).slice(-8)}`, name: form.name, email: form.email, phone: form.phone, accommodation: form.accommodation, checkIn: form.checkIn, checkOut: form.checkOut, guests: Number(form.guests), nights, amount, deposit, balance, paymentDue: deposit, status: 'Pending Deposit Checkout' };
        onCreateBooking(bookingPayload);
      }
      setStatus({ tone: 'error', message: `${bookingPayload.reference} was created, but checkout could not start: ${error.message}` });
      setIsSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen bg-[#FAFAF7] pb-24 pt-32'>
      <div className='mx-auto grid max-w-[1200px] grid-cols-1 gap-20 px-6 md:px-12 lg:grid-cols-[0.9fr_1.1fr]'>
        <div>
          <p className='mb-6 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>Secure Reservation</p>
          <h1 className='mb-8 font-serif text-5xl md:text-6xl'>Reserve your stay.</h1>
          <p className='mb-10 leading-relaxed text-[#4A4A4A]'>Choose your dates, review the stay estimate, then secure the reservation with a deposit through Xendit. The resort team verifies payment and confirms availability before the stay is finalized.</p>
          <div className='border-l border-[#9A8A5A] pl-6 text-sm leading-relaxed text-[#4A4A4A]'>Deposit-first keeps the experience clean: your booking reference is created first, payment is attached to that reference, and PLP concierge confirms the stay after verification.</div>
          <div className='mt-12 border-t border-stone-200 pt-8 text-sm text-[#4A4A4A]'>
            <p className='mb-4 font-medium text-[#1A1A1A]'>Checkout Review</p>
            <div className='space-y-2'>
              <p>{selected.name}</p>
              <p>{nights > 0 ? `${nights} night${nights > 1 ? 's' : ''} × ${formatMoney(selected.rate)} = ${formatMoney(amount)}` : 'Select dates to calculate estimated total.'}</p>
              {nights > 0 && <><p>Reservation deposit due now: <span className='text-[#1A1A1A]'>{formatMoney(deposit)}</span></p><p>Estimated balance after deposit: {formatMoney(balance)}</p></>}
            </div>
            <div className='mt-8 grid grid-cols-1 gap-3 text-xs text-stone-500'>
              <p>Secure payment powered by Xendit.</p>
              <p>GCash, Maya, cards, bank transfer, and QR options depend on active Xendit channels.</p>
              <p>Final reservation confirmation follows payment and availability verification.</p>
            </div>
          </div>
        </div>
        <form onSubmit={submit} className='space-y-6'>
          <select value={form.accommodation} onChange={(event) => update('accommodation', event.target.value)} className='w-full border-b border-stone-300 bg-transparent py-4 text-[#4A4A4A] outline-none focus:border-[#9A8A5A]'>
            {ACCOMMODATIONS.map((item) => <option key={item.name}>{item.name}</option>)}
          </select>
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <label className='text-[10px] uppercase tracking-[0.2em] text-stone-500'>Check-in<input type='date' value={form.checkIn} onChange={(event) => update('checkIn', event.target.value)} className='mt-2 w-full border-b border-stone-300 bg-transparent py-4 text-base normal-case tracking-normal text-[#1A1A1A] outline-none focus:border-[#9A8A5A]' required /></label>
            <label className='text-[10px] uppercase tracking-[0.2em] text-stone-500'>Check-out<input type='date' value={form.checkOut} onChange={(event) => update('checkOut', event.target.value)} className='mt-2 w-full border-b border-stone-300 bg-transparent py-4 text-base normal-case tracking-normal text-[#1A1A1A] outline-none focus:border-[#9A8A5A]' required /></label>
          </div>
          <input type='number' min='1' max={selected.capacity} placeholder='Number of guests' value={form.guests} onChange={(event) => update('guests', event.target.value)} className='w-full border-b border-stone-300 bg-transparent py-4 outline-none focus:border-[#9A8A5A]' required />
          <input placeholder='Full name' value={form.name} onChange={(event) => update('name', event.target.value)} className='w-full border-b border-stone-300 bg-transparent py-4 outline-none focus:border-[#9A8A5A]' required />
          <input type='email' placeholder='Email for confirmation' value={form.email} onChange={(event) => update('email', event.target.value)} className='w-full border-b border-stone-300 bg-transparent py-4 outline-none focus:border-[#9A8A5A]' required />
          <input placeholder='Phone / WhatsApp' value={form.phone} onChange={(event) => update('phone', event.target.value)} className='w-full border-b border-stone-300 bg-transparent py-4 outline-none focus:border-[#9A8A5A]' required />
          <textarea placeholder='Arrival notes, special requests, or VIP package interest' rows={5} value={form.message} onChange={(event) => update('message', event.target.value)} className='w-full resize-none border-b border-stone-300 bg-transparent py-4 outline-none focus:border-[#9A8A5A]' />
          <div className='border border-stone-200 bg-white/60 p-6 text-sm text-[#4A4A4A]'>
            <p className='mb-2 font-medium text-[#1A1A1A]'>Reservation Summary</p>
            <div className='space-y-1'>
              <p>Total stay: {nights > 0 ? formatMoney(amount) : 'Select dates'}</p>
              <p>Deposit due now: {nights > 0 ? formatMoney(deposit) : '—'}</p>
              <p>Balance after deposit: {nights > 0 ? formatMoney(balance) : '—'}</p>
            </div>
          </div>
          <button type='submit' disabled={isSubmitting} className='w-full border border-[#1A1A1A] px-8 py-4 text-[11px] uppercase tracking-[0.2em] transition hover:bg-[#1A1A1A] hover:text-white disabled:cursor-not-allowed disabled:opacity-60'>
            {isSubmitting ? 'Preparing Checkout...' : 'Pay Reservation Deposit'}
          </button>
          {status.message && <p className={`text-sm ${status.tone === 'error' ? 'text-red-700' : status.tone === 'success' ? 'text-emerald-700' : 'text-[#4A4A4A]'}`}>{status.message}</p>}
        </form>
      </div>
    </div>
  );
}

function PaymentSuccessView({ navigate }) {
  const [stored, setStored] = useState(null);
  useEffect(() => {
    const raw = window.localStorage.getItem('plp_pending_payment');
    if (raw) {
      try { setStored(JSON.parse(raw)); } catch {}
    }
  }, []);
  const reference = stored?.booking?.reference || new URLSearchParams(window.location.search).get('bookingId') || 'Pending reference';
  return (
    <div className='min-h-screen bg-[#FAFAF7] px-6 pb-24 pt-40 md:px-12'>
      <div className='mx-auto max-w-3xl text-center'>
        <CheckCircle2 className='mx-auto mb-8 h-10 w-10 text-[#9A8A5A]' />
        <p className='mb-6 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>Payment Return</p>
        <h1 className='mb-8 font-serif text-5xl'>Reservation payment received for verification.</h1>
        <p className='mx-auto mb-10 max-w-2xl leading-relaxed text-[#4A4A4A]'>Thank you. Your payment return has been recorded. Final booking confirmation is issued after Xendit webhook verification and PLP availability review.</p>
        <div className='mx-auto mb-10 max-w-xl border border-stone-200 bg-white/60 p-8 text-left text-sm text-[#4A4A4A]'>
          <p className='mb-2 font-medium text-[#1A1A1A]'>Booking Reference</p>
          <p className='mb-6 font-serif text-2xl text-[#1A1A1A]'>{reference}</p>
          <p>Status: Awaiting payment verification and concierge confirmation.</p>
          {stored?.booking?.deposit && <p>Deposit expected: {formatMoney(stored.booking.deposit)}</p>}
        </div>
        <button onClick={() => navigate('contact')} className='border border-[#1A1A1A] px-8 py-4 text-[11px] uppercase tracking-[0.2em] hover:bg-[#1A1A1A] hover:text-white'>Contact Concierge</button>
      </div>
    </div>
  );
}

function PaymentCancelView({ navigate }) {
  return (
    <div className='min-h-screen bg-[#FAFAF7] px-6 pb-24 pt-40 md:px-12'>
      <div className='mx-auto max-w-3xl text-center'>
        <CreditCard className='mx-auto mb-8 h-10 w-10 text-[#9A8A5A]' />
        <p className='mb-6 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>Payment Not Completed</p>
        <h1 className='mb-8 font-serif text-5xl'>Your reservation is not confirmed yet.</h1>
        <p className='mx-auto mb-10 max-w-2xl leading-relaxed text-[#4A4A4A]'>The checkout was cancelled, expired, or did not complete. You may restart the deposit checkout or ask PLP concierge for assistance.</p>
        <div className='flex flex-col justify-center gap-4 sm:flex-row'>
          <button onClick={() => navigate('booking')} className='border border-[#1A1A1A] px-8 py-4 text-[11px] uppercase tracking-[0.2em] hover:bg-[#1A1A1A] hover:text-white'>Try Again</button>
          <button onClick={() => navigate('contact')} className='border border-stone-300 px-8 py-4 text-[11px] uppercase tracking-[0.2em] hover:border-[#9A8A5A] hover:text-[#9A8A5A]'>Contact PLP</button>
        </div>
      </div>
    </div>
  );
}

function ContactReserveView({ onCreateLead }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', interest: 'Accommodation', preferredDates: '', message: '' });
  const [status, setStatus] = useState('');
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setStatus('Sending your inquiry...');
    let delivered = false;
    try {
      const response = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json().catch(() => null);
      delivered = Boolean(result?.emailDelivered);
    } catch {
      delivered = false;
    }
    onCreateLead({ id: `LD-${String(Date.now()).slice(-5)}`, name: form.name, email: form.email, phone: form.phone, interest: form.interest, source: 'Website', status: 'New Inquiry', value: form.interest === 'VIP Wellness Package' ? 300000 : 0, nextStep: 'Qualify via email/call' });
    setStatus(delivered ? 'Inquiry sent. Our team will contact you shortly.' : 'Inquiry received. Configure Vercel email variables to enable live email delivery.');
    setForm({ name: '', email: '', phone: '', interest: 'Accommodation', preferredDates: '', message: '' });
  };
  return (
    <div className='min-h-screen bg-[#FAFAF7] pb-24 pt-32'>
      <div className='mx-auto grid max-w-[1200px] grid-cols-1 gap-20 px-6 md:px-12 lg:grid-cols-2'>
        <div>
          <p className='mb-6 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>General Inquiry</p>
          <h1 className='mb-8 font-serif text-5xl md:text-6xl'>Begin the conversation.</h1>
          <p className='mb-10 leading-relaxed text-[#4A4A4A]'>For confirmed date requests, use the booking page. For other questions, private events, VIP package questions, or custom arrangements, send an inquiry here.</p>
          <div className='space-y-4 text-sm text-[#4A4A4A]'><p>Email: plpvillas@gmail.com</p><p>Location: High Boracay, minutes from Station 2</p></div>
        </div>
        <form onSubmit={submit} className='space-y-6'>
          <input placeholder='Full name' value={form.name} onChange={(event) => update('name', event.target.value)} className='w-full border-b border-stone-300 bg-transparent py-4 outline-none focus:border-[#9A8A5A]' required />
          <input placeholder='Email' type='email' value={form.email} onChange={(event) => update('email', event.target.value)} className='w-full border-b border-stone-300 bg-transparent py-4 outline-none focus:border-[#9A8A5A]' required />
          <input placeholder='Phone' value={form.phone} onChange={(event) => update('phone', event.target.value)} className='w-full border-b border-stone-300 bg-transparent py-4 outline-none focus:border-[#9A8A5A]' />
          <select value={form.interest} onChange={(event) => update('interest', event.target.value)} className='w-full border-b border-stone-300 bg-transparent py-4 text-[#4A4A4A] outline-none focus:border-[#9A8A5A]'><option>Accommodation</option><option>Grand Ocean Villa</option><option>Sunset Suite</option><option>Smart Room Premium</option><option>VIP Wellness Package</option><option>Private Experience</option></select>
          <input placeholder='Preferred dates' value={form.preferredDates} onChange={(event) => update('preferredDates', event.target.value)} className='w-full border-b border-stone-300 bg-transparent py-4 outline-none focus:border-[#9A8A5A]' />
          <textarea placeholder='Message' rows={5} value={form.message} onChange={(event) => update('message', event.target.value)} className='w-full resize-none border-b border-stone-300 bg-transparent py-4 outline-none focus:border-[#9A8A5A]' />
          <button type='submit' className='border border-[#1A1A1A] px-8 py-4 text-[11px] uppercase tracking-[0.2em] hover:bg-[#1A1A1A] hover:text-white'>Send Inquiry</button>
          {status && <p className='text-sm text-emerald-700'>{status}</p>}
        </form>
      </div>
    </div>
  );
}

function VIPPackageView({ navigate }) {
  return (
    <div className='min-h-screen bg-[#FAFAF7] pb-24 pt-32'>
      <div className='mx-auto max-w-[1400px] px-6 md:px-12'>
        <div className='mb-24 max-w-3xl'>
          <p className='mb-6 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>Exclusive Offer</p>
          <h1 className='mb-6 font-serif text-5xl md:text-6xl'>VIP Wellness Package</h1>
          <p className='text-lg leading-relaxed text-[#4A4A4A]'>An invitation to secure your place on the island. A long-term commitment to rest, privacy, and preferred access.</p>
        </div>
        <div className='grid grid-cols-1 gap-24 lg:grid-cols-2'>
          <ImageBlock label='[ Abstract image conveying longevity, rest, and luxury ]' />
          <div className='flex flex-col justify-center'>
            <h2 className='mb-8 font-serif text-3xl'>The Terms of Retreat</h2>
            <p className='mb-12 leading-relaxed text-[#4A4A4A]'>For a one-time consideration of ₱300,000, members are granted four nights annually across any Pueblo La Perla property for a duration of five years.</p>
            <div className='mb-12 space-y-8 border-t border-stone-200 pt-8'>
              {[
                ['I.', 'Entitlement', '20 total nights over 5 years. Valued at a preferred rate of ₱15,000 per night for grand villa stays.'],
                ['II.', 'Transferability', 'Nights may be gifted to family or associates, subject to arrangement with our concierge.'],
                ['III.', 'Transparency', 'Usage is tracked via a strict digital ledger in your private portal, ensuring seamless booking.'],
              ].map(([roman, title, body]) => <div key={roman} className='flex items-start'><span className='mr-6 font-serif text-lg text-[#9A8A5A]'>{roman}</span><div><h3 className='mb-1 font-medium'>{title}</h3><p className='text-sm text-[#4A4A4A]'>{body}</p></div></div>)}
            </div>
            <button onClick={() => navigate('booking')} className='self-start border border-[#1A1A1A] px-8 py-4 text-[11px] uppercase tracking-[0.2em] hover:bg-[#1A1A1A] hover:text-white'>Request Booking</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuestLoginView({ navigate }) {
  const [email, setEmail] = useState('');
  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-[#FAFAF7] p-6'>
      <div className='w-full max-w-md'>
        <div className='mb-10 text-center'><h2 className='font-serif text-2xl tracking-[0.15em]'>PUEBLO LA PERLA</h2><p className='mt-2 text-[10px] uppercase tracking-[0.3em] text-[#9A8A5A]'>Guest Portal</p></div>
        <form onSubmit={(event) => { event.preventDefault(); navigate('guest-portal'); }} className='space-y-6'>
          <input type='email' placeholder='Email address' value={email} onChange={(event) => setEmail(event.target.value)} className='w-full border-b border-stone-300 bg-transparent py-3 text-sm outline-none focus:border-[#1A1A1A]' required />
          <button type='submit' className='w-full bg-[#1A1A1A] py-4 text-[11px] uppercase tracking-[0.2em] text-white'>Access Portal</button>
        </form>
        <button onClick={() => navigate('home')} className='mt-6 w-full text-center text-xs text-stone-500 hover:text-[#1A1A1A]'>Return to public site</button>
      </div>
    </div>
  );
}

function GuestPortalView({ navigate }) {
  const member = INITIAL_VIP_MEMBERS[0];
  return (
    <div className='flex min-h-screen flex-col items-center bg-stone-100 px-6 pb-24 pt-24'>
      <div className='mb-12 flex w-full max-w-4xl items-end justify-between border-b border-stone-300 pb-6'><div><p className='mb-2 text-[10px] uppercase tracking-[0.2em] text-[#9A8A5A]'>Welcome Back</p><h1 className='font-serif text-3xl'>{member.name}</h1></div><button onClick={() => navigate('home')} className='text-xs text-stone-500'>Logout</button></div>
      <div className='mb-8 grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-3'><div className='border border-stone-200 bg-white p-8'><p className='mb-2 text-xs uppercase tracking-wider text-stone-500'>Entitlement</p><p className='font-serif text-3xl'>{member.remainingNights} <span className='text-base text-stone-400'>/ {member.totalEntitlement}</span></p><p className='mt-4 text-xs text-stone-400'>Valid until {member.validUntil}</p></div><div className='flex flex-col justify-center border border-stone-200 bg-white p-8 md:col-span-2'><p className='mb-4 text-sm text-[#4A4A4A]'>To redeem nights or arrange concierge services, please contact our team directly.</p><button onClick={() => navigate('booking')} className='self-start bg-[#1A1A1A] px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-white'>Request Booking</button></div></div>
      <div className='w-full max-w-4xl border border-stone-200 bg-white'><div className='border-b border-stone-200 p-6'><h3 className='font-medium'>Digital Ledger</h3></div><div className='space-y-6 p-6'>{INITIAL_VIP_LEDGER.map((item) => <div key={item.id} className='flex items-start justify-between border-b border-stone-100 pb-4 last:border-0'><div><p className='mb-1 font-medium'>{item.label}</p><p className='text-xs text-stone-500'>{item.date}</p></div><div className={`font-serif text-lg ${item.type === 'credit' ? 'text-emerald-600' : 'text-amber-600'}`}>{item.type === 'credit' ? '+' : '-'}{item.nights}</div></div>)}</div></div>
    </div>
  );
}

function AdminLoginView({ navigate, onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-slate-900 p-6'>
      <div className='w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-8 text-white shadow-2xl'>
        <div className='mb-8 text-center'><LockKeyhole className='mx-auto mb-4 h-7 w-7 text-emerald-400' /><h1 className='font-mono text-2xl tracking-wider'>RESORT OS</h1><p className='mt-2 text-xs uppercase tracking-widest text-slate-500'>Admin Control</p></div>
        <form onSubmit={(event) => { event.preventDefault(); if (password === 'plp') { onLogin(); navigate('admin-dashboard'); } else setError('Demo password: plp'); }} className='space-y-4'>
          <input type='password' placeholder='Admin password' value={password} onChange={(event) => setPassword(event.target.value)} className='w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-emerald-500' />
          <button type='submit' className='w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold uppercase tracking-widest text-white hover:bg-emerald-500'>Unlock</button>
          {error && <p className='text-center text-xs text-amber-300'>{error}</p>}
        </form>
        <button onClick={() => navigate('home')} className='mt-6 w-full text-center text-xs text-slate-500 hover:text-white'>Return to public site</button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  const color = tone === 'emerald' ? 'text-emerald-500' : tone === 'amber' ? 'text-amber-500' : 'text-blue-500';
  return <div className='flex items-start justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm'><div><p className='text-sm font-medium text-slate-500'>{label}</p><p className='mt-1 text-2xl font-bold text-slate-900'>{value}</p></div><Icon className={`h-6 w-6 ${color}`} /></div>;
}

function AdminTable({ title, headers, rows }) {
  return (
    <div className='overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'>
      <div className='border-b border-slate-200 bg-slate-50 p-4'><h3 className='font-bold text-slate-900'>{title}</h3></div>
      <div className='overflow-x-auto'><table className='w-full min-w-[760px] text-left text-sm'><thead className='border-b border-slate-200 bg-slate-50 text-slate-500'><tr>{headers.map((header) => <th key={header} className='p-4 font-semibold'>{header}</th>)}</tr></thead><tbody className='divide-y divide-slate-100'>{rows.map((row, index) => <tr key={index} className='hover:bg-slate-50'>{row.map((cell, cellIndex) => <td key={cellIndex} className={`p-4 ${cellIndex === 0 ? 'font-medium text-slate-900' : 'text-slate-700'}`}>{cell}</td>)}</tr>)}</tbody></table></div>
    </div>
  );
}

function AdminOSView({ bookings, leads, navigate }) {
  const [adminTab, setAdminTab] = useState('overview');
  const tabs = [['overview', 'Overview', LayoutDashboard], ['bookings', 'Bookings', Calendar], ['payments', 'Payments', CreditCard], ['vip', 'VIP Ledger', Star], ['crm', 'Leads CRM', Users]];
  const pending = bookings.filter((item) => !['Confirmed', 'Fully Paid'].includes(item.status));
  return (
    <div className='flex min-h-screen bg-slate-50'>
      <aside className='hidden w-64 flex-col bg-slate-900 text-slate-300 md:flex'><div className='flex items-center justify-between border-b border-slate-800 p-6'><div><p className='font-mono text-xl tracking-wider text-white'>RESORT OS</p><p className='mt-1 text-[10px] uppercase tracking-widest text-emerald-500'>Admin Control</p></div><button onClick={() => navigate('home')} className='text-slate-500 hover:text-white'><X className='h-4 w-4' /></button></div><nav className='flex-1 space-y-1 p-4 text-sm font-medium'>{tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setAdminTab(id)} className={`flex w-full items-center rounded p-3 ${adminTab === id ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800'}`}><Icon className='mr-3 h-4 w-4' />{label}</button>)}</nav></aside>
      <main className='h-screen flex-1 overflow-y-auto p-6 md:p-8'>
        <div className='mb-8 border-b border-slate-200 pb-4'><h1 className='text-2xl font-bold capitalize text-slate-900'>{adminTab}</h1><p className='mt-1 text-sm text-slate-500'>Demo dashboard. Production requires real auth, database-backed records, webhook storage, and audit logs.</p></div>
        {adminTab === 'overview' && <div className='grid grid-cols-1 gap-6 md:grid-cols-3'><StatCard label='System Status' value='Payment Ready' icon={CheckCircle2} tone='emerald' /><StatCard label='Pending Deposits' value={`${pending.length} Action`} icon={CreditCard} tone='amber' /><StatCard label='Open Leads' value={`${leads.length} Active`} icon={ClipboardList} tone='blue' /></div>}
        {adminTab === 'bookings' && <AdminTable title='Active Bookings' headers={['Ref', 'Guest', 'Unit', 'Dates', 'Status', 'Amount']} rows={bookings.map((b) => [b.reference || b.id, b.guest || b.name, b.unit || b.accommodation, `${b.checkIn} → ${b.checkOut}`, b.status || b.paymentStatus, formatMoney(b.amount)])} />}
        {adminTab === 'payments' && <AdminTable title='Payment Reconciliation' headers={['Ref', 'Expected Deposit', 'Balance', 'Payment Status', 'Method', 'Action']} rows={bookings.map((b) => [b.reference || b.id, formatMoney(b.deposit || b.paymentDue || 0), formatMoney(b.balance || Math.max((b.amount || 0) - (b.deposit || b.paymentDue || 0), 0)), b.paymentStatus || 'Awaiting Xendit', b.method || 'Xendit Checkout', b.status === 'Confirmed' ? 'Monitor balance' : 'Verify webhook'])} />}
        {adminTab === 'vip' && <AdminTable title='Strict Liability Ledger' headers={['Member', 'Contract Value', 'Entitlement', 'Used', 'Remaining']} rows={INITIAL_VIP_MEMBERS.map((m) => [m.name, formatMoney(m.contractValue), m.totalEntitlement, m.usedNights, m.remainingNights])} />}
        {adminTab === 'crm' && <AdminTable title='Sales Pipeline' headers={['Lead Name', 'Email', 'Interest', 'Value', 'Status', 'Next Step']} rows={leads.map((l) => [l.name, l.email || '-', l.interest, l.value > 0 ? formatMoney(l.value) : '-', l.status, l.nextStep])} />}
      </main>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState(getInitialView);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [bookings, setBookings] = useState(INITIAL_BOOKINGS);
  const [leads, setLeads] = useState(INITIAL_LEADS);

  useEffect(() => {
    for (const [key, setter] of [['plp_leads', setLeads], ['plp_bookings', setBookings]]) {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setter((existing) => [...parsed, ...existing]);
        } catch {}
      }
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 50);
    const onPop = () => setCurrentView(getInitialView());
    window.addEventListener('scroll', onScroll);
    window.addEventListener('popstate', onPop);
    setShowDevTools(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('popstate', onPop); };
  }, []);

  const navigate = (view, replace = false) => {
    const path = ROUTES[view] || '/';
    setCurrentView(view);
    setIsMobileMenuOpen(false);
    if (window.location.pathname !== path) window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const [title, description] = PAGE_META[currentView] || PAGE_META.home;
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${SITE_URL}${ROUTES[currentView] || '/'}`);
    if (currentView === 'admin-dashboard' && !adminUnlocked) navigate('admin-login', true);
  }, [currentView, adminUnlocked]);

  const handleCreateLead = (newLead) => setLeads((prev) => {
    const next = [newLead, ...prev];
    window.localStorage.setItem('plp_leads', JSON.stringify(next.filter((lead) => lead.source === 'Website').slice(0, 50)));
    return next;
  });

  const handleCreateBooking = (newBooking) => {
    const bookingRow = {
      id: newBooking.reference,
      reference: newBooking.reference,
      guest: newBooking.name,
      email: newBooking.email,
      phone: newBooking.phone,
      unit: newBooking.accommodation,
      checkIn: newBooking.checkIn,
      checkOut: newBooking.checkOut,
      guests: newBooking.guests,
      nights: newBooking.nights,
      status: newBooking.status || 'Pending Deposit',
      paymentStatus: newBooking.paymentStatus || 'Awaiting Xendit Checkout',
      amount: newBooking.amount,
      deposit: newBooking.deposit || newBooking.paymentDue,
      balance: newBooking.balance || Math.max((newBooking.amount || 0) - (newBooking.deposit || newBooking.paymentDue || 0), 0),
      source: 'Website Booking',
    };
    setBookings((prev) => {
      const next = [bookingRow, ...prev];
      window.localStorage.setItem('plp_bookings', JSON.stringify(next.filter((booking) => booking.source === 'Website Booking').slice(0, 50)));
      return next;
    });
  };

  const isPublicView = !['guest-login', 'guest-portal', 'admin-login', 'admin-dashboard'].includes(currentView);

  const activeView = useMemo(() => {
    if (currentView === 'home') return <HomeView navigate={navigate} />;
    if (currentView === 'accommodations') return <AccommodationsView navigate={navigate} />;
    if (currentView === 'experiences') return <ExperiencesView />;
    if (currentView === 'getting-here') return <GettingHereView />;
    if (currentView === 'vip-package') return <VIPPackageView navigate={navigate} />;
    if (currentView === 'booking') return <BookingRequestView onCreateBooking={handleCreateBooking} />;
    if (currentView === 'payment-success') return <PaymentSuccessView navigate={navigate} />;
    if (currentView === 'payment-cancel') return <PaymentCancelView navigate={navigate} />;
    if (currentView === 'contact') return <ContactReserveView onCreateLead={handleCreateLead} />;
    if (currentView === 'guest-login') return <GuestLoginView navigate={navigate} />;
    if (currentView === 'guest-portal') return <GuestPortalView navigate={navigate} />;
    if (currentView === 'admin-login') return <AdminLoginView navigate={navigate} onLogin={() => setAdminUnlocked(true)} />;
    if (currentView === 'admin-dashboard') return <AdminOSView bookings={bookings} leads={leads} navigate={navigate} />;
    return <HomeView navigate={navigate} />;
  }, [currentView, bookings, leads, adminUnlocked]);

  return (
    <div className='min-h-screen bg-[#FAFAF7] font-sans text-[#1A1A1A] antialiased'>
      {isPublicView && <PublicNavbar view={currentView} navigate={navigate} isScrolled={isScrolled} isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />}
      <main>{activeView}</main>
      {isPublicView && <PublicFooter navigate={navigate} />}
      {isPublicView && <MobileActionBar navigate={navigate} />}
      {showDevTools && <div className='fixed bottom-0 right-0 z-[100] flex flex-col gap-1 p-2 opacity-10 transition-opacity hover:opacity-100'><button onClick={() => navigate('admin-login')} className='bg-emerald-800 px-2 py-1 text-[8px] uppercase tracking-widest text-white'>Admin OS</button><button onClick={() => navigate('home')} className='bg-black px-2 py-1 text-[8px] uppercase tracking-widest text-white'>Public Site</button></div>}
    </div>
  );
}
