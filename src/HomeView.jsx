import React from 'react';
import { ArrowRight } from 'lucide-react';
import StayFinder from './StayFinder.jsx';
import VideoSection from './VideoSection.jsx';

const experiences = [
  { title: 'Time on the water', slug: 'water', image: 'plp-day-balcony-sea-view.webp', alt: 'The sea seen from a hillside balcony' },
  { title: 'Wellness', slug: 'wellness', image: 'plp-wellness-bath-ritual.webp', alt: 'A bath prepared at Pueblo La Perla' },
  { title: 'Private dining', slug: 'private-dining', image: 'plp-private-breakfast-pool.webp', alt: 'Breakfast set beside the villa pool' },
];

export default function HomeView({ rooms }) {
  return <main id="main-content" className="bg-[#FAFAF7]">
    <section data-plp-hero="true" className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-stone-900 py-28 text-white">
      <div data-plp-hero-bg="true" className="absolute inset-0" />
      <div className="relative z-10 px-6 text-center">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.25em]">Boracay, Philippines</p>
        <h1 data-content-key="homepage.heroTitle" className="mb-6 font-serif text-6xl leading-none md:text-8xl">Pueblo La Perla</h1>
        <p data-content-key="homepage.heroSubtitle" className="mx-auto mb-9 max-w-lg text-base leading-7 md:text-lg">A private hillside retreat above Boracay’s white sands.</p>
        <div className="flex flex-wrap items-center justify-center gap-5">
          <a data-content-key="homepage.primaryCta" className="journey-primary journey-primary-light" href="/booking">Check availability</a>
          <a className="journey-link text-white" href="#find-your-stay">Explore the stays <ArrowRight size={16} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
    <StayFinder rooms={rooms} />
    <section className="bg-[#eeebe2]" aria-labelledby="home-club-title"><div className="journey-wrap club-invitation">
      <img src="/images/plp-pool-ocean-view.webp" alt="The pool terrace overlooking the coast at Pueblo La Perla" width="760" height="540" loading="lazy" />
      <div><p className="journey-kicker">PLP Club · Boracay</p><h2 id="home-club-title">The Boracay senior club</h2>
        <p className="my-5 max-w-md text-base leading-7">A community taking shape for adults aged 60 and above. Explore the proposed activities or speak with the team about joining.</p>
        <a href="/club" className="journey-link">Explore the club <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
    </div></section>
    <section className="journey-wrap" aria-labelledby="home-experiences-title">
      <div className="journey-heading"><div><p className="journey-kicker">Experiences</p><h2 id="home-experiences-title">Days on the island</h2></div>
        <a href="/experiences" className="journey-link">All experiences <ArrowRight size={16} aria-hidden="true" /></a></div>
      <div className="stay-options mt-8">{experiences.map(item => <a key={item.slug} href={'/experiences#' + item.slug} className="experience-link">
        <img src={'/images/' + item.image} alt={item.alt} width="640" height="440" loading="lazy" decoding="async" />
        <span>{item.title}<ArrowRight size={18} aria-hidden="true" /></span>
      </a>)}</div>
    </section>
    <VideoSection />
    <section className="bg-[#242721] text-white"><div className="journey-wrap journey-heading">
      <div><h2>Plan your arrival</h2><p className="mt-4 max-w-lg leading-7">Find your way from Caticlan or Kalibo to the hillside, or ask concierge about meeting your group.</p></div>
      <div className="flex flex-wrap gap-6"><a className="journey-link" href="/getting-here">Getting here</a><a className="journey-link" href="/contact?topic=arrival">Ask concierge <ArrowRight size={16} aria-hidden="true" /></a></div>
    </div></section>
  </main>;
}
