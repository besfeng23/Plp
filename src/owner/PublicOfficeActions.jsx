import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, ExternalLink } from 'lucide-react';
import './owner-public-actions.css';

// These are public PLP website links and published sessions only.
// No owner tokens, analytics, identity, members, enquiries or financial data.
const routes = {
 overview:[['Visit the resort website','/'],['Explore Pearl Club','/club'],['Request a reservation','/booking']],
 analytics:[['View the public website','/'],['Read analytics privacy policy','/privacy-policy']],
 performance:[['View accommodations','/accommodation'],['Request a booking','/booking'],['Open staff operations login','/admin']],
 club:[['See Pearl Club information','/club'],['Apply for Pearl Club','/club'],['Contact PLP concierge','/contact']],
 decisions:[['Public PLP website','/'],['Owner verification information','/privacy-policy']],
 expansion:[['PLP Boracay','/'],['PLP Singapore / Changi','https://plp-changi.vercel.app/']],
 reports:[['View current reservation policy','/reservation-policy'],['Contact PLP','/contact']],
 security:[['Privacy policy','/privacy-policy'],['Terms of service','/terms-of-service']],
};
function PublicSessions(){
 const [state,setState]=useState('loading'),[sessions,setSessions]=useState([]);
 useEffect(()=>{
   const controller=new AbortController();
   fetch('/api/plp?action=club&operation=activities',{signal:controller.signal,credentials:'omit',cache:'no-store'})
    .then(async response=>{if(!response.ok)throw new Error();const body=await response.json();
       if(body.ok!==true||!Array.isArray(body.activities))throw new Error();
       if(!controller.signal.aborted){setSessions(body.activities.slice(0,5));setState('ready');}
    }).catch(()=>{if(!controller.signal.aborted)setState('error')});
   return()=>controller.abort();
 },[]);
 return <section className="owner-panel"><h3>Publicly announced Pearl Club activities</h3>
   {state==='loading'&&<p role="status" className="owner-note">Checking the published programme…</p>}
   {state==='error'&&<p role="alert" className="owner-note">The published calendar is temporarily unavailable.</p>}
   {state==='ready'&&sessions.length===0&&<p className="owner-note">No published upcoming activities have been recorded for Boracay.</p>}
   {state==='ready'&&sessions.length>0&&<div className="owner-rows">{sessions.map(a=><div key={a.id}>
     <span>{a.title}</span><strong>{new Date(a.starts_at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric'})}</strong>
   </div>)}</div>}
 </section>;
}
export default function PublicOfficeActions({section}){
 const items=routes[section]||routes.overview;
 return <><section className="owner-panel"><h3>Working PLP links</h3>
   <p className="owner-note">Open the existing public site, booking request and Pearl Club pages directly. Private staff and owner records still require their respective sign-ins.</p>
   <div className="owner-public-actions">{items.map(([title,href])=><a key={title} href={href} target={href.startsWith('http')?'_blank':undefined} rel={href.startsWith('http')?'noopener noreferrer':undefined}>
     {title} {href.startsWith('http')?<ExternalLink size={15}/>:<ArrowRight size={15}/>}</a>)}</div>
 </section>{section==='club'&&<PublicSessions/>}</>;
}
