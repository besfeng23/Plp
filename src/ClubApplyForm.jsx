import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const initial = { full_name: '', email: '', phone: '', age_declared_60plus: false, consent_recorded: false, company_website: '' };

export default function ClubApplyForm() {
  const [availability, setAvailability] = useState('loading');
  const [values, setValues] = useState(initial);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/plp?action=club&operation=application-status', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || result.ok !== true) throw new Error('Unable to check applications');
        if (!controller.signal.aborted) setAvailability(result.applicationsOpen === true ? 'open' : 'closed');
      })
      .catch(() => { if (!controller.signal.aborted) setAvailability('unavailable'); });
    return () => controller.abort();
  }, []);

  const update = (key, value) => setValues(previous => ({ ...previous, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    if (sending || submitted || availability !== 'open') return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/plp?action=club&operation=apply', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.received !== true) throw new Error(result.error || 'Application could not be submitted. Please try again.');
      setSubmitted(true);
      setValues(initial);
      window.plpTrack?.('submit_club_enquiry');
    } catch (caught) {
      setError(caught.message || 'We could not save your application.');
    } finally { setSending(false); }
  }

  return <section id="club-application" className="scroll-mt-28 bg-[#FAFAF7] px-6 py-20 text-[#1A1A1A] md:px-12 md:py-28" aria-labelledby="pearl-application-title">
    <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
      <div>
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#746130]">Boracay · Pearl Club</p>
        <h2 id="pearl-application-title" className="max-w-xl font-serif text-4xl leading-tight md:text-6xl">Start your membership journey.</h2>
        <p className="mt-7 max-w-md text-base leading-8 text-[#45413A]">Apply directly to Pearl Club Boracay. Our team reviews eligibility and contacts applicants about the next steps. You do not need to book a room to apply.</p>
        <p className="mt-5 max-w-md text-sm leading-7 text-[#676259]">For adults aged 60 and above. Applying is free; no membership fee or residential accommodation is purchased here. Approval is separate from any future residential admission.</p>
      </div>
      <div className="border border-[#D6CFBE] bg-white/85 p-6 shadow-[0_14px_55px_rgba(26,26,26,0.05)] sm:p-9">
        {availability === 'loading' && <p role="status">Checking membership application availability…</p>}
        {availability === 'closed' && <p role="status" className="leading-8">Online membership applications are currently closed. <a className="underline underline-offset-4" href="/contact?topic=club">Ask the Pearl Club team</a> about joining.</p>}
        {availability === 'unavailable' && <p role="alert" className="leading-8">We cannot confirm applications are open right now. <a className="underline underline-offset-4" href="/contact?topic=club">Contact the club team</a> directly.</p>}
        {submitted && <div role="status" className="space-y-5"><CheckCircle2 size={34} className="text-[#746130]" aria-hidden="true" />
          <h3 className="font-serif text-3xl">Application received for review.</h3>
          <p className="leading-8 text-[#45413A]">If this is your first application, it has been entered for staff review. The team will contact you using your provided details. This is not an approval or a payment confirmation.</p>
          <a className="inline-flex min-h-12 items-center border-b border-[#746130] text-sm font-semibold" href="/club#club-calendar">Browse activities <ArrowRight size={16} className="ml-2" /></a>
        </div>}
        {availability === 'open' && !submitted && <form className="space-y-6" onSubmit={submit} aria-label="Pearl Club Boracay membership application">
          <h3 className="font-serif text-3xl">Membership application</h3>
          <p className="text-sm leading-7 text-[#676259]">Complete the fields below. Your application will appear in the private staff review queue.</p>
          <label className="block text-sm font-medium">Full name <span aria-hidden="true">*</span>
            <input required maxLength={140} autoComplete="name" className="mt-2 min-h-12 w-full rounded-none border border-[#C9C3B6] bg-[#FAFAF7] px-4 py-3 text-base" value={values.full_name} onChange={e => update('full_name', e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Email address <span aria-hidden="true">*</span>
            <input type="email" required maxLength={180} autoComplete="email" className="mt-2 min-h-12 w-full rounded-none border border-[#C9C3B6] bg-[#FAFAF7] px-4 py-3 text-base" value={values.email} onChange={e => update('email', e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Contact number <span className="text-[#676259]">(optional)</span>
            <input type="tel" maxLength={50} autoComplete="tel" className="mt-2 min-h-12 w-full rounded-none border border-[#C9C3B6] bg-[#FAFAF7] px-4 py-3 text-base" value={values.phone} onChange={e => update('phone', e.target.value)} />
          </label>
          <div className="absolute -left-[9999px]" aria-hidden="true"><label>Company website<input type="text" tabIndex={-1} autoComplete="off" value={values.company_website} onChange={e => update('company_website', e.target.value)} /></label></div>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input type="checkbox" required className="mt-1 h-5 w-5 shrink-0 accent-[#746130]" checked={values.age_declared_60plus} onChange={e => update('age_declared_60plus', e.target.checked)} />
            <span>I confirm that I am aged 60 or above.</span>
          </label>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input type="checkbox" required className="mt-1 h-5 w-5 shrink-0 accent-[#746130]" checked={values.consent_recorded} onChange={e => update('consent_recorded', e.target.checked)} />
            <span>I consent to PLP saving my contact details to review this application and contacting me about Pearl Club. I have read the <a className="underline underline-offset-4" href="/privacy-policy">privacy policy</a>.</span>
          </label>
          {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
          <button type="submit" disabled={sending} className="inline-flex min-h-12 w-full items-center justify-center gap-3 bg-[#1A1A1A] px-6 py-4 text-sm font-semibold uppercase tracking-[0.11em] text-white transition hover:bg-[#746130] disabled:opacity-60">
            {sending ? 'Submitting application…' : 'Submit membership application'} {!sending && <ArrowRight size={16} aria-hidden="true" />}
          </button>
          <p className="text-xs leading-6 text-[#676259]">No payment, identity document, birth date or medical information is requested. Please do not include health information.</p>
        </form>}
      </div>
    </div>
  </section>;
}
