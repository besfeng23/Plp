import React, { useState } from 'react';
import { ArrowRight, ClipboardCheck, ExternalLink, FileText, Plus, RefreshCw } from 'lucide-react';
import './owner-work.css';

export const chapters = [
 ['boracay','Boracay'],['singapore','Singapore / Changi'],['malaysia','Malaysia'],['global','All locations'],
];
export const kinds = [
 ['decision','Decision'],['note','Private note'],['document','Document link'],['partner','Partner'],['milestone','Milestone'],
];
export const statuses = [
 ['needs_decision','Needs decision'],['needs_verification','Needs verification'],['reviewed','Owner reviewed'],['archived','Archived'],
];
const blank = { chapter:'boracay',kind:'decision',title:'',details:'',status:'needs_decision',priority:'normal',due_on:'',reference_url:'' };
const label = (pairs,value) => pairs.find(([key])=>key===value)?.[1]||value;
function Form({ initial = blank, onSave, onClose, busy }) {
 const [form,setForm]=useState({...blank,...initial,due_on:initial.due_on||'',reference_url:initial.reference_url||''});
 const set=(name,value)=>setForm(state=>({...state,[name]:value}));
 return <form className="owner-work-form" onSubmit={e=>{e.preventDefault();onSave({
   ...form,due_on:form.due_on||null,reference_url:form.reference_url||null,
 })}}>
   <div className="owner-work-fields"><label>Type<select value={form.kind} onChange={e=>set('kind',e.target.value)}>{kinds.map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
     <label>Chapter<select value={form.chapter} onChange={e=>set('chapter',e.target.value)}>{chapters.map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label></div>
   <label>Title<input value={form.title} maxLength={160} required onChange={e=>set('title',e.target.value)} placeholder="A decision, proposal or document reference"/></label>
   <label>Notes<textarea value={form.details} maxLength={2000} rows={3} onChange={e=>set('details',e.target.value)} placeholder="Context, owner instruction, evidence still needed"/></label>
   <div className="owner-work-fields"><label>Review status<select value={form.status} onChange={e=>set('status',e.target.value)}>{statuses.map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
     <label>Priority<select value={form.priority} onChange={e=>set('priority',e.target.value)}><option value="normal">Normal</option><option value="high">High</option></select></label></div>
   <div className="owner-work-fields"><label>Target date (optional)<input type="date" value={form.due_on} onChange={e=>set('due_on',e.target.value)}/></label>
     <label>Evidence or document URL (optional)<input type="url" value={form.reference_url} maxLength={1000} pattern="https://.*" onChange={e=>set('reference_url',e.target.value)} placeholder="https://…"/></label></div>
   <div className="owner-work-actions"><button className="owner-primary" type="submit" disabled={busy||!form.title.trim()}>{busy?'Saving…':initial.id?'Save changes':'Add to private register'}</button>
     <button className="owner-secondary" type="button" onClick={onClose}>Cancel</button></div>
   <p className="owner-work-help">Marking an item “Owner reviewed” records a planning decision only; it does not publish prices, activate membership, approve residency or change live resort operations.</p>
 </form>;
}
export default function OwnerWorkItems({items=[],status='loading',error='',busy=false,onCreate,onUpdate,onReload,filterKind=null,filterChapter=null,title='Private work register',onHistory}) {
 const [kind,setKind]=useState(filterKind||'all'),[chapter,setChapter]=useState(filterChapter||'all'),[state,setState]=useState('active');
 const [editing,setEditing]=useState(null),[creating,setCreating]=useState(false);
 const [history,setHistory]=useState({});
 const visible=items.filter(item=>(filterKind?item.kind===filterKind:kind==='all'||item.kind===kind)
   &&(filterChapter?item.chapter===filterChapter:chapter==='all'||item.chapter===chapter)
   &&(state==='all'||(state==='active'&&item.status!=='archived')||item.status===state));
 const save=async payload=>{
   try {
     if(editing)await onUpdate(editing.id,editing.updated_at,payload);
     else await onCreate(payload);
     setEditing(null);setCreating(false);
   }catch{ /* Parent surfaces backend error. Keep the draft form open. */ }
 };
 const [openId,setOpenId]=useState(null);
 return <section className="owner-panel owner-work-panel" aria-label={title}>
  <div className="owner-work-heading"><div><h3>{title}</h3><p className="owner-note">Owner-managed PLP planning records, stored privately with change history.</p></div>
    <div className="owner-work-actions"><button className="owner-secondary" type="button" onClick={onReload} disabled={busy}><RefreshCw size={15}/> Refresh</button>
      <button className="owner-primary" type="button" onClick={()=>{setCreating(true);setEditing(null)}}><Plus size={15}/> New item</button></div></div>
  {creating&&<Form key="new" initial={{...blank,kind:filterKind||'decision',chapter:filterChapter||'boracay'}} onSave={save} onClose={()=>setCreating(false)} busy={busy}/>}
  {error&&<p className="owner-work-error" role="alert">{error}</p>}
  {!filterKind||!filterChapter?<div className="owner-work-filters">
    {!filterKind&&<label>Record type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All types</option>{kinds.map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>}
    {!filterChapter&&<label>Location<select value={chapter} onChange={e=>setChapter(e.target.value)}><option value="all">All chapters</option>{chapters.map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>}
    <label>Review state<select value={state} onChange={e=>setState(e.target.value)}><option value="active">Active</option><option value="all">All, including archived</option>{statuses.slice(0,3).map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
  </div>:null}
  {status==='loading'?<p role="status" className="owner-note">Loading the private owner register…</p>
    :status==='error'?<p role="alert" className="owner-note">Private register unavailable. The saved records were not changed.</p>
    :!visible.length?<p className="owner-work-empty">No matching owner records. Choose “New item” to create the first saved decision, note or document reference.</p>
    :<div className="owner-work-list">{visible.map(item=><article key={item.id} className="owner-work-item">
      <div className="owner-work-item-head"><div><span className="owner-eyebrow">{label(kinds,item.kind)} · {label(chapters,item.chapter)}</span><h4>{item.title}</h4></div>
        <span className="owner-pill">{label(statuses,item.status)}</span></div>
      {item.details&&<p>{item.details}</p>}
      <div className="owner-work-meta">{item.priority==='high'&&<strong>High priority</strong>}
        {item.due_on&&<span>Target: {item.due_on}</span>}
        <span>Updated: {new Date(item.updated_at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila'})}</span>
        {item.reference_url&&<a href={item.reference_url} target="_blank" rel="noopener noreferrer">Evidence or document <ExternalLink size={13}/></a>}</div>
      <div className="owner-work-actions"><button type="button" className="owner-text-button" onClick={()=>{setCreating(false);setEditing(item);setOpenId(openId===item.id?null:item.id)}}>{editing?.id===item.id&&openId===item.id?'Close editor':'Edit item'} <ArrowRight size={14}/></button>
        <button type="button" className="owner-text-button" disabled={busy} onClick={async()=>{try{const lines=await onHistory(item.id);setHistory(s=>({...s,[item.id]:lines}));}catch{setHistory(s=>({...s,[item.id]:null}))}}}>Activity history</button></div>
      {editing?.id===item.id&&openId===item.id&&<Form key={item.id} initial={item} onSave={save} onClose={()=>{setEditing(null);setOpenId(null)}} busy={busy}/>}
      {Object.prototype.hasOwnProperty.call(history,item.id)&&<div className="owner-work-history"><strong>Recorded change history</strong>
        {Array.isArray(history[item.id])&&history[item.id].length?history[item.id].map((h,i)=><p key={i}>{h.created_at?.slice(0,10)} · {h.action} · {label(statuses,h.new_status)}</p>):<p>History unavailable.</p>}</div>}
    </article>)}</div>}
 </section>;
}
