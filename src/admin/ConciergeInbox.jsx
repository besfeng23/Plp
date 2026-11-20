import React, { useEffect, useState } from 'react';

const states = { NEW: 'New', IN_PROGRESS: 'In progress', CLOSED: 'Closed' };
const displayDate = new Intl.DateTimeFormat('en-PH', {timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'});
export default function ConciergeInbox({ code, clubOnly = false, refreshedAt }) {
  const [status,setStatus] = useState('NEW');
  const [pages,setPages] = useState([null]);
  const [loaded,setLoaded] = useState(null);
  const [error,setError] = useState('');
  const [actionError,setActionError] = useState('');
  const [busy,setBusy] = useState(false);
  const [version,setVersion] = useState(0);
  const cursor = pages[pages.length - 1];
  const heading = clubOnly ? 'Boracay Club enquiries' : 'Concierge inbox';

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null); setError('');
    const query = new URLSearchParams({action:'concierge-inbox',status,scope:clubOnly ? 'club' : 'all'});
    if (cursor) { query.set('before',cursor.created_at); query.set('beforeId',cursor.id); }
    fetch('/api/admin?' + query, {cache:'no-store',signal:controller.signal,headers:{'X-PLP-Staff-Code':code}})
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.ok || !Array.isArray(data.rows)) throw new Error('The concierge inbox is unavailable.');
        if (!controller.signal.aborted) setLoaded(data);
      }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [code, clubOnly, status, cursor, version, refreshedAt]);

  async function move(row, next) {
    setBusy(true); setActionError('');
    try {
      const response = await fetch('/api/admin?action=concierge-inbox',{
        method:'PATCH',headers:{'Content-Type':'application/json','X-PLP-Staff-Code':code},
        body:JSON.stringify({id:row.id,previous:row.status,status:next}),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'The status could not be updated.');
      setPages([null]);
    } catch (err) { setActionError(err.message); }
    finally { setVersion(value => value + 1); setBusy(false); }
  }

  return <section className="plp-panel" aria-label={heading}>
    <div className="plp-panel__head"><div><h3>{heading}</h3><p>{clubOnly ? 'Membership and activity messages from the Boracay enquiry form.' : 'Guest messages submitted through the website enquiry form.'}</p></div>
      <label className="plp-month-picker">Enquiry status<select value={status} disabled={busy} onChange={e => { setStatus(e.target.value); setPages([null]); setActionError(''); }}>
        {Object.entries(states).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {actionError && <p className="plp-form-error" role="alert">{actionError}</p>}
    {error ? <p role="alert">{error} <button className="plp-text-button" onClick={() => setVersion(value => value + 1)}>Try again</button></p>
      : !loaded ? <p role="status">Loading enquiries…</p>
      : loaded.rows.length === 0 ? <p className="plp-disclosure">No enquiries with this status.</p>
      : <div className="plp-task-list">{loaded.rows.map(row => <article className="plp-enquiry" key={row.id}>
        <header><h4>{row.interest}</h4><time dateTime={row.created_at}>{displayDate.format(new Date(row.created_at))}</time></header>
        <p><strong>{row.name}</strong> · <a className="underline" href={'mailto:' + row.email.split('@').map(encodeURIComponent).join('@') + '?subject=' + encodeURIComponent('Pueblo La Perla · ' + row.interest)}>{row.email}</a></p>
        <p className="whitespace-pre-wrap">{row.message}</p>
        <div className="plp-club-actions">{row.status === 'NEW' && <button disabled={busy} type="button" className="plp-secondary" onClick={() => move(row,'IN_PROGRESS')}>Mark in progress</button>}
          {row.status !== 'CLOSED' ? <button disabled={busy} type="button" className="plp-secondary" onClick={() => move(row,'CLOSED')}>Close enquiry</button>
            : <button disabled={busy} type="button" className="plp-secondary" onClick={() => move(row,'IN_PROGRESS')}>Reopen enquiry</button>}</div>
      </article>)}</div>}
    <div className="plp-club-actions">{pages.length > 1 && <button className="plp-secondary" disabled={busy || !loaded} onClick={() => setPages(previous => previous.slice(0,-1))}>Previous page</button>}
      {loaded?.hasMore && <button className="plp-secondary" disabled={busy} onClick={() => setPages(previous => [...previous,loaded.rows.at(-1)])}>Next page</button>}</div>
  </section>;
}
