import React, { useState } from 'react';
import { ArrowRight, BarChart3, CalendarDays, ClipboardCheck, FileText, House, LockKeyhole, Menu, ShieldCheck, Users, X } from 'lucide-react';
import './owner-preview.css';

// No API calls, customer data, private decisions, member records or fabricated metrics.
// Publicly visible owner workspace structure only; the private API stays authenticated.
const pages = [
  { id: 'overview', label: 'Executive Overview', icon: House },
  { id: 'analytics', label: 'Website Analytics', icon: BarChart3 },
  { id: 'performance', label: 'Resort Performance', icon: CalendarDays },
  { id: 'club', label: 'Pearl Club', icon: Users },
  { id: 'decisions', label: 'My Decisions', icon: ClipboardCheck },
  { id: 'expansion', label: 'Expansion', icon: ArrowRight },
  { id: 'reports', label: 'Reports & Documents', icon: FileText },
  { id: 'security', label: 'Office Settings', icon: ShieldCheck },
];

const overview = [
  { label: 'Website booking requests', note: 'Requires verified private source' },
  { label: 'Pearl Club membership', note: 'Live member records are protected' },
  { label: 'Website visitor events', note: 'Only consented analytics records' },
  { label: 'Decisions awaiting review', note: 'Private approval queue not yet connected' },
];
const topics = {
  analytics: {
    title: 'Understand your visitors.',
    description: 'A private analytics area for website traffic, popular pages, booking interest, enquiries, and visitor journeys. Visitor-level analytics require a verified measurement provider.',
    labels: ['Website page views', 'Popular pages', 'Reservation clicks', 'Pearl Club enquiries'],
  },
  performance: {
    title: 'Your resort, clearly.',
    description: 'Review arrival activity, reservation requests, stay performance, exceptions, and reconciled figures when the owner data connection is active.',
    labels: ['Reservations', 'Arrivals and departures', 'Payment review', 'Occupancy'],
  },
  club: {
    title: 'A closer view of Pearl Club.',
    description: 'Membership status, applications, activities, attendance and chapter readiness remain restricted to authorized owner access.',
    labels: ['Member applications', 'Active memberships', 'Activity calendar', 'Attendance'],
  },
  decisions: {
    title: 'The decisions that matter.',
    description: 'A dedicated place for executive approvals, proposals and follow-ups. Actual approvals require permission controls and an audit trail.',
    labels: ['Proposals awaiting approval', 'Membership policies', 'Operational exceptions', 'Expansion requirements'],
  },
  expansion: {
    title: 'One vision, separate chapters.',
    description: 'Boracay is the first operating project. Singapore/Changi and Malaysia are tracked separately as expansion planning, not active membership operations.',
    labels: ['Boracay', 'Singapore / Changi', 'Malaysia', 'Local requirements'],
  },
  reports: {
    title: 'Documents and reports, together.',
    description: 'Executive reporting, verified financial figures, private agreements and secure document access belong in the authenticated office.',
    labels: ['Monthly reports', 'Business documents', 'Performance history', 'Owner notes'],
  },
  security: {
    title: 'Privacy by design.',
    description: 'This temporary no-passcode preview displays only the interface. Private business information and operational actions remain protected behind individual owner verification.',
    labels: ['Owner permissions', 'Session security', 'Confidential documents', 'Audit history'],
  },
};
function PreviewKpis({ items }) {
  return <div className="owner-kpis">{items.map(({label,note})=><div className="owner-kpi" key={label}>
    <span>{label}</span><strong aria-label="Private metric hidden">—</strong><small>{note}</small>
  </div>)}</div>;
}
function PreviewPanel({ title, children }) {
  return <section className="owner-panel"><h3>{title}</h3>{children}</section>;
}
export default function PublicPreview({onConnectPrivateData}) {
  const [active,setActive]=useState('overview');
  const [menuOpen,setMenuOpen]=useState(false);
  const navigate=id=>{setActive(id);setMenuOpen(false)};
  const selected=pages.find(p=>p.id===active);
  const topic=topics[active];
  return <div className="owner-app owner-preview">
    <aside className={'owner-sidebar'+(menuOpen?' is-open':'')} aria-label="Private Office preview navigation">
      <div className="owner-sidebar-brand"><img src="/brand/PLP_Editorial_Reversed_Ivory.svg" alt="Pueblo La Perla oval crest"/><div><span>PUEBLO LA PERLA</span><strong>Private Office</strong></div></div>
      <div className="owner-sidebar-person"><small>OWNER OFFICE · PREVIEW</small><strong>Dr. Marichi Fong Ramos</strong><span>No passcode required to preview</span></div>
      <nav aria-label="Office preview sections">{pages.map(({id,label,icon:Icon})=>
        <button type="button" key={id} className={'owner-nav-link'+(active===id?' active':'')} aria-current={active===id?'page':undefined} onClick={()=>navigate(id)}><Icon size={18} strokeWidth={1.65}/>{label}</button>
      )}</nav>
      <div className="owner-sidebar-footer"><ShieldCheck size={16}/> Confidential data remains protected</div>
    </aside>
    {menuOpen&&<button type="button" className="owner-overlay" aria-label="Close navigation" onClick={()=>setMenuOpen(false)}/>}
    <main className="owner-main">
      <header className="owner-header">
        <button type="button" className="owner-menu" aria-label={menuOpen?'Close navigation':'Open navigation'} onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?<X size={21}/>:<Menu size={21}/>}</button>
        <div><span>PUEBLO LA PERLA BORACAY</span><strong>{selected.label}</strong></div>
        <div className="owner-header-actions"><span><ShieldCheck size={15}/> Safe preview</span></div>
      </header>
      <div className="owner-content">
        <div className="owner-preview-notice" role="status"><ShieldCheck size={18}/><div><strong>Preview mode · No passcode</strong><p>The office opens directly. Private records, financial figures, member information and analytics remain hidden.</p></div></div>
        <div className="owner-heading"><span className="owner-eyebrow">DOCTORA'S DIGITAL PRIVATE OFFICE</span>
          <h1>{active==='overview'?'Your business, in one place.':topic.title}</h1>
          <div><p>{active==='overview'?'A central executive workspace for PLP Boracay and the future Pearl Club chapters.':topic.description}</p></div>
        </div>
        {active==='overview'?<>
          <PreviewKpis items={overview}/>
          <div className="owner-two">
            <PreviewPanel title="Business overview"><p className="owner-preview-body">Live reservations, guest operations, Pearl Club membership, and verified revenue will be available only after secure owner sign-in.</p><button className="owner-text-button" type="button" onClick={()=>navigate('performance')}>Explore resort performance <ArrowRight size={16}/></button></PreviewPanel>
            <PreviewPanel title="Executive priorities"><p className="owner-preview-body">Decision registers, private proposals and approval histories are not visible in public preview mode.</p><button className="owner-text-button" type="button" onClick={()=>navigate('decisions')}>Explore the decisions workspace <ArrowRight size={16}/></button></PreviewPanel>
          </div>
          <PreviewPanel title="PLP chapter structure"><div className="owner-chapter-strip">
            <article><span>FIRST CHAPTER</span><strong>Boracay</strong><small>Existing PLP project</small></article>
            <article><span>EXPANSION PLANNING</span><strong>Singapore</strong><small>Separate chapter</small></article>
            <article><span>EXPANSION PLANNING</span><strong>Malaysia</strong><small>Separate chapter</small></article>
          </div></PreviewPanel>
        </>:<><PreviewKpis items={topic.labels.map(label=>({label,note:'Private data not shown in preview'}))}/>
          <div className="owner-two">
            <PreviewPanel title="Executive view"><p className="owner-preview-body">{topic.description}</p><p className="owner-preview-hint">This screen is a preview of the planned owner workflow, not live operating data.</p></PreviewPanel>
            <PreviewPanel title="Protected information"><div className="owner-empty"><LockKeyhole size={21}/><div><strong>Not available without verified owner access</strong><p>Actual business reports and confidential records stay on secured server-side endpoints.</p></div></div></PreviewPanel>
          </div>
        </>}
        <section className="owner-panel owner-preview-access">
          <div><span className="owner-eyebrow">SECURE OWNER DATA</span><h3>Connect real business reporting when ready.</h3>
            <p className="owner-preview-body">There is no passcode for this preview. Verified email sign-in remains available for private records; the shared PLP staff code cannot unlock them.</p></div>
          <button type="button" className="owner-primary" onClick={onConnectPrivateData}><LockKeyhole size={16}/> Open secure sign-in</button>
        </section>
        <footer className="owner-footer"><span>PUEBLO LA PERLA · OWNER OFFICE</span><span>Preview only · No live records disclosed</span></footer>
      </div>
    </main>
  </div>;
}
