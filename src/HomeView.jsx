import React from 'react';
import { ArrowDownRight, ArrowRight } from 'lucide-react';
import StayFinder from './StayFinder.jsx';
import VideoSection from './VideoSection.jsx';

const experiences = [
  { title: 'Time on the water', slug: 'water', image: 'plp-day-balcony-sea-view.webp', alt: 'The sea seen from a hillside balcony', description: 'The island, at your pace' },
  { title: 'Wellness', slug: 'wellness', image: 'plp-wellness-bath-ritual.webp', alt: 'A bath prepared at Pueblo La Perla', description: 'Room to restore' },
  { title: 'Private dining', slug: 'private-dining', image: 'plp-private-breakfast-pool.webp', alt: 'Breakfast set beside the villa pool', description: 'Thoughtful moments together' },
];

export default function HomeView({ rooms }) {
  return <main id="main-content" className="bg-[#FAFAF7]">
    <section data-plp-hero="true" className="plp-home-hero relative isolate flex min-h-[100svh] items-end overflow-hidden bg-stone-900 text-white">
      <div data-plp-hero-bg="true" className="absolute inset-0 -z-20" />
      <div className="plp-home-hero__shade absolute inset-0 -z-10" aria-hidden="true" />
      <div className="plp-home-hero__content relative z-10 mx-auto w-full max-w-[1400px] px-6 pb-28 pt-44 md:px-12 md:pb-32">
        <p className="plp-home-hero__eyebrow">Boracay, Philippines <span aria-hidden="true">—</span> Private hillside retreat</p>
        <h1 data-content-key="homepage.heroTitle" className="plp-home-hero__title mb-6 font-serif">Pueblo La Perla</h1>
        <p data-content-key="homepage.heroSubtitle" className="plp-home-hero__lead mb-9 max-w-xl text-base leading-7 md:text-lg">A private hillside retreat above Boracay’s white sands.</p>
        <div className="plp-home-hero__actions flex flex-wrap items-center gap-6">
          <a data-content-key="homepage.primaryCta" className="journey-primary journey-primary-light" href="/booking">Check availability <ArrowRight size={17} aria-hidden="true" /></a>
          <a className="journey-link text-white" href="#find-your-stay">Explore the stays <ArrowDownRight size={17} aria-hidden="true" /></a>
        </div>
        <p className="plp-home-hero__footnote">Villas <span aria-hidden="true">·</span> Sea views <span aria-hidden="true">·</span> Unhurried island days</p>
      </div>
      <a className="plp-home-hero__scroll" href="#find-your-stay" aria-label="Scroll to find your stay"><span>Discover</span><ArrowDownRight size={17} aria-hidden="true" /></a>
    </section>
    <StayFinder rooms={rooms} />

    <section className="plp-story-section" aria-labelledby="plp-story-title">
      <div className="plp-story-section__media">
        <img src="/images/plp-pool-ocean-view.webp" alt="Pueblo La Perla pool terrace looking toward the sea" width="980" height="1100" loading="lazy" decoding="async" />
      </div>
      <div className="plp-story-section__copy">
        <p className="journey-kicker">A different rhythm</p>
        <h2 id="plp-story-title">Your own place above the island.</h2>
        <p>Step away from the rush, settle into a private hillside setting, and shape each day around the people and moments that matter.</p>
        <a className="journey-link" href="/gallery">Explore the property <ArrowRight size={17} aria-hidden="true" /></a>
      </div>
    </section>

    <section className="plp-club-home" aria-labelledby="home-club-title">
      <div className="journey-wrap club-invitation">
        <div className="plp-club-home__photo">
          <img src="/images/plp-private-breakfast-pool.webp" alt="Breakfast beside the pool at Pueblo La Perla" width="760" height="540" loading="lazy" decoding="async" />
          <span>Life, shared well</span>
        </div>
        <div className="plp-club-home__copy">
          <p className="journey-kicker">PLP Club · Boracay</p>
          <h2 id="home-club-title">A place to belong.</h2>
          <p className="my-6 max-w-md text-base leading-8">Our proposed senior community for adults aged 60 and above brings friendship, gentle wellbeing, culture, and island days together.</p>
          <p className="plp-club-home__note">Boracay pilot in development · Membership terms to be confirmed</p>
          <a href="/club" className="journey-link">Discover PLP Club <ArrowRight size={17} aria-hidden="true" /></a>
        </div>
      </div>
    </section>

    <section className="journey-wrap plp-experiences-section" aria-labelledby="home-experiences-title">
      <div className="journey-heading">
        <div><p className="journey-kicker">Curated experiences</p><h2 id="home-experiences-title">Days on the island</h2></div>
        <a href="/experiences" className="journey-link">All experiences <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
      <div className="stay-options plp-experiences-grid mt-8">{experiences.map(item => <a key={item.slug} href={'/experiences#' + item.slug} className="experience-link">
        <div className="plp-experience-photo"><img src={'/images/' + item.image} alt={item.alt} width="640" height="440" loading="lazy" decoding="async" /></div>
        <span>{item.title}<ArrowRight size={18} aria-hidden="true" /></span>
        <small>{item.description}</small>
      </a>)}</div>
    </section>
    <VideoSection />
    <section className="plp-arrival-section bg-[#242721] text-white">
      <div className="journey-wrap journey-heading">
        <div><p className="journey-kicker">The journey here</p><h2>Arrive at your own pace.</h2><p className="mt-4 max-w-lg leading-7">Find your way from Caticlan or Kalibo, or ask concierge about meeting your group.</p></div>
        <div className="flex flex-wrap gap-6"><a className="journey-link" href="/getting-here">Getting here</a><a className="journey-link" href="/contact?topic=arrival">Ask concierge <ArrowRight size={16} aria-hidden="true" /></a></div>
      </div>
    </section>
  </main>;
}
