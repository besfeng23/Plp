import React, { useEffect, useState } from 'react';
import { manilaToday } from './plpAdminModel.js';

export default function OwnerMonth({ code, refreshedAt }) {
  const currentMonth = manilaToday().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState(null);
  const [failure, setFailure] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setReport(null); setFailure(false);
    fetch('/api/admin?action=owner-month&month=' + encodeURIComponent(month), {
      signal: controller.signal, cache: 'no-store', headers: { 'X-PLP-Staff-Code': code },
    }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!data.ok || data.month !== month) throw new Error();
      if (!controller.signal.aborted) setReport(data);
    }).catch(() => { if (!controller.signal.aborted) setFailure(true); });
    return () => controller.abort();
  }, [code, month, retry, refreshedAt]);

  return <section className="plp-panel" aria-labelledby="monthly-requests-title">
    <div className="plp-panel__head"><div><h3 id="monthly-requests-title">Monthly website reservations</h3>
      <p>Requests received during the selected month in Boracay, grouped by their current status. Test records are excluded.</p></div>
      <label className="plp-month-picker">Reporting month<input type="month" min="2000-01" max={currentMonth} value={month} onChange={e => { if (e.target.value && e.target.validity.valid) setMonth(e.target.value); }} /></label>
    </div>
    {failure ? <p role="alert">Monthly figures are unavailable. <button className="plp-text-button" onClick={() => setRetry(n => n + 1)}>Try again</button></p>
      : report?.month !== month ? <p role="status">Loading reservation totals…</p>
      : <><div className="plp-metrics">{[['Requests received',report.requests],['Confirmed or completed',report.confirmed],['Closed or expired',report.closed],['Other statuses',report.other]].map(([label,value]) => <div className="plp-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        {report.rooms.length > 0 ? <ul className="plp-task-list" aria-label="Requests by accommodation">{report.rooms.map(room => <li className="plp-task" key={room.name}><strong>{room.name}</strong><span>{room.requests} {room.requests === 1 ? 'request' : 'requests'}</span></li>)}</ul> : <p className="plp-disclosure">No website reservation requests were recorded for this month.</p>}
      </>}
  </section>;
}
