import React, { useCallback, useEffect, useRef, useState } from 'react';

export default function ActivityRegister({ activity, members, request, code, onClose }) {
  const [attendees, setAttendees] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const remaining = Date.parse(activity.starts_at) - now;
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(remaining + 20, 86_400_000));
    return () => clearTimeout(timer);
  }, [activity.starts_at, now]);
  const [memberId, setMemberId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const title = useRef(null);
  const reload = useCallback(async signal => {
    const data = await request('attendance', code, { activity: activity.id, signal });
    if (!Array.isArray(data.attendees)) throw new Error('Attendance could not be loaded.');
    if (!signal?.aborted) setAttendees(data.attendees);
  }, [request, code, activity.id]);
  useEffect(() => {
    const controller = new AbortController();
    title.current?.focus();
    reload(controller.signal).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [reload]);

  async function mark(id, present) {
    setBusy(true); setError(''); setNotice('');
    try {
      await request('attendance', code, { method: 'POST', body: { activity: activity.id, member: id, present } });
      setMemberId('');
      await reload();
      setNotice(present ? 'Check-in recorded.' : 'Check-in removed.');
    } catch (err) {
      setError(err.message);
      // Re-read authoritative state after a capacity conflict or an interrupted response.
      try { await reload(); } catch { setAttendees(null); }
    } finally { setBusy(false); }
  }

  const checked = new Set((attendees || []).map(row => row.id));
  const eligible = members.filter(member => member.status === 'ACTIVE' && !checked.has(member.id))
    .sort((a,b) => a.full_name.localeCompare(b.full_name));
  const started = Date.parse(activity.starts_at) <= now;
  const canCheckIn = activity.status === 'PUBLISHED' && started;
  return <section className="plp-panel" aria-labelledby="register-title">
    <div className="plp-panel__head"><div><h3 tabIndex={-1} ref={title} id="register-title">Attendance · {activity.title}</h3>
      <p>{attendees === null ? (error ? 'Register unavailable' : 'Loading the activity register…') : attendees.length + ' checked in' + (activity.capacity ? ' · Capacity ' + activity.capacity : '')}</p></div>
      <button type="button" className="plp-secondary" onClick={onClose}>Close register</button>
    </div>
    {error && <p role="alert" className="plp-form-error">{error} <button type="button" className="plp-text-button" disabled={busy} onClick={async () => { try { await reload(); setError(''); } catch (err) { setError(err.message); } }}>Refresh register</button></p>}
    {notice && <p role="status" className="plp-task-feedback">{notice}</p>}
    {attendees !== null && <>
      {canCheckIn ? <form className="plp-task-form" onSubmit={event => { event.preventDefault(); if (memberId) void mark(memberId, true); }}>
        <label>Active Boracay member<select value={memberId} required disabled={busy} onChange={event => setMemberId(event.target.value)}>
          <option value="">Select a member</option>{eligible.map(member => <option key={member.id} value={member.id}>{member.full_name} · {member.email}</option>)}</select></label>
        <button className="plp-primary" disabled={busy || !memberId} type="submit">Check in member</button>
      </form> : <p className="plp-disclosure">{activity.status === 'CANCELLED' ? 'This activity was cancelled.' : 'Check-in opens when the activity starts.'}</p>}
      {attendees.length > 0 ? <ul className="plp-task-list">{attendees.map(row => <li className="plp-task" key={row.id}><strong>{row.name}</strong>
        <button type="button" className="plp-secondary" disabled={busy} onClick={() => mark(row.id, false)}>Undo check-in<span className="sr-only"> for {row.name}</span></button>
      </li>)}</ul> : <p className="plp-disclosure">No members checked in yet.</p>}
    </>}
  </section>;
}
