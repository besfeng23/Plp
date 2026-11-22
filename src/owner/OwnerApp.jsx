import React, { useEffect, useState } from 'react';
import PublicPreview from './PublicPreview.jsx';
import OwnerWorkItems from './OwnerWorkItems.jsx';
import OwnerReports from './OwnerReports.jsx';
import { ArrowRight, BarChart3, CalendarDays, ClipboardCheck, FileText, House, LockKeyhole, LogOut, Menu, RefreshCcw, ShieldCheck, Sparkles, Users, X } from 'lucide-react';

const nav = [
 ['overview',House,'Overview'], ['analytics',BarChart3,'Website Analytics'],
 ['performance',CalendarDays,'Resort Performance'], ['club',Users,'Pearl Club'],
 ['decisions',ClipboardCheck,'My Decisions'], ['expansion',ArrowRight,'Expansion'],
 ['reports',FileText,'Reports & Documents'], ['security',ShieldCheck,'Private Office Settings'],
];
const important = [
 {title:'Boracay membership offers',state:'Needs decision',desc:'Membership tiers, benefits, pricing and member-facing terms require owner approval.'},
 {title:'First Pearl Club activity',state:'Needs verification',desc:'Confirm facilitator, schedule, accessibility and venue before publishing an activity.'},
 {title:'Singapore / Changi',state:'Needs verification',desc:'Verify venue authority and partner agreement before announcing Pearl Club access.'},
 {title:'Malaysia chapter',state:'Needs decision',desc:'Select a location and local operator. No Malaysian venue is confirmed.'},
];
const locations = [
 {name:'Boracay',tag:'First chapter',description:'Existing resort and Pearl Club application operations. Confirmed operational counts are shown when the source is available.',state:'Operating project'},
 {name:'Singapore · Changi',tag:'Proposed',description:'Pearl Club programme and venue permissions remain subject to a separate agreement. No live PLP membership sales are assumed.',state:'Planning'},
 {name:'Malaysia',tag:'Location unconfirmed',description:'Site, operator, programme and membership terms require owner decisions and local validation.',state:'Planning'},
];
const cardLabel = (number) => number == null ? '—' : Number(number).toLocaleString('en-PH');
const thisMonth = () => new Date(Date.now() + 28800000).toISOString().slice(0,7);
async function ownerRequest(action, options={}) {
 const url = '/api/plp?action=owner&operation=' + encodeURIComponent(action) + (options.month ? '&month='+encodeURIComponent(options.month):'') + (options.id ? '&id='+encodeURIComponent(options.id):'');
 const response = await fetch(url,{ method:options.method||'GET',cache:'no-store',
   credentials:'same-origin',headers:{'Content-Type':'application/json'},body:options.body?JSON.stringify(options.body):undefined,signal:options.signal });
 const result = await response.json().catch(()=>({}));
 if(!response.ok||result.ok===false)throw Object.assign(new Error(result.error||'Private office unavailable'),{status:response.status});
 return result;
}
function LogIn({onAuthenticated}) {
 const [state,setState]=useState('checking'),[message,setMessage]=useState(''),[code,setCode]=useState('');
 useEffect(()=>{
   let alive=true;
   const fragment=new URLSearchParams(window.location.hash.replace(/^#/,''));
   const token=fragment.get('access_token');
   const error=fragment.get('error_description')||fragment.get('error');
   if(window.location.hash)window.history.replaceState(null,'',window.location.pathname+window.location.search);
   (async()=>{
     try {
       if(token) {await ownerRequest('session',{method:'POST',body:{accessToken:token}});if(alive){onAuthenticated();return;}}
       const current=await ownerRequest('me');if(current.role==='owner'){if(alive)onAuthenticated();return;}
     }catch{ /* A new, unauthenticated visitor sees the private sign-in screen. */ }
     if(alive){setState('ready');if(error||token)setMessage('Sign-in could not be completed. Request another private link.');}
   })();
   return()=>{alive=false};
 },[onAuthenticated]);
 async function send(e) {
   e.preventDefault();setState('sending');setMessage('');
   try{await ownerRequest('login',{method:'POST',body:{}});setState('sent');setMessage('A private sign-in email has been requested for the registered owner. Open it on this device.');}
   catch(err){setState('ready');setMessage(err.message);}
 }
 async function verify(e){
   e.preventDefault();setState('sending');setMessage('');
   try{await ownerRequest('verify',{method:'POST',body:{code}});setCode('');onAuthenticated();}
   catch(err){setState('ready');setMessage(err.message);}
 }
 return <main className="owner-login">
   <div className="owner-login-aside"><img src="/brand/PLP_Editorial_Reversed_Ivory.svg" alt="Pueblo La Perla oval crest"/><span>PUEBLO LA PERLA · PRIVATE OFFICE</span><h1>A more considered view of your business.</h1><p>Resort performance, membership, decisions and expansion, together in one secure executive workspace.</p></div>
   <div className="owner-login-main"><div className="owner-login-card"><img src="/brand/PLP_Editorial_Vector_Logo.svg" alt="" className="owner-login-crest"/><span className="owner-eyebrow">PRIVATE OWNER ACCESS</span>
     <h2>Welcome, Doctora.</h2><p>This workspace is restricted to the verified PLP owner. A staff access code cannot open it.</p>
     <form onSubmit={send}><button className="owner-primary" disabled={state==='checking'||state==='sending'} type="submit"><LockKeyhole size={17}/> {state==='sending'?'Verifying…':state==='checking'?'Checking access…':'Send my private sign-in link'}</button></form>
     {message&&<p className="owner-login-notice" role="status">{message}</p>}
     {state!=='checking'&&<form onSubmit={verify} className="owner-login-otp"><label htmlFor="owner-otp">If your email contains a one-time code, enter it here</label><div><input id="owner-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" maxLength={8} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="6–8 digit code"/><button className="owner-secondary" disabled={state==='sending'||!/^[0-9]{6,8}$/.test(code)} type="submit">Verify code</button></div></form>}
     <small>Owner identity is checked against the approved email account. No access is granted from the public website or the staff login.</small>
   </div></div>
 </main>;
}
function Panel({label,children,className=''}){return <section className={'owner-panel '+className}><h3>{label}</h3>{children}</section>}
function Kpi({label,value,note,attention}){return <div className={'owner-kpi'+(attention?' owner-kpi-alert':'')}><span>{label}</span><strong>{cardLabel(value)}</strong><small>{note}</small></div>}
function Unavailable({title}){return <div className="owner-empty"><ShieldCheck size={18}/><div><strong>{title} unavailable</strong><p>The protected source did not return a verified figure. No estimate is displayed.</p></div></div>}
function DecisionCards({items=[],limit}) {
 const decisions=items.filter(x=>x.kind==='decision'&&!['archived','reviewed','approved','declined'].includes(x.status)).slice(0,limit||items.length);
 if(!decisions.length)return <p className="owner-note">No outstanding decisions have been recorded in the private owner register.</p>;
 return <div className="owner-decision-list">{decisions.map((item,index)=><article key={item.id} className="owner-decision">
   <span className="owner-decision-index">{String(index+1).padStart(2,'0')}</span>
   <div><strong>{item.title}</strong><p>{item.details||'Owner review required'}</p></div>
   <span className="owner-pill">{item.status==='needs_verification'?'Needs verification':'Needs decision'}</span>
 </article>)}</div>;
}
function Overview({report,onNavigate,items}) {
 const b=report?.websiteBookings,club=report?.club,tasks=report?.tasks;
 return <>
 <div className="owner-kpis"><Kpi label="Website booking requests" value={b?.requests} note="Selected month · not confirmed revenue"/><Kpi label="Reservations confirmed" value={b?.confirmed} note="Website requests with confirmed/completed status"/><Kpi label="Pearl Club · pending" value={club?.pending} attention note="Boracay applications awaiting review"/><Kpi label="Open staff tasks" value={tasks?.open} note="Outstanding recorded operational tasks"/></div>
 <div className="owner-two"><Panel label="Needs your attention"><DecisionCards limit={3} items={items}/><button className="owner-text-button" onClick={()=>onNavigate('decisions')}>Review decisions <ArrowRight size={16}/></button></Panel>
 <Panel label="Pearl Club · Boracay"><div className="owner-metric-stack"><div><span>Active members</span><strong>{cardLabel(club?.active)}</strong></div><div><span>Pending applications</span><strong>{cardLabel(club?.pending)}</strong></div><div><span>Published future activities</span><strong>{cardLabel(club?.upcoming)}</strong></div></div><p className="owner-note">Live counts are read from the existing protected Boracay club records. Proposed benefits and pricing are not assumed.</p><button className="owner-text-button" onClick={()=>onNavigate('club')}>View Pearl Club <ArrowRight size={16}/></button></Panel></div>
 <Panel label="Your PLP chapters"><div className="owner-chapter-strip">{locations.map(loc=><article key={loc.name}><span>{loc.tag}</span><strong>{loc.name}</strong><small>{loc.state}</small></article>)}</div><button className="owner-text-button" onClick={()=>onNavigate('expansion')}>Review expansion <ArrowRight size={16}/></button></Panel>
 </>;
}
function Performance({report}) {
 const b=report?.websiteBookings;
 return <><div className="owner-kpis"><Kpi label="Website requests" value={b?.requests} note="Received in the reporting month"/><Kpi label="Confirmed/completed" value={b?.confirmed} note="Current recorded reservation status"/><Kpi label="Closed/expired" value={b?.closed} note="Canceled, void or expired"/><Kpi label="Other statuses" value={b?.other} note="Not independently verified payment"/></div>
 <div className="owner-two"><Panel label="Accommodation demand">{b?b.rooms.length?<div className="owner-rows">{b.rooms.map(room=><div key={room.name}><span>{room.name}</span><strong>{cardLabel(room.requests)} requests</strong></div>)}</div>:<p className="owner-note">No website reservations recorded for this month.</p>:<Unavailable title="Reservation report"/>}</Panel>
 <Panel label="Today · Resort operations">{report?.today?<div className="owner-metric-stack">
 <div><span>Arrivals</span><strong>{report.today.arriving}</strong></div><div><span>In house (confirmed)</span><strong>{report.today.inHouse}</strong></div><div><span>Departures</span><strong>{report.today.departing}</strong></div>
 </div>:<Unavailable title="Daily stay report"/>}<p className="owner-note">Today's recorded stay dates, not independent occupancy reconciliation.</p></Panel>
 <Panel label="Guest & membership enquiries">{report?.enquiries?<div className="owner-metric-stack">
 <div><span>Enquiries recorded</span><strong>{report.enquiries.total}</strong></div>
 <div><span>New enquiries</span><strong>{report.enquiries.new}</strong></div>
 <div><span>Pearl Club enquiries</span><strong>{report.enquiries.club}</strong></div>
 </div>:<Unavailable title="Enquiry report"/>}</Panel>
 <Panel label="Operational management"><p className="owner-note">For authorized staff actions, use the existing protected PLP Resort Command. This owner overview does not bypass staff verification or mutate guest, payment or booking records.</p><a className="owner-text-button" href="/admin">Open PLP Admin <ArrowRight size={15}/></a></Panel>
 <Panel label="Financial overview"><div className="owner-empty"><BarChart3 size={20}/><div><strong>Accounting-grade figures not connected</strong><p>Reservation counts are not confirmed payments or audited financial statements. No estimate of cash flow, profit or occupancy is displayed.</p></div></div></Panel></div></>;
}
function Club({report,items,onNavigate}){const c=report?.club;return <><div className="owner-kpis"><Kpi label="Applications to review" value={c?.pending} attention note="Boracay chapter only"/><Kpi label="Active memberships" value={c?.active} note="Protected PLP roster"/><Kpi label="Upcoming published activities" value={c?.upcoming} note="Future dates recorded in operations"/><Kpi label="Additional chapters" value={null} note="Singapore and Malaysia remain in planning"/></div>
 <Panel label="Pearl Club · Owner direction"><p className="owner-note">Define and authorize senior membership tiers, eligibility, benefits, activities, and application terms. The current planning workbook is separate from live member records. Approval of a working-file item does not publish an offer.</p><DecisionCards limit={2} items={items}/></Panel>
 <Panel label="Published Boracay activities">{report?.club?.publishedActivities?.length?<div className="owner-rows">{report.club.publishedActivities.map((activity,i)=><div key={i}>
 <span>{activity.title}</span><strong>{new Date(activity.starts_at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'})}</strong>
 </div>)}</div>:<p className="owner-note">No published future club sessions are recorded. Do not publish unverified schedules.</p>}</Panel>
 <Panel label="Location boundaries"><div className="owner-rows"><div><span>Boracay</span><strong>First chapter</strong></div><div><span>Singapore / Changi</span><strong>Proposed · unverified permissions</strong></div><div><span>Malaysia</span><strong>No confirmed venue</strong></div></div></Panel></>;
}
function Breakdown({title,rows,empty='No breakdown data is available.'}) {
 return <Panel label={title}>{rows?.length?<div className="owner-rows">{rows.map((row,i)=><div key={i}><span>{row.label}</span><strong>{cardLabel(row.value)}</strong></div>)}</div>:<p className="owner-note">{empty}</p>}</Panel>;
}
function Analytics({data,status,month,posthogData,posthogStatus}) {
 const values=data?.metrics;
 const numbers=[['Page views','pageViews'],['Reserve clicks','reserveClicks'],['Booking starts','bookingStarts'],['Pearl Club enquiries','clubEnquiries'],['Booking requests','bookingRequests'],['Concierge enquiries','enquiries']];
 const max=Math.max(1,...(data?.daily||[]).map(x=>x.pageViews));
 const ph=posthogData?.metrics;
 return <>
 {status==='loading'&&<Panel label="First-party website analytics">Loading consented event data…</Panel>}
 {status==='error'&&<Unavailable title="First-party website analytics"/>}
 {status==='limited'&&<Panel label="First-party website analytics">Event volume exceeded the complete reporting limit. Partial totals are intentionally hidden.</Panel>}
 {status==='ready'&&data&&!data.complete&&<Unavailable title="Complete first-party analytics"/>}
 {status==='ready'&&values&&<><div className="owner-kpis">{numbers.map(([label,key])=><Kpi key={key} label={label} value={values[key]} note="First-party consented event count"/>)}</div>
   <div className="owner-two"><Panel label="Daily page views"><div className="owner-chart" role="img" aria-label={'Daily consented page views in '+month}>{data.daily.map(d=><div title={d.date+': '+d.pageViews+' views'} key={d.date}><span style={{height:(100*d.pageViews/max)+'%'}}/><small>{Number(d.date.slice(-2))%5===0?Number(d.date.slice(-2)):''}</small></div>)}</div></Panel>
   <Panel label="Actions on the website"><div className="owner-rows">{data.actionCounts.map(row=><div key={row.event}><span>{row.event.replaceAll('_',' ')}</span><strong>{cardLabel(row.count)}</strong></div>)}</div></Panel></div>
   <Panel label="Most viewed pages · first-party">{data.topPages.length?<div className="owner-table-wrap"><table><thead><tr><th>Page</th><th>Views</th><th>Actions</th><th>Enquiries</th></tr></thead><tbody>{data.topPages.map(page=><tr key={page.path}><th>{page.path}</th><td>{cardLabel(page.pageViews)}</td><td>{cardLabel(page.actions)}</td><td>{cardLabel(page.enquiries)}</td></tr>)}</tbody></table></div>:<p className="owner-note">No consented page events were recorded in this reporting month.</p>}</Panel>
 </>}
 <Panel label="PostHog visitor intelligence">
   {posthogStatus==='loading'&&<p className="owner-note" role="status">Loading aggregated PostHog visitor intelligence…</p>}
   {posthogStatus==='not_connected'&&<div className="owner-empty"><ShieldCheck size={18}/><div><strong>Not connected</strong><p>Public-site PostHog capture is configured separately. Add a PostHog personal API key named <code>POSTHOG_PERSONAL_API_KEY</code> to the PLP Vercel production environment to enable private visitor reports. The key is never sent to the browser.</p></div></div>}
   {posthogStatus==='error'&&<Unavailable title="PostHog visitor report"/>}
   {posthogStatus==='unavailable'&&<p className="owner-note">PostHog is configured but its query service did not return a complete report. Retry later; no partial totals are shown.</p>}
   {posthogStatus==='connected'&&ph&&<>
     <div className="owner-kpis"><Kpi label="Unique visitors" value={ph.uniqueVisitors} note="Distinct pseudonymous pageview IDs"/><Kpi label="Sessions" value={ph.sessions} note="Distinct PostHog session IDs"/><Kpi label="Page views" value={ph.pageViews} note="PostHog public pageview events"/><Kpi label="Autocaptured clicks" value={ph.autocaptureClicks} note="Public links and buttons only"/><Kpi label="Booking interest" value={ph.bookingInterest} note="Explicit reserve-intent events"/></div>
     <div className="owner-two"><Breakdown title="Top pages" rows={posthogData.topPages}/><Breakdown title="Referring sources" rows={posthogData.referrers}/><Breakdown title="Countries" rows={posthogData.countries} empty="No country enrichment is present in the returned events."/><Breakdown title="Devices" rows={posthogData.devices}/></div>
     <Panel label="Booking-interest funnel"><div className="owner-metric-stack">
       <div><span>Booking interest</span><strong>{cardLabel(posthogData.funnel?.interest)}</strong></div>
       <div><span>Booking started after interest</span><strong>{cardLabel(posthogData.funnel?.started)}</strong></div>
       <div><span>Reservation request submitted after start</span><strong>{cardLabel(posthogData.funnel?.submitted)}</strong></div>
       <div><span>Booking record created after submission</span><strong>{cardLabel(posthogData.funnel?.created)}</strong></div>
     </div><p className="owner-note">Distinct pseudonymous visitors, in event order, within the selected month. These are not paid bookings or revenue.</p></Panel>
     <p className="owner-note">Source: PostHog project 526760. Only consented public-site events are included. Session replay is disabled.</p>
   </>}
 </Panel>
 <p className="owner-disclosure">First-party event counts and PostHog visitor estimates are separate sources. Declined analytics choices are excluded. No form values, identities or booking details are sent to PostHog.</p>
 </>;
}
function Expansion({items=[],navigate}){return <><div className="owner-chapter-grid">{locations.map((loc,i)=><article className="owner-panel" key={loc.name}>
 <span className="owner-eyebrow">{loc.tag}</span><h3>{loc.name}</h3><p className="owner-note">{loc.description}</p>
 <div className="owner-metric-stack"><div><span>Owner work items</span><strong>{items.filter(item=>item.chapter===['boracay','singapore','malaysia'][i]&&item.status!=='archived').length}</strong></div></div>
 <span className="owner-pill">{loc.state}</span>
 </article>)}</div><section className="owner-panel"><h3>Expansion work register</h3>
 <p className="owner-note">Maintain location-specific partner checks, pricing and policy decisions in the private register. The expansion chapters are not represented as operational or approved.</p>
 <div className="owner-rows">{items.filter(item=>['singapore','malaysia'].includes(item.chapter)&&item.status!=='archived').slice(0,12).map(item=><div key={item.id}>
 <span>{item.title} · {item.chapter}</span><strong>{item.status.replaceAll('_',' ')}</strong></div>)}</div>
 <button className="owner-text-button" type="button" onClick={()=>navigate('decisions')}>Open editable register <ArrowRight size={15}/></button>
 </section></>}

function Security({owner,onSignOut}){return <div className="owner-two"><Panel label="Authorized owner"><div className="owner-metric-stack"><div><span>Account</span><strong>{owner.email}</strong></div><div><span>Role</span><strong>PLP Owner</strong></div><div><span>Session</span><strong>Verified owner account</strong></div></div><button className="owner-primary" onClick={onSignOut}><LogOut size={17}/> Sign out</button></Panel><Panel label="Privacy and permissions"><p className="owner-note">The private office has its own email-verification and server-issued HttpOnly owner session. The shared PLP staff code cannot open owner reports. All business reports are read-only and require owner authorization on every request. A detailed per-staff role administration system is not yet activated.</p></Panel></div>}
function ApprovalHistory({items=[],status='loading',onRefresh}) {
 return <Panel label="Executive approvals & staff task tracking">
  <div className="owner-work-heading"><p className="owner-note">Every approval or decline creates a task in the existing PLP staff worklog. Status changes are retained in the audit trail.</p>
   <button type="button" className="owner-secondary" onClick={onRefresh}><RefreshCcw size={14}/> Refresh</button></div>
  {status==='loading'?<p className="owner-note">Loading approval and task history…</p>
   :status==='error'?<p className="owner-note">Approval history is temporarily unavailable.</p>
   :!items.length?<p className="owner-work-empty">No owner approvals or declines have been recorded yet.</p>
   :<div className="owner-work-list">{items.map(item=><article className="owner-work-item" key={item.id}>
     <div className="owner-work-item-head"><div><span className="owner-eyebrow">{item.decision==='approved'?'Approved':'Declined'} · {item.created_at?.slice(0,10)}</span><h4>{item.task?.title||'Staff follow-up task'}</h4></div><span className="owner-pill">{item.task?.status||'Task unavailable'}</span></div>
     <div className="owner-work-meta"><span>Assigned to: {item.task?.assigned_to_label||item.assigned_to_label}</span><span>Due: {item.task?.due_on||item.due_on}</span></div>
     {item.notes&&<p>{item.notes}</p>}
     {item.history?.length>0&&<div className="owner-work-history"><strong>Task audit history</strong>{item.history.map((event,i)=><p key={i}>{event.created_at?.slice(0,16).replace('T',' ')} · {event.action.replaceAll('_',' ')} · {event.previous_status||'—'} → {event.new_status||'—'} · {event.actor||'staff'}</p>)}</div>}
   </article>)}</div>}
 </Panel>;
}
function PrivateOffice({onSignOut}) {
 const [tab,setTab]=useState('overview'),[month,setMonth]=useState(thisMonth);
 const [summary,setSummary]=useState(null),[status,setStatus]=useState('loading');
 const [behavior,setBehavior]=useState(null),[behaviorStatus,setBehaviorStatus]=useState('idle');
 const [posthogData,setPosthogData]=useState(null),[posthogStatus,setPosthogStatus]=useState('idle');
 const [refresh,setRefresh]=useState(0),[mobile,setMobile]=useState(false),[owner,setOwner]=useState(null);
 const [items,setItems]=useState([]),[itemsStatus,setItemsStatus]=useState('loading'),[itemsError,setItemsError]=useState(''),[itemsBusy,setItemsBusy]=useState(false);
  const [approvals,setApprovals]=useState([]),[approvalsStatus,setApprovalsStatus]=useState('idle');
  const [staff,setStaff]=useState([]),[staffStatus,setStaffStatus]=useState('idle');
 async function loadItems(){setItemsStatus('loading');try{const res=await ownerRequest('items');setItems(res.items);setItemsStatus('ready');setItemsError('');}
   catch(err){setItemsStatus('error');setItemsError(err.message);if(err.status===401)onSignOut(true);}}
 useEffect(()=>{void loadItems();},[refresh]);
  useEffect(()=>{if(tab==='decisions'){void loadApprovals();void loadStaff();}},[tab,refresh]);
 async function createItem(payload){
   setItemsBusy(true);setItemsError('');
   try{await ownerRequest('items',{method:'POST',body:payload});await loadItems();}
   catch(e){setItemsError(e.message);throw e;}finally{setItemsBusy(false)}
 }
 async function updateItem(itemId,updatedAt,payload){
   setItemsBusy(true);setItemsError('');
   try{await ownerRequest('items',{method:'PATCH',body:{...payload,id:itemId,updated_at:updatedAt}});await loadItems();}
   catch(e){setItemsError(e.message);throw e;}finally{setItemsBusy(false)}
 }
 async function loadHistory(id){const r=await ownerRequest('item-history',{id});return r.history;}
  async function loadApprovals(){
    setApprovalsStatus('loading');
    try{const r=await ownerRequest('approvals');setApprovals(r.approvals||[]);setApprovalsStatus('ready');}
    catch(err){setApprovalsStatus('error');if(err.status===401)onSignOut(true);}
  }
  async function loadStaff(){
    setStaffStatus('loading');
    try{const r=await ownerRequest('staff-directory');setStaff(r.staff||[]);setStaffStatus('ready');}
    catch(err){setStaffStatus('error');if(err.status===401)onSignOut(true);}
  }
  async function decideItem(itemId,payload){
    setItemsBusy(true);setItemsError('');
    try{await ownerRequest('decide',{method:'POST',body:{id:itemId,...payload}});await loadItems();await loadApprovals();}
    catch(e){setItemsError(e.message);throw e;}finally{setItemsBusy(false);}
  }
 async function fetchBehavior(){const report=await ownerRequest('behavior',{month});if(!report.complete)throw new Error('Analytics report incomplete');return report;}

 useEffect(()=>{ownerRequest('me').then(setOwner).catch(()=>onSignOut(true));},[onSignOut]);
 useEffect(()=>{
   let alive=true;const ctrl=new AbortController();setStatus('loading');setSummary(null);
   ownerRequest('summary',{month,signal:ctrl.signal}).then(r=>{if(alive){setSummary(r);setStatus('ready');}})
     .catch(err=>{if(alive){setStatus(err.status===401?'unauthorized':'error');if(err.status===401)onSignOut(true);}});
   return()=>{alive=false;ctrl.abort()};
 },[month,refresh,onSignOut]);
 useEffect(()=>{
   if(tab!=='analytics')return;
   let alive=true;const ctrl=new AbortController();setBehaviorStatus('loading');setBehavior(null);
   ownerRequest('behavior',{month,signal:ctrl.signal}).then(r=>{if(alive){setBehavior(r);setBehaviorStatus(r.complete?'ready':'limited')}})
     .catch(err=>{if(alive){setBehaviorStatus('error');if(err.status===401)onSignOut(true)}});
   return()=>{alive=false;ctrl.abort()};
 },[tab,month,refresh,onSignOut]);
  useEffect(()=>{
    if(tab!=='analytics')return;
    let alive=true;const ctrl=new AbortController();setPosthogStatus('loading');setPosthogData(null);
    ownerRequest('posthog-analytics',{month,signal:ctrl.signal}).then(r=>{
      if(alive){setPosthogData(r);setPosthogStatus(r.status||'unavailable');}
    }).catch(err=>{if(alive){setPosthogStatus('error');if(err.status===401)onSignOut(true)}});
    return()=>{alive=false;ctrl.abort()};
  },[tab,month,refresh,onSignOut]);
 const pageName=nav.find(([key])=>key===tab)?.[2]||'Overview';
 const needsSummary=['overview','performance','club'].includes(tab);
 const navigate=next=>{setTab(next);setMobile(false)};
 const b=summary?.websiteBookings;
 return <div className="owner-app">
  <aside className={'owner-sidebar'+(mobile?' is-open':'')} aria-label="PLP private owner navigation">
    <div className="owner-sidebar-brand"><img src="/brand/PLP_Editorial_Reversed_Ivory.svg" alt="Pueblo La Perla crest"/><div><span>PUEBLO LA PERLA</span><strong>Private Office</strong></div></div>
    <div className="owner-sidebar-person"><small>OWNER ACCOUNT</small><strong>Dr. Marichi Fong Ramos</strong><span>Executive oversight</span></div>
    <nav aria-label="Private Office sections">{nav.map(([key,Icon,label])=><button type="button" key={key} aria-current={tab===key?'page':undefined} className={'owner-nav-link'+(tab===key?' active':'')} onClick={()=>navigate(key)}><Icon size={18} strokeWidth={1.65}/>{label}</button>)}</nav>
    <div className="owner-sidebar-footer"><ShieldCheck size={15}/> Private, verified owner session</div>
  </aside>
  {mobile&&<button className="owner-overlay" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
  <main className="owner-main"><header className="owner-header"><button type="button" className="owner-menu" aria-label={mobile?'Close menu':'Open menu'} onClick={()=>setMobile(!mobile)}>{mobile?<X size={21}/>:<Menu size={21}/>}</button><div><span>PUEBLO LA PERLA BORACAY</span><strong>{pageName}</strong></div><div className="owner-header-actions"><span><ShieldCheck size={15}/> Owner access</span><button type="button" title="Refresh reports" aria-label="Refresh reports" onClick={()=>setRefresh(v=>v+1)}><RefreshCcw size={17}/></button></div></header>
   <div className="owner-content"><div className="owner-heading"><span className="owner-eyebrow">DOCTORA'S PRIVATE OFFICE</span><h1>{tab==='overview'?'Your business, at a glance.':pageName}</h1>
      <div><p>{tab==='overview'?'A considered view of resort performance, Pearl Club, and what needs your attention.':'Verified records, clearly separated from plans and unapproved programmes.'}</p>
        {['overview','analytics','performance','club'].includes(tab)&&<label className="owner-month-label">Reporting month <input aria-label="Reporting month" type="month" min="2020-01" max={thisMonth()} value={month} onChange={e=>{if(e.target.validity.valid&&e.target.value)setMonth(e.target.value)}}/></label>}</div>
   </div>
   {status==='loading'&&needsSummary&&<div className="owner-panel" role="status">Loading verified PLP records…</div>}
   {status==='error'&&needsSummary&&<Unavailable title="Owner business report"/>}
   {(status==='ready'||!needsSummary)&&<>
     {tab==='overview'&&<Overview report={summary} onNavigate={navigate} items={items}/>}
     {tab==='analytics'&&<Analytics data={behavior} status={behaviorStatus} month={month} posthogData={posthogData} posthogStatus={posthogStatus}/>}
     {tab==='performance'&&<Performance report={summary}/>}
     {tab==='club'&&<Club report={summary} items={items} onNavigate={navigate}/>}
     {tab==='decisions'&&<OwnerWorkItems items={items} status={itemsStatus} error={itemsError} busy={itemsBusy}
 onCreate={createItem} onUpdate={updateItem} onReload={loadItems} onHistory={loadHistory} onDecide={decideItem
  <ApprovalHistory items={approvals} status={approvalsStatus} onRefresh={loadApprovals}/>} staff={staff} staffStatus={staffStatus} title="Decisions, documents & follow-ups"/>}
     {tab==='expansion'&&<Expansion items={items} navigate={navigate}/>}
     {tab==='reports'&&<><OwnerReports month={month} summary={summary} behavior={behavior} items={items} onFetchBehavior={fetchBehavior}/>
 <OwnerWorkItems items={items} status={itemsStatus} error={itemsError} busy={itemsBusy} filterKind="document"
 onCreate={createItem} onUpdate={updateItem} onReload={loadItems} onHistory={loadHistory} title="Secure document reference register"/></>}
     {tab==='security'&&<Security owner={owner||{email:'Verified owner'}} onSignOut={()=>onSignOut(false)}/>}
   </>}
   {status==='ready'&&summary?.unavailable?.length>0&&<p className="owner-disclosure" role="status">Some source systems are temporarily unavailable: {summary.unavailable.join(', ')}. Unavailable figures appear as a dash, not zero.</p>}
   <footer className="owner-footer"><span>PUEBLO LA PERLA · PRIVATE OFFICE</span><span>Read-only owner reporting · Philippine time</span></footer>
   </div></main>
 </div>;
}
export default function OwnerApp(){
 // A temporary, passcode-free preview never requests protected owner data.
 // Supabase magic-link callbacks still enter the authenticated flow.
 const [mode,setMode]=useState(()=>window.location.hash.includes('access_token=')?'login':'preview');
 const checkOnce=React.useRef(false);
 useEffect(()=>{
   if(mode!=='preview'||checkOnce.current)return;
   checkOnce.current=true;
   let alive=true;
   // A previously verified owner opens the full dashboard automatically,
   // without re-entering a code or re-visiting the sign-in screen.
   ownerRequest('me').then(result=>{if(alive&&result.role==='owner')setMode('secure')}).catch(()=>{});
   return()=>{alive=false};
 },[mode]);
 async function signOut(expired=false){
   if(!expired){try{await ownerRequest('logout',{method:'POST',body:{}});}catch{ /* A failed sign-out cannot keep sensitive data visible. */ }}
   setMode('preview');
 }
 if(mode==='secure')return <PrivateOffice onSignOut={signOut}/>;
 if(mode==='login')return <LogIn onAuthenticated={()=>setMode('secure')}/>;
 return <PublicPreview onConnectPrivateData={()=>setMode('login')}/>;
}
