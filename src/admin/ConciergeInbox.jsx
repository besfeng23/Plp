import React, { useEffect, useState } from 'react';

const states = { NEW: 'New', CONTACTED: 'Contacted', QUOTED: 'Quoted', BOOKED: 'Booked', LOST: 'Lost' };
const primaryAction = { NEW: ['CONTACTED', 'Mark contacted'], CONTACTED: ['QUOTED', 'Mark quoted'], QUOTED: ['BOOKED', 'Mark booked'] };
const displayDate = new Intl.DateTimeFormat('en-PH', {timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'});

function mailtoFor(row) {
  return 'mailto:' + row.email.split('@').map(encodeURIComponent).join('@') + '?subject=' + encodeURIComponent('Pueblo La Perla · ' + row.interest);
}

export default function ConciergeInbox({ code, clubOnly = false, refreshedAt }) {
  const [status,setStatus] = useState('NEW');
  const [scope,setScope] = useState('club');
  const [pages,setPages] = useState([null]);
  const [loaded,setLoaded] = useState(null);
  const [error,setError] = useState('');
  const [actionError,setActionError] = useState('');
  const [busy,setBusy] = useState(false);
  const [version,setVersion] = useState(0);
  const cursor = pages[pages.length - 1];
  const heading = clubOnly ? 'Pearl Club enquiries' : 'Sales inbox';

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null); setError('');
    const query = new URLSearchParams({action:'concierge-inbox',status,scope:clubOnly ? scope : 'all'});
    if (cursor) { query.set('before',cursor.created_at); query.set('beforeId',cursor.id); }
    fetch('/api/admin?' + query, {cache:'no-store',signal:controller.signal,headers:{'X-PLP-Staff-Code':code}})
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.ok || !Array.isArray(data.rows)) throw new Error('The sales inbox is unavailable.');
        if (!controller.signal.aborted) setLoaded(data);
      }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [code, clubOnly, scope, status, cursor, version, refreshedAt]);

  async function patch(row, fields) {
    setBusy(true); setActionError('');
    try {
      const response = await fetch('/api/admin?action=concierge-inbox',{
        method:'PATCH',headers:{'Content-Type':'application/json','X-PLP-Staff-Code':code},
        body:JSON.stringify({id:row.id,previous:row.status,status:fields.status || row.status,...fields}),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'The enquiry could not be updated.');
      if (fields.status && fields.status !== row.status) setPages([null]);
    } catch (err) { setActionError(err.message); }
    finally { setVersion(value => value + 1); setBusy(false); }
  }

  return <section className="plp-panel" aria-label={heading}>
    <div className="plp-panel__head"><div><h3>{heading}</h3><p>{clubOnly ? (scope === 'residential' ? 'Separate interest in the proposed residential concept. No admissions or medical services are offered.' : 'Membership and activity messages from the Boracay enquiry form.') : 'New website enquiries, one card at a time. Assign a follow-up and move each lead forward.'}</p></div>
      <label className="plp-month-picker">Show<select value={status} disabled={busy} onChange={e => { setStatus(e.target.value); setPages([null]); setActionError(''); }}>
        {Object.entries(states).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {clubOnly && <div className="plp-club-actions" role="group" aria-label="Pearl Club enquiry categories">
      <button type="button" className="plp-secondary" aria-pressed={scope === 'club'} onClick={() => { setScope('club'); setPages([null]); }}>Club &amp; activities</button>
      <button type="button" className="plp-secondary" aria-pressed={scope === 'residential'} onClick={() => { setScope('residential'); setPages([null]); }}>Senior-living interest</button>
    </div>}
    {actionError && <p className="plp-form-error" role="alert">{actionError}</p>}
    {error ? <p role="alert">{error} <button className="plp-text-button" onClick={() => setVersion(value => value + 1)}>Try again</button></p>
      : !loaded ? <p role="status">Loading enquiries…</p>
      : loaded.rows.length === 0 ? <p className="plp-disclosure">Nothing in this list.</p>
      : <div className="plp-task-list">{loaded.rows.map(row => {
        const next = primaryAction[row.status];
        const due = row.follow_up_on;
        const overdue = due && due < new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
        return <article className="plp-enquiry" key={row.id}>
          <header><h4>{row.interest}</h4><time dateTime={row.created_at}>{displayDate.format(new Date(row.created_at))}</time></header>
          <p><strong>{row.name}</strong> · <a className="underline" href={mailtoFor(row)}>{row.email}</a></p>
          <p className="whitespace-pre-wrap">{row.message}</p>
          <div className="plp-enquiry__meta">
            <label>Assignee<input defaultValue={row.assignee || ''} disabled={busy} maxLength={120} autoComplete="off"
              onBlur={e => { const value = e.target.value.trim(); if (value !== (row.assignee || '')) patch(row, { assignee: value }); }} /></label>
            <label>Follow up<input type="date" defaultValue={row.follow_up_on || ''} disabled={busy}
              onBlur={e => { const value = e.target.value; if (value !== (row.follow_up_on || '')) patch(row, { follow_up_on: value }); }} />
              {overdue && <span className="plp-enquiry__due">Follow up is due</span>}
            </label>
          </div>
          <div className="plp-club-actions">
            {next && <button disabled={busy} type="button" className="plp-primary" onClick={() => patch(row, { status: next[0] })}>{next[1]}</button>}
            {row.status !== 'LOST' && row.status !== 'BOOKED' && <button disabled={busy} type="button" className="plp-text-button" onClick={() => patch(row, { status: 'LOST' })}>Mark as lost</button>}
            {row.status === 'LOST' && <button disabled={busy} type="button" className="plp-text-button" onClick={() => patch(row, { status: 'CONTACTED' })}>Reopen</button>}
          </div>
        </article>;
      })}</div>}
    <div className="plp-club-actions">{pages.length > 1 && <button className="plp-secondary" disabled={busy || !loaded} onClick={() => setPages(previous => previous.slice(0,-1))}>Previous page</button>}
      {loaded?.hasMore && <button className="plp-secondary" disabled={busy} onClick={() => setPages(previous => [...previous,loaded.rows.at(-1)])}>Next page</button>}</div>
  </section>;
}
