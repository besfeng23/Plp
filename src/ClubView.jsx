import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, HeartHandshake, Mail, Users } from 'lucide-react';
import { CONCIERGE_EMAIL } from '../lib/contact.js';

const IDEAS = [
  { number: '01', title: 'Connection', description: 'Coffee mornings, conversation circles, and gatherings designed around friendship.' },
  { number: '02', title: 'Gentle wellbeing', description: 'Relaxed movement and quiet wellness sessions, with accessibility considered for each event.' },
  { number: '03', title: 'Culture & learning', description: 'Creative workshops, local stories, music, and opportunities to learn together.' },
  { number: '04', title: 'Island experiences', description: 'Thoughtfully paced Boracay outings, subject to venue, transport, and safety arrangements.' },
];

const inquiryHref = (activity) => `mailto:${CONCIERGE_EMAIL}?subject=${encodeURIComponent(activity ? `PLP Club Boracay — ${activity}` : 'PLP Club Boracay — Membership Interest')}`;

function formatSchedule(date) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(date));
}

export default function ClubView() {
  const [activities, setActivities] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/club?operation=activities', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
      .then((data) => { setActivities(Array.isArray(data.activities) ? data.activities : []); setStatus('ready'); })
      .catch((error) => { if (error.name !== 'AbortError') setStatus('unavailable'); });
    return () => controller.abort();
  }, []);

  return <main id="main-content" className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A]">
    <section className="relative isolate overflow-hidden bg-[#171915] px-6 pb-20 pt-44 text-white md:px-12 md:pb-28 md:pt-52">
      <img className="absolute inset-0 -z-20 h-full w-full object-cover object-center" src="/images/plp-property-overview-wide.webp" alt="Pueblo La Perla hillside setting in Boracay" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/70 to-black/25" />
      <div className="mx-auto max-w-[1400px]"><p className="mb-8 text-xs font-semibold uppercase tracking-[0.25em] text-[#E3CE8B]">PLP Club · Boracay Chapter</p>
        <h1 className="max-w-3xl font-serif text-5xl leading-[1.07] md:text-7xl">Good company.<br />A new chapter.</h1>
        <p className="mt-8 max-w-xl text-base leading-8 text-white/90 md:text-lg">A proposed senior community at Pueblo La Perla, shaped around meaningful activities, friendship, and the pleasure of spending time together.</p>
        <a href="#membership" className="mt-9 inline-flex min-h-12 items-center gap-3 bg-[#FAFAF7] px-7 py-3 text-sm font-semibold text-[#1A1A1A] transition hover:bg-[#E3CE8B]">Explore membership <ArrowRight size={17} aria-hidden="true" /></a>
      </div>
    </section>

    <section id="membership" aria-labelledby="club-membership-title" className="mx-auto grid max-w-[1400px] gap-10 px-6 py-20 md:grid-cols-[1fr_1fr] md:gap-20 md:px-12 md:py-28">
      <div><p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#746130]">Introducing the Boracay chapter</p><h2 id="club-membership-title" className="max-w-xl font-serif text-4xl leading-tight md:text-6xl">A club with room for life beyond retirement.</h2></div>
      <div className="max-w-xl self-center"><p className="text-base leading-8 text-[#45413A]">We are developing a membership experience for adults aged 60 and above, beginning in Boracay. The focus is community and activities—not a requirement to book a resort stay.</p><p className="mt-6 text-base leading-8 text-[#45413A]">Membership eligibility, fees, benefits, accessibility arrangements, and launch dates are being finalized. An inquiry is not an approved membership or an activity booking.</p><a className="mt-8 inline-flex min-h-12 items-center gap-3 border-b border-[#746130] text-sm font-semibold text-[#332D20]" href={inquiryHref()}>Ask about joining <Mail size={18} aria-hidden="true" /></a></div>
    </section>

    <section className="bg-[#F2EEE5] px-6 py-20 md:px-12 md:py-24" aria-labelledby="club-activities-title"><div className="mx-auto max-w-[1400px]"><p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#746130]">Program directions · For discussion</p><h2 id="club-activities-title" className="mb-5 font-serif text-4xl md:text-6xl">A calendar with purpose.</h2><p className="mb-12 max-w-2xl text-base leading-8 text-[#45413A]">These are ideas being considered for the club—not activities already scheduled or guaranteed.</p><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{IDEAS.map((item) => <article className="border-t border-[#B4A784] bg-white/70 p-7" key={item.number}><span className="mb-12 block font-serif text-3xl text-[#9A8652]">{item.number}</span><h3 className="mb-4 font-serif text-2xl">{item.title}</h3><p className="text-base leading-7 text-[#45413A]">{item.description}</p></article>)}</div></div></section>

    <section className="mx-auto max-w-[1400px] px-6 py-20 md:px-12 md:py-24" aria-labelledby="club-calendar-title"><div className="mb-10 flex flex-wrap items-end justify-between gap-7"><div><p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#746130]">Boracay · Local time</p><h2 id="club-calendar-title" className="font-serif text-4xl md:text-6xl">Upcoming activities</h2></div><CalendarDays className="text-[#746130]" size={30} aria-hidden="true" /></div>
      {activities.length ? <div className="divide-y divide-stone-300 border-y border-stone-300">{activities.map((activity) => <article key={activity.id} className="grid gap-5 py-8 md:grid-cols-[0.7fr_1.3fr_auto] md:items-center md:gap-8"><p className="text-sm font-semibold text-[#746130]">{formatSchedule(activity.starts_at)}</p><div><h3 className="font-serif text-3xl">{activity.title}</h3><p className="mt-2 max-w-2xl text-base leading-7 text-[#45413A]">{activity.summary}</p>{activity.accessibility_notes && <p className="mt-2 text-sm text-[#45413A]">Access notes: {activity.accessibility_notes}</p>}</div><a href={inquiryHref(activity.title)} className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#1A1A1A] px-5 py-3 text-sm font-semibold hover:bg-[#1A1A1A] hover:text-white">Ask about this <ArrowRight size={16} /></a></article>)}</div> : <div className="border-y border-stone-300 py-12"><p className="font-serif text-2xl">The first calendar is being prepared.</p><p className="mt-3 max-w-2xl text-base leading-7 text-[#45413A]">{status === 'unavailable' ? 'The activities calendar is temporarily unavailable. Contact the team for information.' : 'No public activity dates have been confirmed yet.'}</p></div>}
      <p className="mt-5 text-sm leading-6 text-[#676259]">Activity inquiries are reviewed by the PLP team. Attendance is not automatically confirmed.</p>
    </section>

    <section className="bg-[#1A1A1A] px-6 py-20 text-white md:px-12 md:py-24"><div className="mx-auto grid max-w-[1400px] gap-12 md:grid-cols-[1fr_1fr] md:gap-24"><div><p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#E3CE8B]">A regional vision</p><h2 className="font-serif text-4xl leading-tight md:text-6xl">Boracay first. More chapters later.</h2><p className="mt-6 text-base leading-8 text-white/75">One PLP Club concept, with separate local programs and member records as new chapters are approved.</p></div><div className="space-y-5 self-center"><div className="flex items-center justify-between border-b border-white/20 py-4"><span className="text-lg">Boracay, Philippines</span><span className="text-sm text-[#E3CE8B]">Pilot in development</span></div><div className="flex items-center justify-between border-b border-white/20 py-4"><span className="text-lg">Singapore</span><span className="text-sm text-white/60">Proposed</span></div><div className="flex items-center justify-between border-b border-white/20 py-4"><span className="text-lg">Malaysia</span><span className="text-sm text-white/60">Proposed</span></div></div></div></section>

    <section className="mx-auto max-w-[1400px] px-6 py-20 text-center md:px-12 md:py-28"><HeartHandshake className="mx-auto mb-7 text-[#746130]" size={33} aria-hidden="true" /><h2 className="mx-auto max-w-2xl font-serif text-4xl md:text-6xl">Let's shape the first chapter together.</h2><p className="mx-auto mt-6 max-w-xl text-base leading-8 text-[#45413A]">Have an interest in joining, suggesting an activity, or helping organize the Boracay pilot? Speak to the PLP team.</p><a href={inquiryHref()} className="mt-9 inline-flex min-h-12 items-center gap-3 bg-[#1A1A1A] px-8 py-4 text-sm font-semibold text-white hover:bg-[#746130]">Contact the club team <ArrowRight size={17} aria-hidden="true" /></a><p className="mx-auto mt-8 max-w-xl text-sm leading-6 text-[#676259]"><Users size={15} className="mr-2 inline" aria-hidden="true" />PLP Club is a proposed private membership program and does not issue government senior-citizen identification or statutory entitlements.</p></section>
  </main>;
}
