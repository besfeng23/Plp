import React, { useState } from 'react';
import { Download, Printer, RefreshCw, ExternalLink } from 'lucide-react';
import { chapters } from './OwnerWorkItems.jsx';
import './owner-work.css';

function cell(value) {
 let x=value==null?'':String(value);
 // Prevent spreadsheet formula execution when exports are opened in Excel.
 if (/^[=+@\-\t\r]/.test(x)) x="'"+x;
 return '"'+x.replace(/"/g,'""')+'"';
}
export function csv(rows) { return rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'; }
export function downloadCsv(name,rows) {
 const blob=new Blob(['\ufeff',csv(rows)],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 try {const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();}
 finally {setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export default function OwnerReports({month,summary,behavior,items=[],onFetchBehavior}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 function exportBooking(){
   if(!summary?.websiteBookings)return setError('Booking report is unavailable.');
   const b=summary.websiteBookings;
   downloadCsv('PLP-Boracay-Bookings-'+month+'.csv',[
     ['PLP Boracay','Monthly website booking report',month],
     ['Metric','Count'],['Website requests',b.requests],['Confirmed/completed',b.confirmed],
     ['Closed/expired',b.closed],['Other statuses',b.other],[],
     ['Accommodation','Website requests'],...b.rooms.map(r=>[r.name,r.requests]),[],
     ['Disclaimer','Booking status counts, not audited revenue or reconciled payments. Test records excluded.'],
   ]);
   setError('');
 }
 async function exportBehavior(){
   setBusy(true);setError('');
   try{
     const report=behavior?.month===month&&behavior?.complete?behavior:await onFetchBehavior();
     if(!report.complete)throw new Error('The report exceeds the safe event-count limit.');
     downloadCsv('PLP-Boracay-Website-Behavior-'+month+'.csv',[
       ['PLP Boracay','Consented anonymous website events',month],['Metric','Events'],
       ...Object.entries(report.metrics).map(([k,v])=>[k,v]),[],
       ['Date','Page views','Action events'],...report.daily.map(d=>[d.date,d.pageViews,d.actions]),[],
       ['Public page','Page views','Actions','Reserve clicks','Enquiries'],
       ...report.topPages.map(p=>[p.path,p.pageViews,p.actions,p.reserveClicks,p.enquiries]),[],
       ['Disclaimer','Anonymous consented events only; not unique visitors or linked conversions.'],
     ]);
   }catch(e){setError(e.message||'Analytics export unavailable')}finally{setBusy(false)}
 }
 function exportRegister(){
   downloadCsv('PLP-Owner-Work-Register-'+month+'.csv',[
     ['Type','Chapter','Title','Status','Priority','Target date','Notes','Evidence URL','Updated'],
     ...items.map(i=>[i.kind,i.chapter,i.title,i.status,i.priority,i.due_on,i.details,i.reference_url,i.updated_at]),
   ]);
 }
 return <div className="owner-two">
   <section className="owner-panel"><h3>Executive reports</h3>
     <p className="owner-note">Download actual source-backed CSV reports. They remain on this device after export, so store them securely.</p>
     <div className="owner-report-actions">
       <button type="button" className="owner-secondary" disabled={!summary?.websiteBookings} onClick={exportBooking}><Download size={16}/> Monthly booking report</button>
       <button type="button" className="owner-secondary" disabled={busy} onClick={exportBehavior}>{busy?<RefreshCw size={16}/>:<Download size={16}/>} Website behavior</button>
       <button type="button" className="owner-secondary" onClick={exportRegister}><Download size={16}/> Owner work register</button>
       <button type="button" className="owner-secondary" onClick={()=>window.print()}><Printer size={16}/> Print office view</button>
     </div>
     {error&&<p className="owner-work-error" role="alert">{error}</p>}
     <p className="owner-note">Reports distinguish booking requests and consented website events from completed payment, unique visitors, and financial statements.</p>
   </section>
   <section className="owner-panel"><h3>Documents & evidence</h3>
     <p className="owner-note">Owner document reference links are saved in the private work register. Document files themselves remain in their original authorized provider; no unaudited public file bucket is created.</p>
     <div className="owner-rows">{items.filter(i=>i.kind==='document'&&i.status!=='archived').slice(0,20).map(i=><div key={i.id}>
       <span>{i.title} · {chapters.find(([k])=>k===i.chapter)?.[1]||i.chapter}</span>
       {i.reference_url?<a href={i.reference_url} target="_blank" rel="noopener noreferrer">Open <ExternalLink size={14}/></a>:<strong>Link not supplied</strong>}
     </div>)}</div>
     {!items.some(i=>i.kind==='document'&&i.status!=='archived')&&<p className="owner-note">No owner document links recorded yet. Add one from the private work register.</p>}
   </section>
 </div>;
}
