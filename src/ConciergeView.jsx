import React, { useEffect, useRef, useState } from 'react';
import { CONCIERGE_EMAIL, CONCIERGE_NUMBER, CONCIERGE_NUMBER_DISPLAY } from '../lib/contact.js';
import { INQUIRY_TOPICS, inquiryContext } from '../lib/guest-journey.js';
import { PLP_ROOMS } from '../lib/pricing.js';

const TOPIC_HINT = {
  arrival: 'Tell us your arrival airport and how many people are travelling.',
  group: 'Tell us your group size and preferred travel dates.',
};

const AVAILABLE_TOPICS = Object.entries(INQUIRY_TOPICS).filter(([key]) => key !== 'club' && key !== 'club-activity');

export default function ConciergeView() {
  const [initial] = useState(() => {
    const original = inquiryContext(window.location.search);
    return original.topic.startsWith('club') ? { topic: 'stay', room: '', program: '' } : original;
  });
  const [topic, setTopic] = useState(initial.topic);
  const [room, setRoom] = useState(initial.room);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('draft');
  const online = channel !== 'draft';
  const [state, setState] = useState('idle');
  const sendLock = useRef(false);
  const submission = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/leads', { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted) setChannel(data?.available === true ? (data.channel === 'desk' ? 'desk' : 'email') : 'draft'); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => { if (state === 'sent' || state === 'error') resultRef.current?.focus(); }, [state]);

  const roomName = ['stay', 'group'].includes(topic) ? PLP_ROOMS.find(item => item.slug === room)?.name : '';
  const interest = INQUIRY_TOPICS[topic] + (roomName ? ' · ' + roomName : '');
  const body = [message.trim(), name.trim(), email.trim()].filter(Boolean).join('\n\n');
  const draft = 'mailto:' + CONCIERGE_EMAIL + '?subject=' + encodeURIComponent('PLP enquiry · ' + interest) + '&body=' + encodeURIComponent(body);

  async function send(event) {
    event.preventDefault();
    if (!online) { window.location.href = draft; return; }
    if (sendLock.current) return;
    sendLock.current = true;
    setState('sending');
    const fields = { name: name.trim(), email: email.trim(), interest, channel, topic, room, message: message.trim() };
    const fingerprint = JSON.stringify(fields);
    try {
      if (submission.current?.fingerprint !== fingerprint) {
        submission.current = { fingerprint, id: window.crypto.randomUUID() };
      }
      const response = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, requestId: submission.current.id }) });
      const data = await response.json();
      if (!response.ok || !data.ok || (channel === 'desk' ? data.received !== true : data.emailDelivered !== true)) throw new Error('unconfirmed');
      setState('sent');
      window.plpTrack?.('submit_enquiry');
    } catch { setState('error'); }
    finally { sendLock.current = false; }
  }

  return <main id="main-content" className="min-h-screen bg-[#FAFAF7] pb-24 pt-32">
    <div className="journey-wrap concierge-wrap">
      <div><p className="journey-kicker">Pueblo La Perla Boracay</p><h1>Speak with the concierge.</h1>
        <p className="mt-5 max-w-md leading-7">Ask about a stay, plan your arrival, or contact the Pueblo La Perla concierge.</p>
        <div className="concierge-direct"><a href={'tel:' + CONCIERGE_NUMBER}>Call {CONCIERGE_NUMBER_DISPLAY}</a><a href={'mailto:' + CONCIERGE_EMAIL}>{CONCIERGE_EMAIL}</a></div>
        <a className="journey-link" href="/booking">Check room availability</a>
      </div>
      {state === 'sent' ? <section className="concierge-form" ref={resultRef} tabIndex={-1} role="status">
        <h2>{channel === 'desk' ? 'Enquiry received' : 'Enquiry sent'}</h2><p>The team can reply to {email} about your enquiry.</p><a className="journey-link" href="/">Return to the resort</a>
      </section> : <form className="concierge-form" onSubmit={send} aria-label="Concierge enquiry">
        <fieldset className="grid min-w-0 gap-4" disabled={state === 'sending'}><label className="journey-field">What can we help with?<select value={topic} onChange={e => setTopic(e.target.value)}>{AVAILABLE_TOPICS.map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        {['stay','group'].includes(topic) && <label className="journey-field">Accommodation<select value={room} onChange={e => setRoom(e.target.value)}><option value="">Help me choose</option>{PLP_ROOMS.map(r => <option value={r.slug} key={r.slug}>{r.name}</option>)}</select></label>}
        <label className="journey-field">Your message<textarea required rows={4} maxLength={1200} value={message} onChange={e => setMessage(e.target.value)} aria-describedby="enquiry-hint" /></label>
        <p id="enquiry-hint" className="text-sm leading-6 text-stone-600">{TOPIC_HINT[topic] || 'Share the dates or arrangements you have in mind.'}</p>
        {online && <div className="concierge-identity"><label className="journey-field">Your name<input required autoComplete="name" maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label><label className="journey-field">Reply email<input required type="email" autoComplete="email" maxLength={180} value={email} onChange={e => setEmail(e.target.value)} /></label></div>}
        </fieldset>
        {state === 'error' && <div role="alert" ref={resultRef} tabIndex={-1}>We couldn’t confirm delivery. <a className="underline" href={draft}>Open an email draft with your details</a> or call the concierge.</div>}
        <button className="journey-primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : online ? 'Send enquiry' : 'Open email draft'}</button>
        <p className="text-sm leading-6 text-stone-600">{online ? 'Your details go to the PLP concierge team.' : 'Your email app will open with your message ready to send.'} <a href="/privacy-policy" className="underline">Privacy policy</a></p>
      </form>}
    </div>
  </main>;
}
