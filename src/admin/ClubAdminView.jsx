import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConciergeInbox from './ConciergeInbox.jsx';
import ActivityRegister from './ActivityRegister.jsx';
import { ArrowRight, CalendarDays, RefreshCw, Users } from 'lucide-react';

const EMPTY_MEMBER = { full_name: '', email: '', phone: '', age_declared_60plus: false, consent_recorded: false };
const EMPTY_ACTIVITY = { title: '', summary: '', category: 'connection', starts_at: '', ends_at: '', capacity: '', location_note: '', accessibility_notes: '' };

async function clubRequest(operation, code, { method = 'GET', body, activity, before, beforeId, signal } = {}) {
  const query = new URLSearchParams({ action: 'club', operation });
  if (activity) query.set('activity', activity);
  if (before) query.set('before', before);
  if (beforeId) query.set('beforeId', beforeId);
  const response = await fetch('/api/plp?' + query, {
    signal,
    method,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-PLP-Staff-Code': code },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) throw new Error(result.error || 'Club operation unavailable.');
  return result;
}

async function loadClubMembers(code, signal) {
  const members = [];
  let next = null;
  do {
    const page = await clubRequest('members', code, { ...next, signal });
    members.push(...page.members);
    next = page.next;
  } while (next);
  return members;
}

const manilaFormat = (date) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(date));

function asManilaIso(value) {
  return value ? new Date(`${value}:00+08:00`).toISOString() : null;
}

export default function ClubAdminView({ code, refreshedAt }) {
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberLimit, setMemberLimit] = useState(20);
  const [activities, setActivities] = useState([]);
  const [registerId, setRegisterId] = useState('');
  const [registerVersion, setRegisterVersion] = useState(0);
  const recordsRequest = useRef(null);
  const [member, setMember] = useState(EMPTY_MEMBER);
  const [activity, setActivity] = useState(EMPTY_ACTIVITY);
  const [loading, setLoading] = useState(true);
  const [recordsReady, setRecordsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    recordsRequest.current?.abort();
    const controller = new AbortController();
    recordsRequest.current = controller;
    setError(''); setLoading(true);
    try {
      const [roster, activityData] = await Promise.all([
        loadClubMembers(code, controller.signal),
        clubRequest('admin-activities', code, { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setMembers(roster);
      setActivities(activityData.activities || []);
      setRecordsReady(true);
      setRegisterVersion(version => version + 1);
    } catch (caught) {
      if (!controller.signal.aborted) { setRecordsReady(false); setError(caught.message || 'Club records unavailable.'); }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void reload();
    return () => recordsRequest.current?.abort();
  }, [reload, refreshedAt]);

  const counts = useMemo(() => ({
    active: members.filter((row) => row.status === 'ACTIVE').length,
    pending: members.filter((row) => row.status === 'PENDING').length,
    published: activities.filter((row) => row.status === 'PUBLISHED' && Date.parse(row.starts_at) > Date.now()).length,
  }), [members, activities]);

  const matchedMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    return term ? members.filter(row => [row.full_name, row.email].some(value => value?.toLowerCase().includes(term))) : members;
  }, [members, memberSearch]);

  async function addMember(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await clubRequest('members', code, { method: 'POST', body: member });
      setMember(EMPTY_MEMBER); setNotice('Member recorded as pending; no membership has been activated.');
      await reload();
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  async function decideMember(id, status) {
    setBusy(true); setError(''); setNotice('');
    try {
      await clubRequest('members', code, { method: 'PATCH', body: { id, status } });
      setNotice(`Membership status updated to ${status.toLowerCase()}.`); await reload();
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  async function addActivity(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await clubRequest('admin-activities', code, { method: 'POST', body: { ...activity, starts_at: asManilaIso(activity.starts_at), ends_at: asManilaIso(activity.ends_at), status: 'DRAFT' } });
      setActivity(EMPTY_ACTIVITY); setNotice('Activity draft saved. Publish only after the date, venue, accessibility, and facilitator are confirmed.');
      await reload();
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  async function changeActivity(id, status) {
    setBusy(true); setError(''); setNotice('');
    try {
      await clubRequest('admin-activities', code, { method: 'PATCH', body: { id, status } });
      setNotice(`Activity ${status.toLowerCase()}.`); await reload();
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  return <div className="plp-club-stack">
    <div className="plp-metrics">
      <div className="plp-metric"><span>Pending applications</span><strong>{loading || !recordsReady ? '—' : counts.pending}</strong><small>Staff-recorded consent</small></div>
      <div className="plp-metric"><span>Active members</span><strong>{loading || !recordsReady ? '—' : counts.active}</strong><small>Boracay chapter only</small></div>
      <div className="plp-metric"><span>Upcoming activities</span><strong>{loading || !recordsReady ? '—' : counts.published}</strong><small>Published dates only</small></div>
      <div className="plp-metric"><span>Region</span><strong>Boracay</strong><small>Singapore and Malaysia planned</small></div>
    </div>
    <button type="button" className="plp-secondary" disabled={loading || busy} onClick={reload}><RefreshCw size={16} /> Refresh club records</button>
    {loading && <p role="status" className="plp-disclosure">Loading protected club records…</p>}
    {error && <p role="alert" className="plp-form-error">{error}</p>}
    {notice && <p role="status" className="plp-task-feedback">{notice}</p>}

    <ConciergeInbox code={code} clubOnly refreshedAt={refreshedAt} />

    <section className="plp-panel"><div className="plp-panel__head"><div><h3><Users size={18} className="inline" /> Members</h3><p>Record an application after the person has consented; approve only after a staff eligibility review.</p></div></div>
      {members.length > 0 && <label className="plp-task-form">Find a member by name or email
        <input type="search" value={memberSearch} onChange={event => { setMemberSearch(event.target.value); setMemberLimit(20); }} />
      </label>}
      {matchedMembers.length ? <div className="plp-task-list">{matchedMembers.slice(0, memberLimit).map((item) => <div className="plp-task" key={item.id}><div><strong>{item.full_name}</strong><small>{item.email} · {item.phone || 'No phone'} · {item.status}</small><small>Consent recorded {manilaFormat(item.consent_at)}</small></div><div className="plp-club-actions">{item.status === 'PENDING' && <><button type="button" disabled={busy} onClick={() => decideMember(item.id, 'ACTIVE')} className="plp-secondary">Approve</button><button type="button" disabled={busy} onClick={() => decideMember(item.id, 'DECLINED')} className="plp-secondary">Decline</button></>}{item.status === 'ACTIVE' && <button type="button" disabled={busy} onClick={() => decideMember(item.id, 'INACTIVE')} className="plp-secondary">Deactivate</button>}</div></div>)}</div> : <p className="plp-disclosure">{members.length ? 'No members match your search.' : recordsReady ? 'No Boracay club members recorded yet.' : 'Member records are unavailable.'}</p>}
      {matchedMembers.length > memberLimit && <button type="button" className="plp-secondary" onClick={() => setMemberLimit(limit => limit + 20)}>Show more members</button>}
    </section>

    <section className="plp-panel"><div className="plp-panel__head"><div><h3>Add membership application</h3><p>Do not enter a person without permission. No government IDs, full birthdates, or medical details are collected.</p></div></div>
      <form onSubmit={addMember} className="plp-task-form plp-club-form">
        <label>Full name<input required minLength={2} maxLength={140} value={member.full_name} onChange={(event) => setMember((v) => ({ ...v, full_name: event.target.value }))} /></label>
        <label>Email<input required type="email" maxLength={180} value={member.email} onChange={(event) => setMember((v) => ({ ...v, email: event.target.value }))} /></label>
        <label>Phone (optional)<input type="tel" maxLength={50} value={member.phone} onChange={(event) => setMember((v) => ({ ...v, phone: event.target.value }))} /></label>
        <label className="plp-club-check"><input type="checkbox" required checked={member.age_declared_60plus} onChange={(event) => setMember((v) => ({ ...v, age_declared_60plus: event.target.checked }))} /> Applicant has self-declared age 60 or older</label>
        <label className="plp-club-check"><input type="checkbox" required checked={member.consent_recorded} onChange={(event) => setMember((v) => ({ ...v, consent_recorded: event.target.checked }))} /> I have recorded their informed permission for PLP to contact them about this membership</label>
        <button type="submit" disabled={busy || loading} className="plp-primary">Save pending application <ArrowRight size={16} /></button>
      </form>
    </section>

    <section className="plp-panel"><div className="plp-panel__head"><div><h3><CalendarDays size={18} className="inline" /> Activity calendar</h3><p>Drafts are private; only published future activities appear on the public Pearl Club page.</p></div></div>
      {activities.length ? <div className="plp-task-list">{activities.map((item) => <div className="plp-task" key={item.id}><div><strong>{item.title}</strong><small>{manilaFormat(item.starts_at)} · {item.category} · {item.status}</small><small>{item.location_note || 'Location to be confirmed'}</small></div><div className="plp-club-actions">{item.status !== 'DRAFT' && <button className="plp-secondary" type="button" aria-pressed={registerId === item.id} onClick={() => setRegisterId(item.id)}>Attendance</button>}{item.status === 'DRAFT' && <button className="plp-secondary" type="button" disabled={busy} onClick={() => changeActivity(item.id, 'PUBLISHED')}>Publish</button>}{item.status === 'PUBLISHED' && <button className="plp-secondary" type="button" disabled={busy} onClick={() => changeActivity(item.id, 'CANCELLED')}>Cancel</button>}</div></div>)}</div> : <p className="plp-disclosure">{recordsReady ? 'No activities saved yet.' : 'Activity records are unavailable.'}</p>}
    </section>

    {activities.some(item => item.id === registerId) && <ActivityRegister key={registerId}
      activity={activities.find(item => item.id === registerId)} members={members}
      request={clubRequest} code={code} refreshVersion={registerVersion} onClose={() => setRegisterId('')} />}

    <section className="plp-panel"><div className="plp-panel__head"><div><h3>Schedule an activity</h3><p>All times are entered and displayed in Philippine time (Asia/Manila). New activities stay in draft.</p></div></div>
      <form onSubmit={addActivity} className="plp-task-form plp-club-form">
        <label>Activity name<input required maxLength={120} value={activity.title} onChange={(event) => setActivity((v) => ({ ...v, title: event.target.value }))} placeholder="For example, a coffee morning" /></label>
        <label>Description<textarea required maxLength={600} rows={3} value={activity.summary} onChange={(event) => setActivity((v) => ({ ...v, summary: event.target.value }))} /></label>
        <label>Category<select value={activity.category} onChange={(event) => setActivity((v) => ({ ...v, category: event.target.value }))}><option value="connection">Connection</option><option value="wellbeing">Gentle wellbeing</option><option value="culture">Culture & learning</option><option value="island">Island experience</option></select></label>
        <label>Start · Boracay time<input required type="datetime-local" value={activity.starts_at} onChange={(event) => setActivity((v) => ({ ...v, starts_at: event.target.value }))} /></label>
        <label>End · Boracay time<input required type="datetime-local" value={activity.ends_at} onChange={(event) => setActivity((v) => ({ ...v, ends_at: event.target.value }))} /></label>
        <label>Capacity (optional)<input type="number" min={1} max={1000} value={activity.capacity} onChange={(event) => setActivity((v) => ({ ...v, capacity: event.target.value }))} /></label>
        <label>Location note (optional)<input maxLength={160} value={activity.location_note} onChange={(event) => setActivity((v) => ({ ...v, location_note: event.target.value }))} /></label>
        <label>Accessibility notes (optional)<textarea rows={2} maxLength={400} value={activity.accessibility_notes} onChange={(event) => setActivity((v) => ({ ...v, accessibility_notes: event.target.value }))} /></label>
        <button type="submit" disabled={busy || loading} className="plp-primary">Save private draft <ArrowRight size={16} /></button>
      </form>
    </section>
    <p className="plp-disclosure">Club operations are separate from room bookings, payments, and statutory senior-citizen benefits. Staff can record attendance after a published activity starts.</p>
  </div>;
}
