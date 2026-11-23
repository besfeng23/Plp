import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react';
import { describeCancel, describeSuccess, returnReference } from './paymentReturn.js';

function useReturnState(describe) {
  const [stored, setStored] = useState(null);
  useEffect(() => {
    try { setStored(JSON.parse(window.localStorage.getItem('plp_pending_payment') || 'null')); } catch { /* optional */ }
  }, []);
  const params = new URLSearchParams(window.location.search);
  return { info: describe(params), reference: returnReference(params, stored) };
}

const ICONS = { paid: CheckCircle2, review: Clock3, unknown: AlertCircle, cancelled: AlertCircle, failed: AlertCircle, incomplete: AlertCircle };

function ReturnLayout({ info, reference, children }) {
  const Icon = ICONS[info.state] || AlertCircle;
  return <main id='main-content' className='min-h-screen bg-[#FAFAF7] px-6 pb-32 pt-40 md:px-12' data-payment-state={info.state}>
    <div className='mx-auto max-w-3xl text-center'>
      <Icon className={`mx-auto mb-8 h-10 w-10 ${info.state === 'paid' ? 'text-[#0f766e]' : 'text-[#7A6A3A]'}`} aria-hidden='true' />
      <p className='mb-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7A6A3A]'>{info.kicker}</p>
      <h1 className='mb-8 font-serif text-4xl md:text-5xl'>{info.title}</h1>
      <p className='mx-auto mb-10 max-w-2xl leading-relaxed text-[#3F3F3F]'>{info.body}</p>
      {reference && <div className='mx-auto mb-10 max-w-xl border border-stone-200 bg-white/70 p-6 text-left text-sm text-[#3F3F3F]'>
        <p className='mb-2 font-medium text-[#1A1A1A]'>Request reference</p>
        <p className='mb-3 font-serif text-2xl text-[#1A1A1A]'>{reference}</p>
        <p>Quote this reference whenever you contact PLP about this stay.</p>
      </div>}
      {children}
    </div>
  </main>;
}

const primary = 'border border-[#1A1A1A] px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] hover:bg-[#1A1A1A] hover:text-white';
const link = 'border-b border-[#1A1A1A] pb-1 text-[11px] font-semibold uppercase tracking-[0.2em]';

export function PaymentSuccessView({ navigate }) {
  const { info, reference } = useReturnState(describeSuccess);
  return <ReturnLayout info={info} reference={reference}>
    <div className='flex flex-col items-center justify-center gap-4 sm:flex-row'>
      {info.state !== 'paid' && <button onClick={() => navigate('contact')} className={primary}>Contact concierge</button>}
      <button onClick={() => navigate('home')} className={link}>Return to resort</button>
    </div>
  </ReturnLayout>;
}

export function PaymentCancelView({ navigate }) {
  const { info, reference } = useReturnState(describeCancel);
  return <ReturnLayout info={info} reference={reference}>
    <div className='flex flex-col items-center justify-center gap-4 sm:flex-row'>
      {info.state !== 'review' && <button onClick={() => navigate('booking')} className={primary}>Try again</button>}
      <button onClick={() => navigate('contact')} className={info.state === 'review' ? primary : link}>Contact concierge</button>
    </div>
  </ReturnLayout>;
}
