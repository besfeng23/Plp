import React from 'react';
import { ArrowRight, HeartHandshake } from 'lucide-react';

const proposals = [
  { title: 'Thoughtful daily living', text: 'A safe, welcoming environment with opportunities for social connection and personal routines.' },
  { title: 'Movement & recreation', text: 'Ideas include swimming, appropriate exercise, board games and gentle group activities.' },
  { title: 'Wellness coordination', text: 'Medical checkups, nutrition consultations and other practitioner-led services are being explored, not currently offered through this program.' },
  { title: 'Community & belonging', text: 'Shared meals, cultural occasions and optional community gatherings, including faith-based activities where arranged.' },
];

export default function SeniorLivingView() {
  return <main id="main-content" className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A]">
    <section className="bg-[#23251F] px-6 pb-20 pt-44 text-[#FAFAF7] md:px-12 md:pb-28 md:pt-52">
      <div className="mx-auto max-w-[1200px]">
        <p className="mb-7 text-xs font-semibold uppercase tracking-[0.2em] text-[#E3CE8B]">Pearl Club · Future senior-living concept</p>
        <h1 className="max-w-4xl font-serif text-5xl leading-tight md:text-7xl">A life well lived, together.</h1>
        <p className="mt-8 max-w-2xl text-base leading-8 text-white/85 md:text-lg">Pueblo La Perla is exploring a residential wellness community for adults aged 60 and above. This is an early-stage concept, not an operating retirement residence or an offer of medical care.</p>
        <div className="mt-9 flex flex-wrap items-center gap-6">
          <a href="/contact?topic=club&amp;purpose=residential-interest" className="inline-flex min-h-12 items-center gap-3 bg-[#FAFAF7] px-7 py-4 text-sm font-semibold text-[#1A1A1A] hover:bg-[#E3CE8B]">Enquire about the vision <ArrowRight size={17} aria-hidden="true" /></a>
          <a href="/club" className="inline-flex min-h-12 items-center border-b border-white/70 text-sm font-semibold">Explore Pearl Club</a>
        </div>
      </div>
    </section>
    <section className="mx-auto grid max-w-[1200px] gap-12 px-6 py-20 md:grid-cols-2 md:gap-20 md:px-12 md:py-28" aria-labelledby="senior-living-how">
      <div><p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#746130]">A proposed pathway</p><h2 id="senior-living-how" className="font-serif text-4xl leading-tight md:text-6xl">Membership first. Admission separately.</h2></div>
      <div className="space-y-7 text-base leading-8 text-[#45413A]">
        <p>Dr. Ramos has proposed Pearl Club membership as a prerequisite before someone could be considered for the retirement community. Club membership would not automatically approve residential admission.</p>
        <ol className="space-y-5 border-l border-[#746130]/40 pl-6">
          <li><strong>01 · Explore Pearl Club.</strong> Enquire about the proposed club, activities and eligibility. No paid enrollment is available online.</li>
          <li><strong>02 · Express residential interest.</strong> Share contact details so the PLP team can discuss the concept. An enquiry is not an application or a reservation.</li>
          <li><strong>03 · Separate assessment if launched.</strong> Any future residential admission would require approved facilities, agreements, eligibility processes and an independent staff decision.</li>
        </ol>
      </div>
    </section>
    <section className="bg-[#F2EEE5] px-6 py-20 md:px-12 md:py-24" aria-labelledby="senior-living-ideas">
      <div className="mx-auto max-w-[1200px]">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#746130]">For discussion · Not available services</p>
        <h2 id="senior-living-ideas" className="max-w-2xl font-serif text-4xl leading-tight md:text-6xl">What the community could include.</h2>
        <div className="mt-12 grid gap-10 border-t border-[#B9AD94] pt-10 md:grid-cols-2">
          {proposals.map(item => <article key={item.title}><h3 className="font-serif text-2xl">{item.title}</h3><p className="mt-3 max-w-md text-base leading-8 text-[#45413A]">{item.text}</p></article>)}
        </div>
        <p className="mt-12 max-w-3xl text-sm leading-7 text-[#575146]">No residential inventory, opening date, clinical services, eligibility entitlement or membership pricing has been approved for this program. Availability, professional providers and operating permissions must be independently verified before any service can be offered.</p>
      </div>
    </section>
    <section className="mx-auto max-w-[1200px] px-6 py-20 text-center md:px-12 md:py-28">
      <HeartHandshake size={31} className="mx-auto mb-6 text-[#746130]" aria-hidden="true" />
      <h2 className="mx-auto max-w-2xl font-serif text-4xl md:text-5xl">Interested in the future of Pearl Club?</h2>
      <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-[#45413A]">The Boracay team can record your interest and explain the proposals. Please do not submit medical records, diagnoses or other sensitive health details.</p>
      <a href="/contact?topic=club&amp;purpose=residential-interest" className="mt-8 inline-flex min-h-12 items-center gap-3 bg-[#1A1A1A] px-8 py-4 text-sm font-semibold text-white hover:bg-[#746130]">Send a residential-interest enquiry <ArrowRight size={17} aria-hidden="true" /></a>
      <p className="mx-auto mt-7 max-w-xl text-sm leading-6 text-[#676259]">No enrollment, payments, residential admission or healthcare booking are offered on this page.</p>
    </section>
  </main>;
}
