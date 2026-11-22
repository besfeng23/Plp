import React, { useRef, useState } from 'react';
import { BookMarked, BookOpen, CalendarDays, ChevronDown, ClipboardList, Download, FolderOpen, LayoutGrid, MapPin, MessageSquare, ShieldCheck, Users } from 'lucide-react';
import { chapters, states } from './chapterData.js';
import { chapterReview, maxFileBytes } from './workingFile.js';
import { CheckRows, EditDialog, Jump, statusIcons } from './WorkbookUI.jsx';
import { Activities, ChapterFile, Enquiries, Membership } from './Registers.jsx';
import './pearl.css';

const pages = { Overview: LayoutGrid, Membership: Users, Activities: CalendarDays, Enquiries: MessageSquare, 'Chapter file': BookOpen };
const notes = { Ready: 'Evidence recorded', 'Needs decision': 'Owner choice required', 'Needs verification': 'Confirmation outstanding' };
const defaultAssets = { crest: '/brand/PLP_Editorial_Vector_Logo.svg', reversed: '/brand/PLP_Editorial_Reversed_Ivory.svg', property: '/images/plp-hillside-villas.webp' };

function Overview({ location, chapter, edit, open, group, setGroup }) {
  const rows = chapterReview(location);
  const [limit, setLimit] = useState(4);
  const selected = rows.filter(r => r.state === group);
  return <><div className="pw-overview-head"><div><span className="pw-eyebrow">{chapter.name} · Programme review</span><h2>Chapter overview</h2></div><span className="pw-small-note">Item-level readiness</span></div>
    <div className="pw-states" role="group" aria-label="Filter review items by readiness">{states.map(s => {
      const Icon = statusIcons[s];
      return <button key={s} className={'pw-state-card pw-card-' + s.split(' ').at(-1).toLowerCase()} aria-pressed={group === s} onClick={() => { setGroup(s); setLimit(4); }}>
        <span className="pw-state-line"><Icon size={18} strokeWidth={1.5}/><strong>{rows.filter(r => r.state === s).length}</strong></span>
        <b>{s}</b><small>{notes[s]}</small></button>;
    })}</div>
    <div className="pw-overview-body"><section className="pw-panel pw-review"><div className="pw-section-head"><div><h2>{group}</h2><p>Checklist items, offers and activities in this chapter.</p></div></div>
      <CheckRows rows={selected.slice(0, limit)} edit={edit} compact/>
      {selected.length > limit && <button className="pw-text" onClick={() => setLimit(limit + 8)}>Show more items <ChevronDown size={15}/></button>}</section>
      <aside className="pw-panel pw-index"><span className="pw-eyebrow">Working registers</span><h2>Open a register</h2>
        <Jump Icon={Users} label="Membership" detail={chapter === chapters.boracay ? 'Tiers, applications and profiles' : 'Proposed tiers and offers'} onClick={() => open('Membership')}/>
        <Jump Icon={CalendarDays} label="Activities" detail={chapter === chapters.boracay ? 'Calendar and participation' : 'Chapter planning calendar'} onClick={() => open('Activities')}/>
        <Jump Icon={MessageSquare} label="Enquiries" detail="Follow-up and next actions" onClick={() => open('Enquiries')}/>
        <Jump Icon={ClipboardList} label="Chapter file" detail="Requirements, imagery and partners" onClick={() => open('Chapter file')}/>
      </aside></div></>;
}

export default function OwnerWorkspace({ file, assets = defaultAssets, staffRegister }) {
  const [chapterId, setChapter] = useState('boracay'), [page, setPage] = useState('Overview');
  const [group, setGroup] = useState('Needs decision'), [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState(''), [problem, setProblem] = useState('');
  const [showStaff, setShowStaff] = useState(false);
  const input = useRef(null);
  const chapter = chapters[chapterId], location = file.book.locations[chapterId];
  const enter = next => { setPage(next); setNotice(''); setProblem(''); };
  const switchChapter = id => { setChapter(id); setPage('Overview'); setGroup('Needs decision'); setShowStaff(false); setNotice(''); setProblem(''); };
  const edit = (collection, row = null, presets = {}) => { setNotice(''); setProblem(''); setEditor({ collection, row, presets }); };
  async function loadFile(e) {
    const chosen = e.target.files[0];
    e.target.value = '';
    if (!chosen) return;
    try {
      if (chosen.size > maxFileBytes) throw new Error('Choose a working file no larger than 8 MB.');
      if (file.replace(JSON.parse(await chosen.text()))) { setProblem(''); setNotice('Working file opened.'); setShowStaff(false); }
    } catch (err) { setNotice(''); setProblem(err instanceof SyntaxError ? 'This file does not contain valid working-file data.' : err.message); }
  }
  function download() {
    try { file.download(); setProblem(''); setNotice('Working-file download requested. Reopen the JSON file here to continue.'); }
    catch { setProblem('The browser could not start the download. Your entries are still in this tab.'); }
  }
  return <div className="pw"><header className="pw-mast"><div className="pw-brand"><img src={assets.crest} width="33" height="47" alt="Pueblo La Perla"/><div><b>Pueblo La Perla</b><span>Owner workspace</span></div></div>
    <div className="pw-tools"><button className="pw-button pw-quiet" aria-label="Open file" title="Open working file" onClick={() => input.current.click()}><FolderOpen size={16}/><span className="pw-open-text">Open file</span></button>
      <button className="pw-button" onClick={download}><Download size={16}/>Save file</button>
      <input className="pw-sr" tabIndex="-1" aria-label="Open Pearl Club working file" ref={input} type="file" accept=".json,application/json" onChange={loadFile}/></div></header>
    <section className="pw-hero" aria-labelledby="pw-title"><div className="pw-hero-copy"><span className="pw-eyebrow"><i/>Senior membership</span><h1 id="pw-title">Pearl Club</h1>
      <p>{chapter.brief}</p><div className="pw-hero-location"><MapPin size={15} strokeWidth={1.6}/>{chapter.name}<span>·</span>{chapter.type}</div></div>
      <div className={'pw-photo' + (chapterId === 'boracay' ? '' : ' pw-chapter-mark')}>
        {chapterId === 'boracay' ? <><img src={assets.property} alt="The hillside villas at Pueblo La Perla Boracay"/><span className="pw-caption">Pueblo La Perla Boracay</span></> :
          <><img src={assets.reversed} alt=""/><span>{chapterId === 'singapore' ? 'Changi · Proposed venue' : 'Malaysia · Venue unconfirmed'}</span></>}</div>
    </section>
    <div className="pw-chapters"><span className="pw-eyebrow">Chapters</span><div role="group" aria-label="Choose chapter">{Object.entries(chapters).map(([id,c]) =>
      <button key={id} aria-pressed={chapterId === id} onClick={() => switchChapter(id)}>{c.name}</button>)}</div></div>
    <nav className="pw-nav" aria-label="Pearl Club workspace">{Object.entries(pages).map(([label, Icon]) =>
      <button key={label} aria-current={page === label ? 'page' : undefined} onClick={() => enter(label)}><Icon size={16} strokeWidth={1.65}/>{label}</button>)}
      <label className="pw-mobile-view">Section<select value={page} onChange={e => enter(e.target.value)}>{Object.keys(pages).map(label => <option key={label}>{label}</option>)}</select></label></nav>
    {problem && <p className="pw-error" role="alert">{problem}</p>}{notice && <p className="pw-notice" role="status">{notice}</p>}
    <div className="pw-content" key={chapterId}><div className="pw-file-state"><BookMarked size={15}/>{file.dirty ? 'Unsaved changes · Save file to keep your edits.' : 'Unpublished working file · Entries stay in this tab until saved.'}</div>
      {page === 'Overview' && <Overview location={location} chapter={chapter} edit={edit} open={enter} group={group} setGroup={setGroup}/>}
      {page === 'Membership' && <Membership book={file.book} chapterId={chapterId} edit={edit}/>}
      {page === 'Activities' && <Activities location={location} chapterId={chapterId} edit={edit}/>}
      {page === 'Enquiries' && <Enquiries location={location} edit={edit}/>}
      {page === 'Chapter file' && <ChapterFile location={location} edit={edit}/>}
    </div>
    {staffRegister && chapterId === 'boracay' && <div className="pw-staff"><div><ShieldCheck size={18}/><strong>Existing Boracay staff register</strong></div><p>Authenticated resort operations. Actions in this register update live PLP records.</p>
      <button className="pw-button pw-outline" aria-expanded={showStaff} onClick={() => setShowStaff(!showStaff)}>{showStaff ? 'Close staff register' : 'Open staff register'}</button>{showStaff && staffRegister}</div>}
    {editor && <EditDialog editor={editor} chapter={chapter} location={location} onClose={() => setEditor(null)} onSave={values => { file.update(chapterId, editor.collection, values, editor.row?.id); setEditor(null); setNotice('Entry saved in this tab. Save file to keep your changes.'); }}/>}
  </div>;
}
