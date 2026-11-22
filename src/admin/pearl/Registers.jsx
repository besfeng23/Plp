import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { chapters, checkGroups, sources } from './chapterData.js';
import { daysOfMonth, localDate, localLabel, shiftMonth } from './workingFile.js';
import { CheckRows, Empty, Evidence, SectionHead, Tag } from './WorkbookUI.jsx';

export function Choices({ label, names, value, onChange }) {
  return <div className="pw-choices" role="group" aria-label={label}>{names.map(name =>
    <button key={name} type="button" aria-pressed={value === name} onClick={() => onChange(name)}>{name}</button>)}</div>;
}
function Edit({ title, onClick }) {
  return <button className="pw-icon-button" aria-label={'Edit ' + title} onClick={onClick}><Pencil size={15}/></button>;
}

function CompareOffers({ book, chapterId, edit }) {
  const [scope, setScope] = useState('This chapter');
  const comparison = Object.entries(chapters).filter(([id]) => scope === 'All chapters' || id === chapterId).flatMap(([id, c]) =>
    book.locations[id].offers.length ? book.locations[id].offers.map(row => ({ id, name: c.name, row })) : [{ id, name: c.name, row: null }]);
  const fields = [['kind','Offer type'],['provider','Provider'],['detail','Benefits'],['eligibility','Eligibility'],['exclusions','Exclusions'],['amount','Amount'],['currency','Currency'],['basis','Billing interval'],['term','Term'],['tax','Taxes and fees'],['renewal','Renewal'],['refund','Refund or cancellation'],['evidence','Evidence']];
  return <section className="pw-panel"><SectionHead title="Tiers & offer comparison" note="A dash means the value is unverified. Applying to the Boracay programme is free." action="Add tier or offer" onAction={() => edit('offers')}/>
    <Choices label="Offer comparison scope" names={['This chapter','All chapters']} value={scope} onChange={setScope}/>
    <div className="pw-table-wrap" role="region" aria-label="Membership offer comparison" tabIndex={0}>
      <table className="pw-table"><caption className="pw-sr">Senior membership pricing, benefits and offer terms by chapter</caption>
        <thead><tr><th scope="col">Offer field</th>{comparison.map(c => <th scope="col" key={c.id + (c.row?.id || '')}>
          <small>{c.name}</small>{c.row?.title || 'Tier unconfirmed'}{c.row && c.id === chapterId && <Edit title={c.row.title} onClick={() => edit('offers', c.row)}/>}</th>)}</tr></thead>
        <tbody><tr><th scope="row">Review</th>{comparison.map(c => <td key={c.id + (c.row?.id || '')}><Tag state={c.row?.state || 'Needs decision'}/></td>)}</tr>
          {fields.map(([key, label]) => <tr key={key}><th scope="row">{label}</th>{comparison.map(c => <td key={c.id + (c.row?.id || '')}>
            {key === 'evidence' && c.row?.evidence ? <Evidence value={c.row.evidence}/> : c.row?.[key] || '—'}</td>)}</tr>)}</tbody></table>
    </div></section>;
}

function MemberProfiles({ location, edit }) {
  const [term, setTerm] = useState('');
  const [stage, setStage] = useState('All');
  const rows = location.members.filter(row => (stage === 'All' || row.stage === stage) && row.title.toLowerCase().includes(term.trim().toLowerCase()));
  return <section className="pw-panel"><SectionHead title="Member profiles" note="Use references for the working file. Participation links back to each member." action="Add member profile" onAction={() => edit('members')}/>
    {location.members.length > 0 && <div className="pw-filters"><label>Find a reference<input type="search" value={term} onChange={e => setTerm(e.target.value)}/></label>
      <label>Application status<select value={stage} onChange={e => setStage(e.target.value)}>{['All','Pending review','Active','Declined','Inactive'].map(v => <option key={v}>{v}</option>)}</select></label></div>}
    {rows.length ? rows.map(row => {
      const entries = location.attendance.filter(a => a.member === row.id);
      return <details className="pw-detail" key={row.id}><summary><div><strong>{row.title}</strong><small>{row.stage} · {location.offers.find(o => o.id === row.offer)?.title || 'Tier unassigned'}</small></div><ChevronRight size={17}/></summary>
        <div className="pw-detail-body"><dl className="pw-dl"><dt>Age declaration</dt><dd>{row.age}</dd><dt>Contact consent</dt><dd>{row.consent}</dd><dt>Activity interests</dt><dd>{row.interests || '—'}</dd><dt>Follow-up note</dt><dd>{row.detail || '—'}</dd><dt>Attendance in file</dt><dd>{entries.filter(a => a.outcome === 'Attended').length}</dd></dl>
          {entries.length > 0 && <ul className="pw-history">{entries.map(a => { const event = location.events.find(v => v.id === a.event); return <li key={a.id}>{event?.title} · {localLabel(event?.date)} · {a.outcome}</li>; })}</ul>}
          <button className="pw-button pw-outline" onClick={() => edit('members', row)}>Edit profile</button></div></details>;
    }) : <Empty>{location.members.length ? 'No profiles match these filters.' : 'This working file has no member profiles.'}</Empty>}</section>;
}
export function Membership({ book, chapterId, edit }) {
  const c = chapters[chapterId];
  return <>
    <section className="pw-panel"><SectionHead title="Eligibility & applications"/>
      {chapterId === 'boracay' ? <><ol className="pw-flow">
        <li><strong>Apply</strong><span>Adults aged 60+ provide contact details, their age declaration and consent.</span></li>
        <li><strong>Review</strong><span>The Boracay team reviews a pending application and follows up with the applicant.</span></li>
        <li><strong>Record the decision</strong><span>Staff approve or decline membership. Only approved, active members appear in the active register.</span></li>
      </ol><p className="pw-footnote">Future residential admission requires a separate review. Health services, accommodation and residential fees remain unverified.</p><Evidence value={sources.application}/></> :
        <p>{c.name} is an expansion proposal. Local eligibility and the application process require a chapter decision. Member intake belongs to the Boracay pilot.</p>}</section>
    <CompareOffers book={book} chapterId={chapterId} edit={edit}/>
    {chapterId === 'boracay' && <MemberProfiles location={book.locations[chapterId]} edit={edit}/>}
  </>;
}

function Participation({ location, edit }) {
  const [filter, setFilter] = useState('');
  const rows = location.attendance.filter(a => !filter || a.event === filter);
  return <section className="pw-panel"><SectionHead title="Attendance & participation" note="Each member has one entry per activity. Edit the entry when their participation changes."
    action={location.events.length && location.members.length ? 'Add participation' : null} onAction={() => edit('attendance', null, { event: filter })}/>
    {location.events.length > 0 && <label className="pw-inline-field">Activity<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">All activities</option>{location.events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>}
    {rows.length ? <><p className="pw-footnote">{rows.filter(a => a.outcome === 'Attended').length} attended · {rows.filter(a => a.outcome === 'Did not attend').length} did not attend · {rows.filter(a => a.outcome === 'Registered interest').length} interest recorded</p>
      {rows.map(a => { const member = location.members.find(m => m.id === a.member), event = location.events.find(e => e.id === a.event); return <div className="pw-line" key={a.id}><div><h3>{member?.title} · {event?.title}</h3><p>{a.outcome}{a.detail && ' · ' + a.detail}</p></div><Edit title={'participation for ' + member?.title} onClick={() => edit('attendance', a)}/></div>; })}</> :
      <Empty>{!location.events.length || !location.members.length ? 'Add a working-file activity and member reference to record participation.' : 'No participation entries match this view.'}</Empty>}
  </section>;
}

export function Activities({ location, chapterId, edit }) {
  const today = localDate(chapters[chapterId].timeZone);
  const [month, setMonth] = useState(today.slice(0,7)), [day, setDay] = useState('');
  const [mode, setMode] = useState('Calendar');
  const [allDates, setAllDates] = useState(false);
  const calendarMode = mode === 'Calendar';
  function changeMonth(next) { setMonth(next); setDay(''); setAllDates(false); }
  const events = [...location.events].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.time.localeCompare(b.time));
  const dated = events.filter(e => e.date && (!calendarMode || (day ? e.date === day : e.date.startsWith(month))));
  const undated = events.filter(e => !e.date);
  function eventRows(rows) {
    return rows.map(e => <article className="pw-check-row" key={e.id}><div className="pw-row-main"><small className="pw-meta">{e.date ? localLabel(e.date) + (e.time ? ' · ' + e.time : '') : 'Date unverified'}</small>
      <h3>{e.title}</h3><p>{[e.category, e.venue, e.facilitator].filter(Boolean).join(' · ')}</p>{e.detail && <p>{e.detail}</p>}
      <div className="pw-row-details">{e.capacity && <span>Capacity · {e.capacity}</span>}{e.access && <span>Access · {e.access}</span>}</div><Evidence value={e.evidence}/></div>
      <div className="pw-row-end"><Tag state={e.state}/><Edit title={e.title} onClick={() => edit('events', e)}/></div></article>);
  }
  return <><section className="pw-panel"><SectionHead title="Activity calendar" note={'Working-file dates in ' + chapters[chapterId].timeZone + '.'} action="Add activity" onAction={() => edit('events', null, { date: day })}/>
    <Choices label="Activity view" names={['Calendar','Agenda']} value={mode} onChange={setMode}/>
    {calendarMode && <><div className="pw-month"><h3>{localLabel(month, true)}</h3><div className="pw-actions"><button className="pw-icon-button" aria-label="Previous month" onClick={() => changeMonth(shiftMonth(month,-1))}><ChevronLeft size={17}/></button><button className="pw-button pw-outline" onClick={() => changeMonth(today.slice(0,7))}>This month</button><button className="pw-icon-button" aria-label="Next month" onClick={() => changeMonth(shiftMonth(month,1))}><ChevronRight size={17}/></button></div></div>
      <div className="pw-calendar">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <strong key={d}>{d}</strong>)}{daysOfMonth(month).map((date, i) => { if (!date) return <span key={'blank'+i}/>; const n = events.filter(e => e.date === date).length; return <button key={date} className={date === today ? 'pw-today' : ''} aria-label={localLabel(date) + ', ' + n + ' activities'} aria-pressed={date === day} onClick={() => { setDay(day === date ? '' : date); setAllDates(false); }}>{Number(date.slice(-2))}{n > 0 && <small>{n}</small>}</button>; })}</div></>}
    <div className="pw-subhead"><h3>{calendarMode ? day ? localLabel(day) : 'This month' : 'Dated activities'}</h3>{day && calendarMode && <button className="pw-text" onClick={() => setDay('')}>Show month</button>}</div>
    {dated.length ? eventRows(dated) : <Empty>No dated activities in this view.</Empty>}
    {undated.length > 0 && <><div className="pw-subhead"><h3>Undated activities</h3><button className="pw-text" aria-expanded={allDates} onClick={() => setAllDates(!allDates)}>{allDates ? 'Hide' : 'Show ' + undated.length}</button></div>{allDates && eventRows(undated)}</>}
    </section>{chapterId === 'boracay' && <Participation location={location} edit={edit}/>}</>;
}

export function Enquiries({ location, edit }) {
  const [stage, setStage] = useState('All');
  const rows = location.enquiries.filter(e => stage === 'All' || e.stage === stage).sort((a,b) => (a.due || '9999').localeCompare(b.due || '9999'));
  return <section className="pw-panel"><SectionHead title="Enquiries & follow-up" note="Track the next action against a chapter-specific reference." action="Add enquiry" onAction={() => edit('enquiries')}/>
    <Choices label="Filter enquiries" names={['All','New','In progress','Closed']} value={stage} onChange={setStage}/>
    {rows.length ? rows.map(e => <article className="pw-check-row" key={e.id}><div className="pw-row-main"><small className="pw-meta">{e.topic} · {e.stage}</small><h3>{e.title}</h3>
      {e.detail && <p>{e.detail}</p>}<dl className="pw-dl"><dt>Follow-up owner</dt><dd>{e.owner || 'Unassigned'}</dd><dt>Next action</dt><dd>{e.action || '—'}</dd><dt>Follow-up date</dt><dd>{e.due ? localLabel(e.due) : '—'}</dd></dl></div>
      <Edit title={e.title} onClick={() => edit('enquiries', e)}/></article>) : <Empty>No enquiries in this working-file view.</Empty>}</section>;
}

export function ChapterFile({ location, initialGroup, edit }) {
  const [group, setGroup] = useState(initialGroup || checkGroups[0]);
  return <section className="pw-panel"><SectionHead title="Chapter file" note="Keep requirements, image permissions and partner commitments with their evidence." action="Add checklist item" onAction={() => edit('checks', null, { group })}/>
    <Choices label="Chapter file sections" names={checkGroups} value={group} onChange={setGroup}/>
    <CheckRows rows={location.checks.filter(c => c.group === group)} edit={edit}/></section>;
}
