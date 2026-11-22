import React, { useEffect, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { manilaToday } from './plpAdminModel.js';
import './website-analytics.css';

const cards = [
 ['Page views', 'pageViews', 'Not unique people'],
 ['Reserve clicks', 'reserveClicks', 'Reservation CTA actions'],
 ['Booking starts', 'bookingStarts', 'Booking-start events'],
 ['Booking requests', 'bookingRequests', 'Requests recorded, not paid stays'],
 ['Pearl Club enquiries', 'clubEnquiries', 'Club enquiry submissions'],
 ['Concierge enquiries', 'enquiries', 'Standard enquiry submissions'],
];
const labels = {
 click_reserve:'Reserve clicks',start_booking:'Booking starts',submit_booking:'Booking submits',
 booking_created:'Booking requests',submit_enquiry:'Concierge enquiries',
 submit_club_enquiry:'Pearl Club enquiries',submit_residential_interest:'Residential enquiries',
 select_room:'Room selections',click_email:'Email clicks',click_phone:'Phone clicks',
};
const missing = [
 ['Unique and returning visitors','No visitor identifiers are stored in first-party events'],
 ['Sessions, bounce and engagement time','Requires a verified external analytics property'],
 ['Countries, devices and referral channels','Requires a verified and approved analytics property'],
 ['Session replay, heatmaps and click paths','Not enabled; requires privacy review and recording consent'],
];
function DailyChart({ data }) {
 const top = Math.max(1, ...data.map(x=>x.pageViews));
 return <div className="plp-behavior-chart" role="img" aria-label="Daily consented site page views by local day">
   {data.map(d=><div className="plp-behavior-day" key={d.date} title={d.date+': '+d.pageViews+' views and '+d.actions+' actions'}>
     <span className="plp-behavior-bar" style={{height:(100*d.pageViews/top)+'%'}}/>
     <small>{Number(d.date.slice(-2))%5===0||d.date.endsWith('-01') ? Number(d.date.slice(-2)) : ''}</small>
   </div>)}
 </div>;
}
export default function WebsiteAnalytics({code, refreshedAt}) {
 const currentMonth=manilaToday().slice(0,7);
 const [month,setMonth]=useState(currentMonth), [retry,setRetry]=useState(0);
 const [status,setStatus]=useState('loading'), [report,setReport]=useState(null);
 useEffect(()=>{
   const ctrl=new AbortController();setStatus('loading');setReport(null);
   fetch('/api/admin?action=owner-behavior&month='+encodeURIComponent(month),{
     headers:{'X-PLP-Staff-Code':code},cache:'no-store',signal:ctrl.signal
   }).then(async response=>{
     if(!response.ok)throw new Error('Report unavailable');
     const value=await response.json();
     if(value.ok!==true||value.month!==month||typeof value.complete!=='boolean')throw new Error('Invalid report');
     if(!ctrl.signal.aborted){setReport(value);setStatus(value.complete?'ready':'limited');}
   }).catch(()=>{if(!ctrl.signal.aborted)setStatus('error');});
   return ()=>ctrl.abort();
 },[code,month,retry,refreshedAt]);
 return <div className="plp-behavior">
   <div className="plp-behavior-toolbar"><div><span className="plp-eyebrow">PLP Boracay · Owner insights</span><h2>Website performance</h2>
     <p>What visitors view and do, from consented anonymous website events.</p></div>
     <div className="plp-behavior-controls"><label className="plp-month-picker">Reporting month
       <input type="month" min="2000-01" max={currentMonth} value={month} onChange={e=>{if(e.target.value&&e.target.validity.valid)setMonth(e.target.value)}}/></label>
       <button className="plp-icon-btn" type="button" aria-label="Reload website analytics" onClick={()=>setRetry(v=>v+1)}><RefreshCw size={17}/></button></div>
   </div>
   {status==='loading'&&<p className="plp-panel" role="status">Loading consented website activity…</p>}
   {status==='error'&&<section className="plp-panel" role="alert"><h3>Analytics source unavailable</h3><p>Recorded visitor actions could not be verified. No numbers are estimated.</p>
     <button type="button" className="plp-secondary" onClick={()=>setRetry(v=>v+1)}>Retry</button></section>}
   {status==='limited'&&<section className="plp-panel" role="status"><h3>Reporting limit reached</h3><p>At least {report?.scanned} events were found. Partial totals are hidden to avoid misleading results.</p></section>}
   {status==='ready'&&report?.metrics&&<React.Fragment>
     <div className="plp-metrics plp-behavior-metrics">{cards.map(([name,key,detail])=><div className="plp-metric" key={key}><span>{name}</span><strong>{report.metrics[key].toLocaleString('en-PH')}</strong><small>{detail}</small></div>)}</div>
     {report.scanned===0&&<p className="plp-panel" role="status">No consented first-party events recorded this month. This does not mean there were no website visitors.</p>}
     <div className="plp-two-columns">
       <section className="plp-panel"><div className="plp-panel__head"><div><h3>Daily page views</h3><p>Recorded public page views in Philippine time.</p></div><BarChart3 size={19}/></div><DailyChart data={report.daily}/></section>
       <section className="plp-panel"><div className="plp-panel__head"><div><h3>Visitor actions</h3><p>Separate event counts, not a visitor-level funnel.</p></div></div>
         <div className="plp-behavior-actions">{report.actionCounts.map(x=><div className="plp-behavior-action" key={x.event}><span>{labels[x.event]||x.event}</span><strong>{x.count.toLocaleString('en-PH')}</strong></div>)}</div>
       </section>
     </div>
     <section className="plp-panel"><div className="plp-panel__head"><div><h3>Most viewed pages</h3><p>Popular pages and actions recorded on each page.</p></div></div>
       {report.topPages.length?<div className="plp-behavior-scroll" role="region" aria-label="Top site pages" tabIndex={0}><table className="plp-behavior-table">
         <thead><tr><th scope="col">Page</th><th scope="col">Views</th><th scope="col">Actions</th><th scope="col">Reserve clicks</th><th scope="col">Enquiries</th></tr></thead>
         <tbody>{report.topPages.map(p=><tr key={p.path}><th scope="row">{p.path}</th><td>{p.pageViews}</td><td>{p.actions}</td><td>{p.reserveClicks}</td><td>{p.enquiries}</td></tr>)}</tbody>
       </table></div>:<p>No classified public page activity recorded.</p>}
     </section>
   </React.Fragment>}
   <section className="plp-panel"><div className="plp-panel__head"><div><h3>Additional visitor intelligence</h3><p>Unavailable metrics are not displayed as zero.</p></div></div>
     <div className="plp-behavior-unavailable">{missing.map(([title,reason])=><div key={title}><strong>{title}</strong><span>{reason}</span></div>)}</div>
   </section>
   <p className="plp-disclosure">Source: existing PLP first-party database, after optional analytics consent only. Counts are events, not unique people or verified revenue; they exclude visits without consent. This screen uses the existing staff-code access gate, not a separate Doctora-only account. To add true unique visitors, sources, devices and retention, first verify a PLP-specific GA4 or PostHog property. Session recording remains disabled.</p>
 </div>;
}
