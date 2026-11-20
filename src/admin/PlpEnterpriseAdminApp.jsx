import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, Bell, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, CreditCard, Eye, House, LayoutDashboard, LockKeyhole, LogOut, Menu, RefreshCw, Search, Settings, ShieldCheck, Users, X } from 'lucide-react';
import { bookingStatus, buildGuestRoster, checkIn, checkOut, guestName, manilaToday, needsStaffReview, php, reservationReference, rowField, statusKey, summarizeRecords } from './plpAdminModel.js';
import { isTestRecord, recordMoney } from '../../lib/admin-records.js';
import ConciergeInbox from './ConciergeInbox.jsx';
import OwnerMonth from './OwnerMonth.jsx';
import ClubAdminView from './ClubAdminView.jsx';
import './plp-enterprise-admin.css';

const PAGES = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'operations', label: 'Operations', icon: CalendarDays },
  { id: 'vision', label: 'Vision', icon: Eye },
  { id: 'guests', label: 'Guest Experience', icon: Users },
  { id: 'club', label: 'PLP Club', icon: Users },
  { id: 'team', label: 'Team & Access', icon: ShieldCheck },
  { id: 'revenue', label: 'Revenue', icon: CreditCard },
  { id: 'attention', label: 'Needs You', icon: CircleAlert },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

async function adminRequest(action, code, options = {}) {
  const response = await fetch(`/api/admin?action=${encodeURIComponent(action)}`, {
    method: options.method || 'GET',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-PLP-Staff-Code': code },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `Admin request failed (${response.status})`);
  return data;
}

function Metric({ title, value, description, tone }) {
  return <div className={`plp-metric ${tone ? 'plp-metric--attention' : ''}`}><span>{title}</span><strong>{value}</strong><small>{description}</small></div>;
}

function StateLabel({ value, payment = false }) {
  const label = payment ? String(value || 'Not recorded') : bookingStatus(value);
  const good = payment ? statusKey(value) === 'VERIFIED' : statusKey(value) === 'CONFIRMED';
  const bad = /FAILED|MISMATCH|CANCEL|UNMATCHED|ERROR/i.test(String(value));
  return <span className={`plp-status ${good ? 'plp-status--good' : bad ? 'plp-status--bad' : ''}`}>{label}</span>;
}

function Panel({ title, note, children, action }) {
  return <section className="plp-panel"><div className="plp-panel__head"><div><h3>{title}</h3>{note && <p>{note}</p>}</div>{action}</div>{children}</section>;
}

function Blank({ title, detail }) {
  return <div className="plp-blank"><p>{title}</p>{detail && <small>{detail}</small>}</div>;
}

function BookingList({ rows, onOpen, compact = false, emptyTitle = 'No reservations to show', emptyDetail = 'New reservation requests will appear here.' }) {
  if (!rows?.length) return <Blank title={emptyTitle} detail={emptyDetail} />;
  return <div className="plp-record-list">{rows.map((row, index) => <button type="button" className="plp-record" onClick={() => onOpen(row)} key={`${reservationReference(row)}-${index}`}>
    <span className="plp-record__primary"><strong>{guestName(row)} {isTestRecord(row) && <em className="plp-test-badge">Test record</em>}</strong><small>{reservationReference(row)} · {rowField(row, ['accommodation_name', 'accommodation'], 'Accommodation not recorded')}</small></span>
    <span className="plp-record__dates">{checkIn(row) || '—'} <span>→</span> {checkOut(row) || '—'}</span>
    {!compact && <StateLabel value={rowField(row, ['booking_status', 'status'])} />}
    <ChevronRight size={16} aria-hidden="true" />
  </button>)}</div>;
}

function ReservationDetails({ row, onClose, onManage }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!row) return;
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('button')?.focus();
    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]') || [])].filter(el => !el.disabled);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [row, onClose]);
  if (!row) return null;
  const fields = [
    ['Reservation', reservationReference(row)],
    ['Guest', guestName(row)],
    ['Email', rowField(row, ['guest_email', 'email'], 'Not recorded')],
    ['Phone', rowField(row, ['guest_phone', 'phone', 'guest_whatsapp'], 'Not recorded')],
    ['Accommodation', rowField(row, ['accommodation_name', 'accommodation'], 'Not recorded')],
    ['Check-in', checkIn(row) || 'Not recorded'],
    ['Check-out', checkOut(row) || 'Not recorded'],
    ['Total quoted', recordMoney(row.total_amount_php, row)],
    ['Deposit', recordMoney(row.deposit_amount_php ?? row.payment_amount_php, row)],
    ['Balance', recordMoney(row.balance_amount_php, row)],
    ['Payment verification', row.payment_verification_status || 'Not recorded'],
    ['Guest requests', rowField(row, ['special_requests', 'guest_notes', 'notes', 'message'], 'None recorded')],
  ];
  return <div className="plp-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Reservation ${reservationReference(row)}`} className="plp-dialog">
      <header><div><span className="plp-eyebrow">Reservation 360 · {isTestRecord(row) ? 'Test record' : 'Reservation record'}</span><h2>{guestName(row)}</h2><StateLabel value={rowField(row, ['booking_status', 'status'])} /></div><button className="plp-icon-btn" type="button" onClick={onClose} aria-label="Close reservation"><X size={19} /></button></header>
      <dl>{fields.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{String(value)}</dd></div>)}</dl>
      <footer><button className="plp-secondary" type="button" onClick={onClose}>Close</button><button className="plp-primary" type="button" onClick={onManage}>Open Resort Command <ArrowRight size={16} /></button></footer>
    </section>
  </div>;
}

export default function PlpEnterpriseAdminApp() {
  const [code, setCode] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [mode, setMode] = useState('choose');
  const [page, setPage] = useState('home');
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [syncAt, setSyncAt] = useState(null);
  const [allRows, setRows] = useState([]);
  const [showTestRecords, setShowTestRecords] = useState(false);
  const testCount = allRows.filter(isTestRecord).length;
  const rows = useMemo(() => allRows.filter(row => showTestRecords || !isTestRecord(row)), [allRows, showTestRecords]);
  const [allExceptions, setExceptions] = useState([]);
  const [allNotifications, setNotifications] = useState([]);
  const [allTasks, setTasks] = useState([]);
  const exceptions = useMemo(() => allExceptions.filter(row => showTestRecords || !isTestRecord(row)), [allExceptions, showTestRecords]);
  const notifications = useMemo(() => allNotifications.filter(row => showTestRecords || !isTestRecord(row)), [allNotifications, showTestRecords]);
  const tasks = useMemo(() => allTasks.filter(row => showTestRecords || !isTestRecord(row)), [allTasks, showTestRecords]);
  const [blocks, setBlocks] = useState([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const closeReservation = useCallback(() => setSelected(null), []);
  const [taskForm, setTaskForm] = useState({ reference: '', title: '', category: 'concierge' });
  const [taskMessage, setTaskMessage] = useState('');

  const summary = useMemo(() => summarizeRecords(rows, exceptions, notifications, tasks), [rows, exceptions, notifications, tasks]);
  const guests = useMemo(() => buildGuestRoster(rows), [rows]);
  const matchingRows = useMemo(() => rows.filter((row) => {
    const text = `${reservationReference(row)} ${guestName(row)} ${rowField(row, ['guest_email', 'email'])} ${rowField(row, ['accommodation_name'])}`.toLowerCase();
    return text.includes(filter.toLowerCase()) && (statusFilter === 'all' || statusKey(row.booking_status) === statusFilter);
  }), [rows, filter, statusFilter]);

  async function load(codeToUse = code, first = false) {
    if (!codeToUse.trim()) { setError('Enter your PLP staff access code.'); return; }
    setLoading(true); setError(''); setWarning('');
    try {
      // The operations response is the authentication gate. No workspace or guest data
      // is rendered until the existing server has validated the staff code.
      const operations = await adminRequest('operations', codeToUse);
      const optional = await Promise.allSettled(['notifications', 'staff-tasks', 'date-blocks'].map((action) => adminRequest(action, codeToUse)));
      setRows(Array.isArray(operations.rows) ? operations.rows : []);
      setExceptions(Array.isArray(operations.exceptions) ? operations.exceptions : []);
      setNotifications(optional[0].status === 'fulfilled' ? (optional[0].value.rows || []) : []);
      setTasks(optional[1].status === 'fulfilled' ? (optional[1].value.rows || []) : []);
      setBlocks(optional[2].status === 'fulfilled' ? (optional[2].value.blockedDates || []) : []);
      if (Object.values(operations.warnings || {}).some(Boolean) || optional.some((result) => result.status === 'rejected' || result.value?.warning)) setWarning('Some secondary operational records could not be loaded. Refresh to retry.');
      setCode(codeToUse); setAuthenticated(true); setSyncAt(new Date());
      if (first) setMode('choose');
    } catch (err) {
      setError(err.message || 'Staff access could not be verified.');
      if (first || /access|401|403/i.test(err.message || '')) setAuthenticated(false);
    } finally { setLoading(false); }
  }

  async function createTask(event) {
    event.preventDefault(); setTaskMessage('');
    if (!taskForm.reference.trim() || !taskForm.title.trim()) return setTaskMessage('Reservation reference and task title are required.');
    if (!rows.some((row) => reservationReference(row) === taskForm.reference)) return setTaskMessage('Choose a booking from the loaded reservations.');
    setLoading(true);
    try {
      await adminRequest('staff-tasks', code, { method: 'POST', body: { reference: taskForm.reference.trim(), title: taskForm.title.trim(), kind: 'task', category: taskForm.category, priority: 'normal' } });
      const data = await adminRequest('staff-tasks', code);
      setTasks(data.rows || []); setTaskForm({ reference: '', title: '', category: 'concierge' });
      setTaskMessage('Task saved to the PLP staff task register.');
    } catch (err) { setTaskMessage(err.message || 'Task was not saved.'); }
    finally { setLoading(false); }
  }

  function logout() {
    setAuthenticated(false); setShowTestRecords(false); setCode(''); setMode('choose'); setPage('home'); setSelected(null);
    setRows([]); setExceptions([]); setNotifications([]); setTasks([]); setBlocks([]); setSyncAt(null);
  }

  if (!authenticated) return <div className="plp-admin-login"><div className="plp-admin-login__mark">PLP <span>·</span> ENTERPRISE</div><form onSubmit={(event) => { event.preventDefault(); load(code, true); }} className="plp-admin-login__card">
    <span className="plp-eyebrow">Pueblo La Perla Boracay</span><h1>Private resort administration.</h1><p>Your private workspace for reservations, guest care, and resort operations.</p>
    <label htmlFor="plp-admin-code">Staff access code</label><input id="plp-admin-code" autoComplete="off" type="password" value={code} onChange={(event) => setCode(event.target.value)} required placeholder="Enter access code" />
    {error && <p className="plp-form-error" role="alert">{error}</p>}<button className="plp-primary" disabled={loading} type="submit"><LockKeyhole size={17} /> {loading ? 'Verifying access…' : 'Open PLP Admin'}</button>
    <small>For authorized PLP staff. Access ends when this tab closes.</small>
  </form></div>;

  const pageTitle = PAGES.find((item) => item.id === page)?.label || 'Home';
  const enterWorkspace = () => { setMode('workspace'); setPage('home'); setMobileNav(false); };
  const enterManage = () => { setMode('manage'); setMobileNav(false); setSelected(null); };
  const toPage = (id) => { setPage(id); setMobileNav(false); };

  return <div className="plp-admin-root">
    <aside className={`plp-admin-sidebar ${mobileNav ? 'is-open' : ''}`} aria-label="PLP Admin navigation">
      <div className="plp-sidebar-brand"><span className="plp-sidebar-logo">PLP</span><div><small>Pueblo La Perla</small><strong>Administration</strong></div></div>
      <div className="plp-sidebar-divider" />
      <button className={`plp-sidebar-link ${mode === 'choose' ? 'active' : ''}`} onClick={() => { setMode('choose'); setMobileNav(false); }}><LayoutDashboard size={17} /> Admin Home</button>
      <button className={`plp-sidebar-link ${mode === 'manage' ? 'active' : ''}`} onClick={enterManage}><ShieldCheck size={17} /> Manage Client</button>
      <button className={`plp-sidebar-link ${mode === 'workspace' ? 'active' : ''}`} onClick={enterWorkspace}><House size={17} /> Client Workspace</button>
      {mode === 'workspace' && <nav className="plp-sidebar-pages" aria-label="Workspace pages">{PAGES.map(({ id, label, icon: Icon }) => <button key={id} className={`plp-sidebar-link ${page === id ? 'active' : ''}`} onClick={() => toPage(id)}><Icon size={16} /> {label}</button>)}</nav>}
      <div className="plp-sidebar-bottom"><div className="plp-sidebar-session"><span className="plp-live-dot" /> Authorized PLP staff session</div><button className="plp-sidebar-link" onClick={logout}><LogOut size={17} /> Sign out</button></div>
    </aside>
    {mobileNav && <button className="plp-admin-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <div className="plp-admin-main">
      <header className="plp-admin-header"><button className="plp-icon-btn plp-mobile-menu" aria-label="Open navigation" aria-expanded={mobileNav} onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="plp-admin-header__title"><span>Pueblo La Perla Boracay</span><strong>{mode === 'choose' ? 'PLP Admin' : mode === 'manage' ? 'Manage Client' : pageTitle}</strong></div><div className="plp-admin-header__actions"><span className="plp-sync">{syncAt ? `Updated ${syncAt.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })}` : 'Not synced'}</span><button className="plp-icon-btn" aria-label="Refresh live records" title="Refresh live records" disabled={loading} onClick={() => load()}><RefreshCw size={18} className={loading ? 'plp-spin' : ''} /></button></div></header>
      {error && <div className="plp-banner plp-banner--error" role="alert">{error}</div>}
      {warning && <div className="plp-banner" role="status">{warning}</div>}
      {testCount > 0 && mode === 'workspace' && <div className="plp-record-scope"><span>{showTestRecords ? 'Test records visible · excluded from business totals' : `${testCount} test reservations excluded from business totals`}</span><button className="plp-text-button" aria-pressed={showTestRecords} onClick={() => { setShowTestRecords(value => !value); setSelected(null); }}>{showTestRecords ? 'Hide test records' : 'Show test records'}</button></div>}
      {mode === 'choose' && <main className="plp-admin-content"><div className="plp-intro"><span className="plp-eyebrow">PLP · Administration</span><h1>One resort. Two ways to work.</h1><p>Manage daily operations or step into the owner workspace for a clear view of the resort.</p></div><div className="plp-mode-grid"><button onClick={enterManage} className="plp-mode-card"><span className="plp-mode-icon"><ShieldCheck size={26} /></span><small>01 / Resort Command</small><h2>Manage Client</h2><p>Reservations, payment review, housekeeping, guest requests, and availability in one operational workspace.</p><span>Open operations <ArrowRight size={18} /></span></button><button onClick={enterWorkspace} className="plp-mode-card"><span className="plp-mode-icon"><House size={26} /></span><small>02 / Enterprise Workspace</small><h2>Enter Client Workspace</h2><p>A clear view of stays, guest care, booking value, and decisions that need your attention.</p><span>Enter workspace <ArrowRight size={18} /></span></button></div><p className="plp-disclosure">Connected to PLP reservation records. Test records are excluded from business totals.</p></main>}
      {mode === 'manage' && <main className="plp-admin-management" aria-label="Existing PLP Resort Command"><iframe title="PLP Resort Command — operational controls" src="/admin-ops.html" onLoad={(event) => event.currentTarget.contentWindow?.postMessage({ type: 'PLP_ADMIN_AUTH', code }, window.location.origin)} /></main>}
      {mode === 'workspace' && <main className="plp-admin-content" id="plp-workspace"><div className="plp-workspace-intro"><span className="plp-eyebrow">Enterprise Workspace · {manilaToday()}</span><div><h1>{pageTitle}</h1><button className="plp-secondary" onClick={enterManage}>Manage Client <ArrowRight size={15} /></button></div></div>
        {page === 'home' && <><div className="plp-metrics"><Metric title="Arriving today" value={summary.arrivals.length} description="From reservation records" /><Metric title="In house" value={summary.inHouse.length} description="Active stay dates" /><Metric title="Departing today" value={summary.departures.length} description="Scheduled departures" /><Metric title="Needs review" value={summary.review.length + summary.exceptionCount} description="Booking and payment cues" tone /></div><div className="plp-two-columns"><Panel title="Arrivals" note="Expected today, from live stays." action={<button className="plp-text-button" onClick={() => toPage('operations')}>All reservations <ArrowRight size={14} /></button>}><BookingList rows={summary.arrivals} onOpen={setSelected} compact emptyTitle="No arrivals scheduled today" emptyDetail="Your next arrivals will appear here." /></Panel><Panel title="Needs You" note="Review first; no automatic confirmation." action={<button className="plp-text-button" onClick={() => toPage('attention')}>View attention <ArrowRight size={14} /></button>}><BookingList rows={summary.review.slice(0, 5)} onOpen={setSelected} compact emptyTitle="No reservations need review" emptyDetail="New decisions will appear here as stays progress." /></Panel></div></>}
        {page === 'overview' && <><OwnerMonth code={code} refreshedAt={syncAt} /><div className="plp-metrics"><Metric title="Reservations loaded" value={rows.filter(row => !isTestRecord(row)).length} description="Live source count" /><Metric title="Open staff tasks" value={summary.openTasks.length} description="Persisted task records" /><Metric title="Payment exceptions" value={summary.exceptionCount} description="Reconciliation exceptions" tone /><Metric title="Notifications" value={summary.notificationCount} description="Recorded sends and outcomes" /></div><Panel title="Upcoming stays" note="Chronological arrivals from current reservations."><BookingList rows={summary.upcoming} onOpen={setSelected} emptyTitle="No upcoming stays yet" emptyDetail="Confirmed and requested stays will appear in arrival order." /></Panel><p className="plp-disclosure">Counts reflect the returned API rows, not an independently reconciled occupancy or accounting ledger.</p></>}
        {page === 'operations' && <><Panel title="Reservations" note="Search live booking records; open the original record for full details."><div className="plp-filters"><label><Search size={16} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Guest, reference, accommodation" aria-label="Search reservations" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter booking status"><option value="all">All booking statuses</option>{['PENDING_PAYMENT','PAID_DEPOSIT','CONFIRMED','CANCELLED','PAYMENT_PROCESSING'].map((value) => <option key={value} value={value}>{bookingStatus(value)}</option>)}</select></div><BookingList rows={matchingRows} onOpen={setSelected} /></Panel></>}
        {page === 'vision' && <Panel title="Vision" note="Camera operations must use an approved, authenticated source."><Blank title="Camera feed not connected" detail="Live property monitoring will appear here once an approved camera source is connected." /></Panel>}
        {page === 'club' && <ClubAdminView code={code} refreshedAt={syncAt} />}
        {page === 'guests' && <><ConciergeInbox code={code} refreshedAt={syncAt} /><div className="plp-metrics"><Metric title="Guests in loaded records" value={guests.length} description="Grouped by recorded email" /><Metric title="Guest requests" value={guests.reduce((n, guest) => n + guest.requests.length, 0)} description="Notes captured on reservations" /><Metric title="Arrivals today" value={summary.arrivals.length} description="Guest preparation" /><Metric title="In house" value={summary.inHouse.length} description="Stay dates" /></div><Panel title="Guest roster" note="Records visible only to authenticated PLP staff."><div className="plp-guest-grid">{guests.map((guest) => <article className="plp-guest-card" key={guest.key}><strong>{guest.name}</strong><small>{guest.email || 'Email not recorded'}</small><span>{guest.reservations.length} reservation{guest.reservations.length === 1 ? '' : 's'} · {guest.requests.length} request note{guest.requests.length === 1 ? '' : 's'}</span><button className="plp-text-button" onClick={() => setSelected(guest.reservations[0])}>View latest record <ArrowRight size={14} /></button></article>)}{!guests.length && <Blank title="No guest records returned" />}</div></Panel></>}
        {page === 'team' && <>
          <Panel title="Staff tasks" note="Only tasks already persisted in the PLP staff task register appear here.">
            <div className="plp-task-list">{tasks.slice(0, 30).map((task) => <div className="plp-task" key={task.id}><div><strong>{task.title || 'Untitled task'}</strong><small>{task.booking_reference || 'No reference'} · {task.category || 'Uncategorized'}</small></div><StateLabel value={task.status || 'open'} payment /></div>)}{!tasks.length && <Blank title="No persisted staff tasks returned" />}</div>
          </Panel>
          <Panel title="Add operational task" note="Creates a task against a loaded booking. It does not modify a booking or send a guest message.">
            <form onSubmit={createTask} className="plp-task-form">
              <label>Booking reference
                <select value={taskForm.reference} onChange={(event) => setTaskForm((value) => ({ ...value, reference: event.target.value }))} required>
                  <option value="">Select a reservation</option>
                  {[...new Set(rows.map(reservationReference))].map((ref) => <option value={ref} key={ref}>{ref}</option>)}
                </select>
              </label>
              <label>Task title<input value={taskForm.title} onChange={(event) => setTaskForm((value) => ({ ...value, title: event.target.value }))} maxLength={160} required placeholder="What needs to be done?" /></label>
              <label>Category<select value={taskForm.category} onChange={(event) => setTaskForm((value) => ({ ...value, category: event.target.value }))}><option value="concierge">Concierge</option><option value="housekeeping">Housekeeping</option><option value="arrival">Arrival</option><option value="admin">Admin</option></select></label>
              <button type="submit" disabled={loading || !rows.length} className="plp-primary">Save task <ArrowRight size={15} /></button>
            </form>
            {taskMessage && <p className="plp-task-feedback" role="status">{taskMessage}</p>}
          </Panel>
          <p className="plp-disclosure">Staff sign-in uses the current shared staff code. Individual roles, invites and identity management are not enabled by this interface.</p>
        </>}
        {page === 'revenue' && <><div className="plp-metrics"><Metric title="Confirmed booking value" value={summary.confirmedTotals.length ? summary.confirmedTotals.map(total => recordMoney(total.amount, total)).join(" · ") : "—"} description="Confirmed stays · test records excluded" /><Metric title="Verified deposits" value={summary.depositTotals.length ? summary.depositTotals.map(total => recordMoney(total.amount, total)).join(" · ") : "—"} description="Verified records · test records excluded" /><Metric title="Payment exceptions" value={summary.exceptionCount} description="Review required" tone /><Metric title="Loaded reservations" value={rows.filter(row => !isTestRecord(row)).length} description="Not a revenue ledger" /></div><Panel title="Payment review" note="Server-side payment verification remains the source of truth.">{exceptions.length ? <div className="plp-task-list">{exceptions.slice(0, 25).map((item, index) => <div className="plp-task" key={`${item.provider_event_id || 'exception'}-${index}`}><div><strong>{item.booking_reference || item.provider_reference_id || 'Unknown reference'}</strong><small>{item.verification_notes || item.event_type || 'Payment exception'}</small></div><StateLabel value={item.verification_status || 'Review needed'} payment /></div>)}</div> : <Blank title="No payment exceptions returned" />}</Panel><p className="plp-disclosure">These figures are based on loaded reservation rows. They are not a bank settlement, tax or audited revenue report.</p></>}
        {page === 'attention' && <><div className="plp-metrics"><Metric title="Bookings to review" value={summary.review.length} description="Status and payment cues" tone /><Metric title="Payment exceptions" value={summary.exceptionCount} description="Provider reconciliation" tone /><Metric title="Open tasks" value={summary.openTasks.length} description="Staff workflow" /><Metric title="Date blocks" value={blocks.length} description="Recorded availability blocks" /></div><Panel title="Reservations needing staff attention" note="A verified deposit is not a confirmed stay."><BookingList rows={summary.review} onOpen={setSelected} /></Panel><button className="plp-primary" type="button" onClick={enterManage}>Review in Resort Command <ArrowRight size={16} /></button></>}
        {page === 'activity' && <><Panel title="Notification history" note="Actual saved notification status; this view cannot send guest messages."><div className="plp-task-list">{notifications.slice(0, 40).map((item, index) => <div className="plp-task" key={`${item.id || item.notification_key || 'notification'}-${index}`}><div><strong>{item.subject || item.notification_key || 'Notification'}</strong><small>{item.booking_reference || 'No reservation'} · {item.sent_at || item.created_at || 'No timestamp'}</small></div><StateLabel value={item.status} payment /></div>)}{!notifications.length && <Blank title="No notifications returned" />}</div></Panel></>}
        {page === 'settings' && <><Panel title="Workspace configuration" note="This release keeps sensitive settings on the server."><div className="plp-settings-grid"><div><span>Data source</span><strong>PLP Resort Command API</strong><small>Authorized server-mediated access</small></div><div><span>Property</span><strong>Pueblo La Perla Boracay</strong><small>Single resort workspace</small></div><div><span>Session</span><strong>Staff code verified</strong><small>In-memory until sign out or tab close</small></div><div><span>Vision</span><strong>Not connected</strong><small>No camera feeds or credentials exposed</small></div></div></Panel><button className="plp-secondary" type="button" onClick={logout}><LogOut size={16} /> Sign out of admin</button></>}
      </main>}
    </div>
    <ReservationDetails row={selected} onClose={closeReservation} onManage={enterManage} />
  </div>;
}
