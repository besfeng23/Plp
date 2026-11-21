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
        <p className="mb-7 text-xs font-semibold uppercase tracking-[0.2em] text-[#E3CE8B]">Pearl Club · Senior-living pathway</p>
        <h1 className="max-w-4xl font-serif text-5xl leading-tight md:text-7xl">A life well lived, together.</h1>
        <p className="mt-8 max-w-2xl text-base leading-8 text-white/85 md:text-lg">Pearl Club Boracay now has a membership application and staff-review pathway for adults aged 60 and above. Members can also register interest in future residential opportunities. Residential accommodation and medical care are not yet available through this program.</p>
        <div className="mt-9 flex flex-wrap items-center gap-6">
          <a href="/club#club-application" className="inline-flex min-h-12 items-center gap-3 bg-[#FAFAF7] px-7 py-4 text-sm font-semibold text-[#1A1A1A] hover:bg-[#E3CE8B]">Apply to Pearl Club <ArrowRight size={17} aria-hidden="true" /></a>
          <a href="/contact?topic=club&amp;purpose=residential-interest" className="inline-flex min-h-12 items-center border-b border-white/70 text-sm font-semibold">Ask about senior living</a>
        </div>
      </div>
    </section>
    <section className="mx-auto grid max-w-[1200px] gap-12 px-6 py-20 md:grid-cols-2 md:gap-20 md:px-12 md:py-28" aria-labelledby="senior-living-how">
      <div><p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#746130]">How the pathway works</p><h2 id="senior-living-how" className="font-serif text-4xl leading-tight md:text-6xl">Membership first. Admission separately.</h2></div>
      <div className="space-y-7 text-base leading-8 text-[#45413A]">
        <p>Dr. Marichi Fong Ramos’s Pearl Club pathway begins with membership. Her team reviews membership applications individually. Residential admission is a separate decision: club membership does not guarantee a residential place.</p>
        <ol className="space-y-5 border-l border-[#746130]/40 pl-6">
          <li><strong>01 · Apply for Pearl Club membership.</strong> Submit an online application with your 60+ declaration and contact consent. Staff review each application; there is no payment at this stage.</li>
          <li><strong>02 · Explore membership activities.</strong> Check the published activity calendar and ask the team about attendance and community experiences.</li>
          <li><strong>03 · Register residential interest separately.</strong> Speak with the team about future residential opportunities. No residential booking or medical intake is available through this website.</li>
        </ol>
      </div>
    </section>
    <section className="bg-[#F2EEE5] px-6 py-20 md:px-12 md:py-24" aria-labelledby="senior-living-ideas">
      <div className="mx-auto max-w-[1200px]">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#746130]">Activities & wellness interests</p>
        <h2 id="senior-living-ideas" className="max-w-2xl font-serif text-4xl leading-tight md:text-6xl">Make room for what matters.</h2>
        <div className="mt-12 grid gap-10 border-t border-[#B9AD94] pt-10 md:grid-cols-2">
          {proposals.map(item => <article key={item.title}><h3 className="font-serif text-2xl">{item.title}</h3><p className="mt-3 max-w-md text-base leading-8 text-[#45413A]">{item.text}</p></article>)}
        </div>
        <p className="mt-12 max-w-3xl text-sm leading-7 text-[#575146]">The club application and review process is operational. Activity dates appear only after staff publish them. Residential accommodation, healthcare services and residential prices require separate authorization and are not available to book here.</p>
      </div>
    </section>
    <section className="mx-auto max-w-[1200px] px-6 py-20 text-center md:px-12 md:py-28">
      <HeartHandshake size={31} className="mx-auto mb-6 text-[#746130]" aria-hidden="true" />
      <h2 className="mx-auto max-w-2xl font-serif text-4xl md:text-5xl">Your next chapter starts here.</h2>
      <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-[#45413A]">Apply to Pearl Club now, or contact the team about future residential opportunities. Do not submit medical records, diagnoses or other sensitive health details.</p>
      <a href="/club#club-application" className="mt-8 inline-flex min-h-12 items-center gap-3 bg-[#1A1A1A] px-8 py-4 text-sm font-semibold text-white hover:bg-[#746130]">Apply for membership <ArrowRight size={17} aria-hidden="true" /></a>
      <p className="mx-auto mt-7 max-w-xl text-sm leading-6 text-[#676259]">Membership applications are reviewed privately by staff. Residential admissions, paid memberships and medical appointments are not accepted through this page.</p>
    </section>
  </main>;
}
