import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function StayFinder({ rooms }) {
  const [party, setParty] = useState('');
  const matches = rooms.filter(room => room.capacity >= Number(party));
  const largerGroup = party !== '' && Number(party) >= 9;
  return <section id="find-your-stay" className="journey-wrap plp-stay-finder scroll-mt-24" aria-labelledby="stay-finder-title">
    <div className="journey-heading plp-stay-finder__heading">
      <div>
        <p className="journey-kicker">The accommodation collection</p>
        <h2 id="stay-finder-title">Find your stay</h2>
        <p className="plp-stay-finder__intro">Distinctive spaces, thoughtfully set above Boracay.</p>
      </div>
      <label className="journey-field plp-stay-finder__field">Guests in your party
        <select value={party} onChange={event => setParty(event.target.value)}>
          <option value="">Show all stays</option>
          {Array.from({length: 8}, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>)}
          <option value="9">9 or more guests</option>
        </select>
      </label>
    </div>
    <p role="status" className="plp-stay-finder__status">
      {party && matches.length ? matches.length + (matches.length === 1 ? ' stay fits' : ' stays fit') + ' your party. Select dates to check availability.' : ''}
    </p>
    {matches.length ? <div className="stay-options plp-stay-collection">
      {matches.map((room, index) => <article className={'plp-stay-card' + (index === 0 && !party ? ' plp-stay-card--featured' : '')} key={room.slug}>
        <a href={'/accommodation/' + room.slug} className="stay-photo plp-stay-card__photo" aria-label={'Explore ' + room.name}>
          <img src={room.heroSrc} alt={room.heroAlt} width="640" height="440" loading="lazy" decoding="async" />
          <span className="plp-stay-card__type">{room.type}</span>
        </a>
        <div className="plp-stay-card__copy">
          <h3><a href={'/accommodation/' + room.slug}>{room.name}</a></h3>
          <p>Up to {room.capacity} guests <span aria-hidden="true">·</span> {room.bedrooms} {room.bedrooms === 1 ? 'bedroom' : 'bedrooms'}</p>
          <div className="plp-stay-card__actions">
            <a className="journey-link" href={'/booking?room=' + room.slug + (party ? '&guests=' + party : '')}>Check dates <ArrowRight size={16} aria-hidden="true" /><span className="sr-only"> for {room.name}</span></a>
            <a className="plp-stay-card__details" href={'/accommodation/' + room.slug}>View details</a>
          </div>
        </div>
      </article>)}
    </div> : <div className="stay-group plp-stay-group">
      <h3>Travelling as a larger group?</h3>
      <p>{largerGroup ? 'Our largest individual villa sleeps eight. Concierge can help explore a combination of rooms for your party.' : 'Ask concierge which combination of rooms could suit your party.'}</p>
      <a className="journey-link" href="/contact?topic=group">Ask about a group stay <ArrowRight size={16} aria-hidden="true" /></a>
    </div>}
    <a className="journey-link plp-stay-finder__all" href="/accommodation">Explore all accommodation <ArrowRight size={16} aria-hidden="true" /></a>
  </section>;
}
