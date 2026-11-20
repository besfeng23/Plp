import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function StayFinder({ rooms }) {
  const [party, setParty] = useState('');
  const matches = rooms.filter(room => room.capacity >= Number(party));
  return <section id="find-your-stay" className="journey-wrap scroll-mt-24" aria-labelledby="stay-finder-title">
    <div className="journey-heading">
      <div><p className="journey-kicker">Accommodation</p><h2 id="stay-finder-title">Find your stay</h2></div>
      <label className="journey-field">Guests in your party
        <select value={party} onChange={event => setParty(event.target.value)}>
          <option value="">Show all stays</option>
          {Array.from({length: 8}, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>)}
          <option value="9">9 or more guests</option>
        </select>
      </label>
    </div>
    <p role="status" className="mb-6 text-sm text-stone-600">{party && matches.length ? matches.length + (matches.length === 1 ? ' stay fits' : ' stays fit') + ' your party. Select dates to check availability.' : ''}</p>
    {matches.length ? <div className="stay-options">{matches.map(room => <article key={room.slug}>
      <a href={'/accommodation/' + room.slug} className="stay-photo" aria-label={'Explore ' + room.name}>
        <img src={room.heroSrc} alt={room.heroAlt} width="640" height="440" loading="lazy" decoding="async" />
      </a>
      <h3><a href={'/accommodation/' + room.slug}>{room.name}</a></h3>
      <p>Up to {room.capacity} guests <span aria-hidden="true">·</span> {room.bedrooms} {room.bedrooms === 1 ? 'bedroom' : 'bedrooms'}</p>
      <a className="journey-link" href={'/booking?room=' + room.slug + (party ? '&guests=' + party : '')}>Check dates <ArrowRight size={16} aria-hidden="true" /><span className="sr-only"> for {room.name}</span></a>
    </article>)}</div> : <div className="stay-group">
      <h3>Travelling as a larger group?</h3><p>Our largest individual villa sleeps eight. Ask concierge which combination of rooms could suit your party.</p>
      <a className="journey-link" href="/contact?topic=group">Ask about a group stay <ArrowRight size={16} aria-hidden="true" /></a>
    </div>}
    <a className="journey-link mt-6" href="/accommodation">Explore all accommodation <ArrowRight size={16} aria-hidden="true" /></a>
  </section>;
}
