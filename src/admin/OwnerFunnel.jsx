import React, { useEffect, useState } from 'react';
import { manilaToday } from './plpAdminModel.js';

const display = [
  ['Page views', 'pageViews'],
  ['Reserve clicks', 'reserveClicks'],
  ['Booking starts', 'bookingStarts'],
  ['Requests recorded', 'bookingRequestsRecorded'],
  ['Enquiries sent', 'enquiriesSent'],
  ['Pearl Club enquiries', 'clubEnquiriesSent'],
  ['Senior-living interest', 'residentialInterestsSent'],
];

export default function OwnerFunnel({ code, refreshedAt }) {
  const currentMonth = manilaToday().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [failure, setFailure] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setFailure(false);
    fetch('/api/admin?action=owner-funnel&month=' + encodeURIComponent(month), {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'X-PLP-Staff-Code': code },
    }).then(async response => {
      if (!response.ok) throw new Error('Report unavailable');
      const body = await response.json();
      if (!body.ok || body.month !== month) throw new Error('Invalid report');
      if (!controller.signal.aborted) setData(body);
    }).catch(() => { if (!controller.signal.aborted) setFailure(true); });
    return () => controller.abort();
  }, [code, month, retry, refreshedAt]);

  return <section className="plp-panel" aria-labelledby="plp-anonymous-funnel-title">
    <div className="plp-panel__head"><div>
      <h3 id="plp-anonymous-funnel-title">Website interest · Anonymous events</h3>
      <p>Only visits and actions recorded after optional analytics consent. No names, contacts, or health details are included.</p>
    </div><label className="plp-month-picker">Reporting month
      <input type="month" min="2000-01" max={currentMonth} value={month} onChange={e => { if (e.target.value && e.target.validity.valid) setMonth(e.target.value); }} />
    </label></div>
    {failure ? <p role="alert">Website engagement figures are temporarily unavailable. <button type="button" className="plp-text-button" onClick={() => setRetry(n => n + 1)}>Try again</button></p>
      : data?.month !== month ? <p role="status">Loading anonymous website counts…</p>
      : !data.complete ? <p role="status">The event volume exceeds this report's safe reading limit. No partial totals are presented.</p>
      : <><div className="plp-metrics">{display.map(([label,key]) => <div className="plp-metric" key={key}>
        <span>{label}</span><strong>{data.metrics[key]}</strong>
      </div>)}</div>
      <p className="plp-disclosure">{data.scanned === 0 ? 'No consented website events were recorded in the selected month. ' : ''}
        These are event counts, not unique visitors or confirmed customers. Booking confirmation and payment must be checked against the separate reservation ledger. Older events may have different tracking coverage.
      </p></>}
  </section>;
}
