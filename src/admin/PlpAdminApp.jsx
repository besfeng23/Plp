// PLP Administration — the single administration shell (plan PR 6).
// Eight business screens; what each person sees follows their permissions.
// Every screen follows the PLP page pattern: serif uppercase title, one muted
// sentence in a thin notice, a two-column grid of square tiles; details open on tap.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { safeNextPath } from '../../lib/safe-next-path.js';
import { Activity, ArrowLeft, ArrowRight, BedDouble, BookOpen, CalendarDays, CalendarX, ClipboardList, ConciergeBell, CreditCard, FileText, FolderLock, Gem, History, KeyRound, LineChart, ListChecks, LockKeyhole, LogOut, Megaphone, Menu, RefreshCw, Search, Server, ShieldCheck, Sun, UserPlus, Users, Wallet, X } from 'lucide-react';
import { bookingStatus, buildGuestRoster, checkIn, checkOut, guestName, manilaToday, reservationReference, rowField, statusKey, summarizeRecords } from './plpAdminModel.js';
import { isTestRecord, recordMoney } from '../../lib/admin-records.js';
import { SOCIAL_ICON_PATHS } from '../../lib/social.js';
import { SCREENS, TILES, OWNER_CONFIRMATIONS, visibleScreens, visibleTiles } from './adminNavigation.js';
import ConciergeInbox from './ConciergeInbox.jsx';
import AffiliateAdmin from './AffiliateAdmin.jsx';
import OwnerMonth from './OwnerMonth.jsx';
import OwnerFunnel from './OwnerFunnel.jsx';
import WebsiteAnalytics from './WebsiteAnalytics.jsx';
import ClubAdminView from './ClubAdminView.jsx';
import OwnerWorkspace from './pearl/OwnerWorkspace.jsx';
import useWorkingFile from './pearl/useWorkingFile.js';
import './plp-enterprise-admin.css';
import './plp-admin.css';

const socialIcon = key => function SocialIcon({ size = 28, strokeWidth = 1.25 }) { return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SOCIAL_ICON_PATHS[key] }} />; };
const SCREEN_ICONS = { today: Sun, reservations: BookOpen, calendar: CalendarDays, guests: ConciergeBell, club: Gem, growth: Megaphone, reports: FileText, people: ShieldCheck };
const ICONS = {
  arrivals: ArrowRight, 'in-house': BedDouble, departures: ArrowLeft, attention: ListChecks, requests: ConciergeBell, tasks: ClipboardList, activity: Activity,
  all: BookOpen, upcoming: CalendarDays, payments: CreditCard, revenue: Wallet, availability: CalendarDays, blocks: CalendarX, 'block-new': LockKeyhole, housekeeping: BedDouble,
  inbox: ConciergeBell, directory: Users, register: Users, workbook: Gem, plan: Megaphone, month: Wallet, interest: LineChart, analytics: Activity, history: History, office: FolderLock,
  people: Users, grant: UserPlus, 'access-history': History, owners: KeyRound, system: Server,
  facebook: socialIcon('facebook'), instagram: socialIcon('instagram'), tiktok: socialIcon('tiktok'),
};

async function adminRequest(action, code, { method = 'GET', body, query } = {}) {
  const params = new URLSearchParams({ action, ...(query || {}) });
  const response = await fetch('/api/admin?' + params, {
    method, cache: 'no-store', credentials: 'same-origin',
    // Individual accounts use an HttpOnly cookie; the shared code is sent only when entered in this tab.
    headers: code ? { 'Content-Type': 'application/json', 'X-PLP-Staff-Code': code } : { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw Object.assign(new Error(data.error || `Request failed (${response.status})`), { status: response.status });
  return data;
}

const HEALTH_LABELS = { environment: 'Environment', supabase: 'Database', resend: 'Email sending', adminAccess: 'Shared staff code', checkedAt: 'Checked' };
const FINAL = ['CONFIRMED', 'FULLY_PAID', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'CANCELED'];
const EXCEPTION = /FAILED|MISMATCH|UNMATCHED|MISSING|CAPTURE_NOT_COMPLETED/;
function paymentState(row) {
  const verify = statusKey(rowField(row, ['payment_verification_status', 'verification_status']));
  const pay = statusKey(rowField(row, ['payment_status', 'booking_payment_status']));
  const booking = statusKey(rowField(row, ['booking_status', 'status']));
  return { verify, pay, booking, exception: EXCEPTION.test(verify) || Boolean(rowField(row, ['verification_error'])), final: FINAL.includes(booking) };
}

function StaffAccountSignIn({ onSignedIn }) {
  const [email, setEmail] = useState(''), [otp, setOtp] = useState(''), [stage, setStage] = useState('email'), [note, setNote] = useState('');
  const post = async (action, body) => {
    const response = await fetch('/api/admin?action=' + action, { method: 'POST', cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'Sign-in could not be completed.');
    return data;
  };
  return <div className="plp-admin-account-signin">
    <label htmlFor="plp-admin-email">Your work email</label>
    <input id="plp-admin-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
    {stage === 'code' && <><label htmlFor="plp-admin-otp">Sign-in code</label><input id="plp-admin-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} /></>}
    <button type="button" className="plp-primary" onClick={async () => {
      setNote('');
      try {
        if (stage === 'email') { const r = await post('staff-login', { email }); setStage('code'); setNote(r.message); }
        else { await post('staff-verify', { email, code: otp }); onSignedIn(); }
      } catch (err) { setNote(err.message); }
    }}>{stage === 'email' ? 'Send my sign-in code' : 'Verify and open'}</button>
    {note && <p className="plp-form-error" role="status">{note}</p>}
  </div>;
}

function Tile({ tile, value, onOpen, screen = false }) {
  const Icon = (screen ? SCREEN_ICONS[tile.id] : ICONS[tile.id]) || ArrowRight;
  const inner = <><span className="plp-adm-tile__top"><Icon size={28} strokeWidth={1.25} aria-hidden="true" />{value !== undefined && value !== null && <b>{value}</b>}</span><span className="plp-adm-tile__label">{tile.label}<ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" /></span></>;
  if (tile.href) return <a className="plp-adm-tile" href={tile.href} target={tile.href.startsWith('https://') ? '_blank' : undefined} rel="noopener noreferrer">{inner}</a>;
  return <button type="button" className="plp-adm-tile" onClick={onOpen}>{inner}</button>;
}

function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement; const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; ref.current?.querySelector('button')?.focus();
    const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  return <div className="plp-adm-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={ref} className="plp-adm-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <header className="plp-adm-sheet__top"><button type="button" className="plp-adm-round" onClick={onClose} aria-label="Back"><ArrowLeft size={18} strokeWidth={1.5} /></button><h2 className="plp-adm-title">{title}</h2></header>
      <div className="plp-adm-sheet__body">{children}</div>
    </section>
  </div>;
}

function Empty({ children }) { return <p className="plp-adm-empty">{children}</p>; }

function BookingRows({ rows, onOpen, empty = 'Nothing here right now.' }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return <ul className="plp-adm-list">{rows.map((row, index) => <li key={reservationReference(row) + index}><button type="button" onClick={() => onOpen(row)}>
    <span><strong>{guestName(row)}</strong><small>{checkIn(row) || '—'} → {checkOut(row) || '—'} · {rowField(row, ['accommodation_name', 'accommodation'], '—')}</small></span>
    <em className={'plp-adm-state' + (statusKey(rowField(row, ['booking_status', 'status'])) === 'CONFIRMED' ? ' is-good' : '')}>{bookingStatus(rowField(row, ['booking_status', 'status']))}</em>
  </button></li>)}</ul>;
}

function SimpleRows({ items, empty = 'Nothing here right now.' }) {
  if (!items.length) return <Empty>{empty}</Empty>;
  return <ul className="plp-adm-list">{items.map((item, index) => <li key={item.key || index}><div><span><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</span>{item.state && <em className="plp-adm-state">{item.state}</em>}{item.action}</div></li>)}</ul>;
}

export default function PlpAdminApp() {
  const pearlFile = useWorkingFile();
  const [code, setCode] = useState('');
  const [session, setSession] = useState(null);
  const [accountSession, setAccountSession] = useState(false);
  const [authConfig, setAuthConfig] = useState({ individualAccounts: false, sharedCode: true });
  const [authReady, setAuthReady] = useState(false);
  const [useSharedCode, setUseSharedCode] = useState(false);
  const [screen, setScreen] = useState('home');
  const [sheet, setSheet] = useState(null);
  const [selected, setSelected] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncAt, setSyncAt] = useState(null);
  const [data, setData] = useState({ rows: [], exceptions: [], notifications: [], tasks: [], blocks: [], calendar: [], newRequests: null });
  const [showTest, setShowTest] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [taskForm, setTaskForm] = useState({ reference: '', title: '', category: 'concierge' });
  const [blockForm, setBlockForm] = useState({ accommodation: '', startDate: '', endDate: '', reason: '' });
  const [access, setAccess] = useState(null);
  const [grantForm, setGrantForm] = useState({ email: '', display_name: '', role: 'staff' });
  const [health, setHealth] = useState(null);

  useEffect(() => { fetch('/api/admin?action=auth-config', { cache: 'no-store' }).then(r => r.json()).then(c => { if (c && c.ok) setAuthConfig(c); }).catch(() => {}).finally(() => setAuthReady(true)); }, []);

  const permissions = session?.permissions || [];
  const allowed = useCallback(perm => permissions.includes(perm), [permissions]);
  const rows = useMemo(() => data.rows.filter(row => showTest || !isTestRecord(row)), [data.rows, showTest]);
  const tasks = useMemo(() => data.tasks.filter(task => !isTestRecord(task)), [data.tasks]);
  const summary = useMemo(() => summarizeRecords(data.rows, data.exceptions, data.notifications, tasks), [data, tasks]);
  const guests = useMemo(() => buildGuestRoster(data.rows.filter(row => !isTestRecord(row))), [data.rows]);
  const testCount = data.rows.filter(isTestRecord).length;

  async function load(codeToUse = code, viaAccount = accountSession) {
    if (!codeToUse.trim() && !viaAccount) { setError('Enter your PLP staff access code.'); return false; }
    setLoading(true); setError(''); setNotice('');
    try {
      // The session response is the authentication gate: nothing renders until the server verifies access.
      const who = await adminRequest('session', codeToUse);
      const can = perm => who.permissions.includes(perm);
      const jobs = {
        operations: can('reservations') ? adminRequest('operations', codeToUse) : null,
        notifications: can('notifications') ? adminRequest('notifications', codeToUse) : null,
        tasks: can('tasks') ? adminRequest('staff-tasks', codeToUse) : null,
        blocks: can('availability.read') ? adminRequest('date-blocks', codeToUse) : null,
        requests: can('concierge') ? adminRequest('concierge-inbox', codeToUse, { query: { status: 'NEW', scope: 'all' } }) : null,
      };
      const keys = Object.keys(jobs);
      const results = await Promise.allSettled(keys.map(key => jobs[key] || Promise.resolve(null)));
      const got = Object.fromEntries(keys.map((key, i) => [key, results[i].status === 'fulfilled' ? results[i].value : null]));
      setData({
        rows: got.operations?.rows || [], exceptions: got.operations?.exceptions || [], notifications: got.notifications?.rows || [], tasks: got.tasks?.rows || [],
        blocks: got.blocks?.blockedDates || [], calendar: got.blocks?.calendar || [],
        newRequests: got.requests ? (got.requests.hasMore ? got.requests.rows.length + '+' : got.requests.rows.length) : null,
      });
      if (results.some(result => result.status === 'rejected')) setNotice('Some records could not be loaded. Refresh to retry.');
      setCode(codeToUse); setSession(who); setSyncAt(new Date()); return true;
    } catch (err) {
      setError(err.message || 'Staff access could not be verified.');
      if (!session || err.status === 401 || err.status === 403) { pearlFile.reset(); setSession(null); }
      return false;
    } finally { setLoading(false); }
  }

  async function enterAdmin(codeToUse, viaAccount) {
    if (viaAccount) setAccountSession(true);
    const ok = await load(codeToUse, viaAccount);
    if (!ok) return;
    const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
    if (next) window.location.replace(next);
  }

  function logout() {
    if (pearlFile.dirty && !window.confirm('Sign out and discard the unsaved Pearl Club working file?')) return;
    pearlFile.reset();
    if (accountSession) fetch('/api/admin?action=staff-logout', { method: 'POST', cache: 'no-store', credentials: 'same-origin' }).catch(() => {});
    setAccountSession(false); setSession(null); setCode(''); setScreen('home'); setSheet(null); setSelected(null); setDrawer(false);
    setData({ rows: [], exceptions: [], notifications: [], tasks: [], blocks: [], calendar: [], newRequests: null }); setAccess(null); setHealth(null);
  }

  async function act(fn, done) {
    setMessage(''); setLoading(true);
    try { await fn(); setMessage(done); await load(); } catch (err) { setMessage(err.message || 'That did not save.'); } finally { setLoading(false); }
  }
  const saveTask = (body) => act(() => adminRequest('staff-tasks', code, { method: 'POST', body }), 'Task saved.');
  const finishTask = (id) => act(() => adminRequest('staff-tasks', code, { method: 'PATCH', body: { id, status: 'done' } }), 'Task completed.');
  const setStatus = (reference, nextStatus) => {
    if (nextStatus === 'CONFIRMED' && !window.confirm(`Confirm ${reference}? The guest may be notified.`)) return;
    act(() => adminRequest('booking-status', code, { method: 'POST', body: { reference, nextStatus } }), 'Status saved.');
  };
  const loadAccess = useCallback(() => adminRequest('access', code).then(setAccess).catch(err => setAccess({ error: err.message })), [code]);
  const openSheet = (id) => { setMessage(''); setSearch(''); setSheet(id); if (['people', 'access-history', 'owners'].includes(id)) loadAccess(); if (id === 'system') adminRequest('health', code).then(setHealth).catch(err => setHealth({ error: err.message })); };
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeSelected = useCallback(() => setSelected(null), []);

  if (!session) return <div className="plp-admin-login"><div className="plp-admin-login__mark"><img src="/brand/PLP_Editorial_Vector_Logo.svg" alt="" width="54" height="76" className="plp-admin-login__crest" /><div>PLP <span>·</span> ADMINISTRATION</div></div><div className="plp-admin-login__card">
    <span className="plp-eyebrow">Pueblo La Perla Boracay</span><h1>Private resort administration.</h1>
    {!authReady && <p>Checking sign-in options…</p>}
    {authReady && authConfig.individualAccounts && <StaffAccountSignIn onSignedIn={() => enterAdmin('', true)} />}
    {authReady && authConfig.sharedCode !== false && authConfig.individualAccounts && !useSharedCode && <>
      <p className="plp-admin-login__or" role="separator">or</p>
      <button type="button" className="plp-admin-login__secondary" onClick={() => { setUseSharedCode(true); setError(''); }}>Use staff code</button>
    </>}
    {authReady && authConfig.sharedCode !== false && (!authConfig.individualAccounts || useSharedCode) && <form onSubmit={(event) => { event.preventDefault(); enterAdmin(code, false); }}>
      {authConfig.individualAccounts && <p className="plp-admin-login__or" role="separator">or</p>}
      <label htmlFor="plp-admin-code">Staff access code</label>
      <input id="plp-admin-code" autoComplete="off" type="password" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter access code" />
      <button className="plp-primary" disabled={loading} type="submit"><LockKeyhole size={17} /> {loading ? 'Verifying access…' : 'Open PLP Admin'}</button>
      {authConfig.individualAccounts && <button type="button" className="plp-admin-login__secondary" onClick={() => setUseSharedCode(false)}>Use work email</button>}
    </form>}
    {error && <p className="plp-form-error" role="alert">{error}</p>}
    <small>For authorized PLP staff. Access ends when this tab closes.</small>
  </div></div>;

  const screens = visibleScreens(permissions);
  const current = SCREENS.find(item => item.id === screen);
  const title = current ? current.label : 'Administration';
  const go = (id) => { setScreen(id); setDrawer(false); setSheet(null); window.scrollTo?.(0, 0); };
  const values = {
    today: { arrivals: summary.arrivals.length, 'in-house': summary.inHouse.length, departures: summary.departures.length, attention: summary.review.length + summary.exceptionCount, requests: data.newRequests ?? '—', tasks: summary.openTasks.length },
    reservations: { all: rows.filter(r => !isTestRecord(r)).length, upcoming: summary.upcoming.length, payments: summary.review.length + summary.exceptionCount },
    calendar: { blocks: data.blocks.length },
    guests: { directory: guests.length, tasks: summary.openTasks.length },
  };
  const references = [...new Set(data.rows.filter(row => !isTestRecord(row)).map(reservationReference))];
  const rooms = [...new Set([...data.calendar.map(c => c.accommodation_name), ...data.rows.map(r => rowField(r, ['accommodation_name', 'accommodation']))].filter(Boolean))];

  const taskList = (list, hideRef = false) => <SimpleRows empty="No open tasks." items={list.map(task => ({ key: task.id, title: task.title || 'Task', detail: [hideRef ? '' : task.booking_reference, task.category, task.actor].filter(Boolean).join(' · '),
    action: allowed('tasks') && !['done', 'cancelled'].includes(String(task.status).toLowerCase()) ? <button type="button" className="plp-adm-link" disabled={loading} onClick={() => finishTask(task.id)}>Done</button> : <em className="plp-adm-state">{task.status}</em> }))} />;
  const taskFormView = (category) => <form className="plp-adm-form" onSubmit={(event) => { event.preventDefault(); if (!taskForm.reference || !taskForm.title.trim()) return setMessage('Choose a booking and describe the task.'); saveTask({ reference: taskForm.reference, title: taskForm.title.trim(), kind: 'task', category: category || taskForm.category, priority: 'normal' }).then(() => setTaskForm({ reference: '', title: '', category: 'concierge' })); }}>
    <label>Booking<select value={taskForm.reference} onChange={e => setTaskForm(v => ({ ...v, reference: e.target.value }))}><option value="">Choose…</option>{references.map(ref => <option key={ref}>{ref}</option>)}</select></label>
    <label>Task<input value={taskForm.title} maxLength={160} onChange={e => setTaskForm(v => ({ ...v, title: e.target.value }))} /></label>
    {!category && <label>Type<select value={taskForm.category} onChange={e => setTaskForm(v => ({ ...v, category: e.target.value }))}><option value="concierge">Concierge</option><option value="housekeeping">Housekeeping</option><option value="arrival">Arrival</option><option value="admin">Admin</option></select></label>}
    <button className="plp-adm-button" disabled={loading} type="submit">Add task</button>
  </form>;

  function sheetContent(id) {
    const today = manilaToday();
    switch (id) {
      case 'arrivals': return <BookingRows rows={summary.arrivals} onOpen={setSelected} empty="No arrivals today." />;
      case 'in-house': return <BookingRows rows={summary.inHouse} onOpen={setSelected} empty="No guests in house." />;
      case 'departures': return <BookingRows rows={summary.departures} onOpen={setSelected} empty="No departures today." />;
      case 'attention': case 'payments': return <><BookingRows rows={summary.review} onOpen={setSelected} empty="No bookings need review." />
        {data.exceptions.filter(r => !isTestRecord(r)).length > 0 && <SimpleRows items={data.exceptions.filter(r => !isTestRecord(r)).slice(0, 30).map((item, i) => ({ key: i, title: item.booking_reference || item.provider_reference_id || 'Payment', detail: item.verification_notes || item.event_type, state: item.verification_status || 'Review' }))} />}</>;
      case 'requests': case 'inbox': return <ConciergeInbox code={code} refreshedAt={syncAt} />;
      case 'partners': return <AffiliateAdmin code={code} view="partners" refreshedAt={syncAt} />;
      case 'payouts': return <AffiliateAdmin code={code} view="payouts" refreshedAt={syncAt} />;
      case 'tasks': return <>{taskList(summary.openTasks)}{allowed('tasks') && taskFormView()}</>;
      case 'activity': return <SimpleRows empty="No messages recorded." items={data.notifications.filter(n => !isTestRecord(n)).slice(0, 40).map((n, i) => ({ key: n.id || i, title: n.subject || n.notification_key || 'Message', detail: [n.booking_reference, String(n.sent_at || n.created_at || '').slice(0, 16).replace('T', ' ')].filter(Boolean).join(' · '), state: n.status }))} />;
      case 'all': {
        const q = search.trim().toLowerCase();
        const list = rows.filter(row => !q || `${reservationReference(row)} ${guestName(row)} ${rowField(row, ['guest_email', 'email'])} ${rowField(row, ['accommodation_name'])}`.toLowerCase().includes(q));
        return <><label className="plp-adm-search"><Search size={16} aria-hidden="true" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Guest, reference or room" aria-label="Search bookings" /></label>
          <BookingRows rows={list} onOpen={setSelected} empty="No bookings found." />
          {testCount > 0 && <button type="button" className="plp-adm-link" aria-pressed={showTest} onClick={() => setShowTest(v => !v)}>{showTest ? 'Hide test bookings' : `Show ${testCount} test bookings`}</button>}</>;
      }
      case 'upcoming': return <BookingRows rows={summary.upcoming} onOpen={setSelected} empty="No upcoming stays." />;
      case 'revenue': return <><dl className="plp-adm-facts">
        <div><dt>Confirmed bookings</dt><dd>{summary.confirmedTotals.length ? summary.confirmedTotals.map(t => recordMoney(t.amount, t)).join(' · ') : '—'}</dd></div>
        <div><dt>Verified deposits</dt><dd>{summary.depositTotals.length ? summary.depositTotals.map(t => recordMoney(t.amount, t)).join(' · ') : '—'}</dd></div>
      </dl><p className="plp-adm-fine">From booking records, test bookings excluded. Not a bank or tax statement.</p></>;
      case 'availability': {
        const upcoming = data.calendar.filter(c => String(c.end_date || c.start_date || '') >= today).slice(0, 60);
        return <SimpleRows empty="No upcoming occupancy recorded." items={upcoming.map((c, i) => ({ key: i, title: c.accommodation_name || 'Room', detail: `${String(c.start_date || '').slice(0, 10)} → ${String(c.end_date || '').slice(0, 10)}`, state: c.source || c.status || c.kind }))} />;
      }
      case 'blocks': return <SimpleRows empty="No blocked dates." items={data.blocks.map((b, i) => ({ key: b.id || i, title: b.accommodation_name || 'Room', detail: `${String(b.start_date).slice(0, 10)} → ${String(b.end_date).slice(0, 10)}${b.reason ? ' · ' + b.reason : ''}`,
        action: allowed('availability') && b.id ? <button type="button" className="plp-adm-link" disabled={loading} onClick={() => { if (window.confirm('Remove this blocked date?')) act(() => adminRequest('date-blocks', code, { method: 'PATCH', body: { id: b.id } }), 'Dates reopened.'); }}>Reopen</button> : null }))} />;
      case 'block-new': return <form className="plp-adm-form" onSubmit={(event) => { event.preventDefault(); if (!blockForm.accommodation || !blockForm.startDate || !blockForm.endDate) return setMessage('Choose a room and dates.'); act(() => adminRequest('date-blocks', code, { method: 'POST', body: blockForm }), 'Dates blocked.').then(() => setBlockForm({ accommodation: '', startDate: '', endDate: '', reason: '' })); }}>
        <label>Room<select value={blockForm.accommodation} onChange={e => setBlockForm(v => ({ ...v, accommodation: e.target.value }))}><option value="">Choose…</option>{rooms.map(room => <option key={room}>{room}</option>)}</select></label>
        <label>From<input type="date" value={blockForm.startDate} onChange={e => setBlockForm(v => ({ ...v, startDate: e.target.value }))} /></label>
        <label>Until<input type="date" value={blockForm.endDate} onChange={e => setBlockForm(v => ({ ...v, endDate: e.target.value }))} /></label>
        <label>Reason<input value={blockForm.reason} maxLength={160} onChange={e => setBlockForm(v => ({ ...v, reason: e.target.value }))} /></label>
        <button className="plp-adm-button" disabled={loading} type="submit">Block dates</button></form>;
      case 'housekeeping': {
        const turnover = [...summary.departures, ...summary.arrivals];
        return <><BookingRows rows={turnover} onOpen={setSelected} empty="No room turnovers today." />
          {taskList(summary.openTasks.filter(t => String(t.category).toLowerCase() === 'housekeeping'))}{taskFormView('housekeeping')}</>;
      }
      case 'directory': {
        const q = search.trim().toLowerCase();
        return <><label className="plp-adm-search"><Search size={16} aria-hidden="true" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Guest name or email" aria-label="Search guests" /></label>
          <SimpleRows empty="No guests found." items={guests.filter(g => !q || `${g.name} ${g.email}`.toLowerCase().includes(q)).map(g => ({ key: g.key, title: g.name, detail: [g.email, `${g.reservations.length} booking${g.reservations.length === 1 ? '' : 's'}`, ...g.requests.map(r => r.text)].filter(Boolean).join(' · '),
            action: <button type="button" className="plp-adm-link" onClick={() => setSelected(g.reservations[0])}>Open</button> }))} /></>;
      }
      case 'register': return <ClubAdminView code={code} refreshedAt={syncAt} />;
      case 'workbook': return <OwnerWorkspace file={pearlFile} />;
      case 'month': return <OwnerMonth code={code} refreshedAt={syncAt} />;
      case 'interest': return <OwnerFunnel code={code} refreshedAt={syncAt} />;
      case 'analytics': return <WebsiteAnalytics code={code} refreshedAt={syncAt} />;
      case 'people': return access?.error ? <Empty>{access.error}</Empty> : !access ? <Empty>Loading…</Empty> : <SimpleRows empty="No staff accounts yet." items={(access.people || []).map(p => ({ key: p.email, title: p.display_name || p.email, detail: [p.display_name ? p.email : '', p.role].filter(Boolean).join(' · '),
        action: p.active ? <button type="button" className="plp-adm-link" disabled={loading} onClick={() => { if (window.confirm(`Remove access for ${p.email}?`)) act(() => adminRequest('access', code, { method: 'PATCH', body: { email: p.email } }), 'Access removed.').then(loadAccess); }}>Remove</button> : <em className="plp-adm-state">Removed</em> }))} />;
      case 'grant': return <form className="plp-adm-form" onSubmit={(event) => { event.preventDefault(); act(() => adminRequest('access', code, { method: 'POST', body: grantForm }), 'Access granted.').then(() => { setGrantForm({ email: '', display_name: '', role: 'staff' }); loadAccess(); }); }}>
        <label>Email<input type="email" required value={grantForm.email} onChange={e => setGrantForm(v => ({ ...v, email: e.target.value }))} /></label>
        <label>Name<input value={grantForm.display_name} maxLength={120} onChange={e => setGrantForm(v => ({ ...v, display_name: e.target.value }))} /></label>
        <label>Role<select value={grantForm.role} onChange={e => setGrantForm(v => ({ ...v, role: e.target.value }))}><option value="staff">Staff — requests, tasks, calendar view</option><option value="manager">Manager — all operations, no finances</option></select></label>
        <button className="plp-adm-button" disabled={loading} type="submit">Give access</button></form>;
      case 'access-history': return access?.error ? <Empty>{access.error}</Empty> : <SimpleRows empty="No changes yet." items={(access?.history || []).map((h, i) => ({ key: i, title: `${h.action === 'granted' ? 'Granted' : 'Removed'} · ${h.target_email}`, detail: [h.role, h.actor_email, String(h.created_at || '').slice(0, 16).replace('T', ' ')].filter(Boolean).join(' · ') }))} />;
      case 'owners': return <SimpleRows items={(access?.owners || []).map(email => ({ key: email, title: email, state: 'Owner' }))} empty="Owners are set in the server configuration." />;
      case 'system': return health?.error ? <Empty>{health.error}</Empty> : !health ? <Empty>Loading…</Empty> : <dl className="plp-adm-facts">{Object.entries(HEALTH_LABELS).filter(([k]) => health[k] !== undefined).map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{String(health[k])}</dd></div>)}</dl>;
      default: return null;
    }
  }

  const tiles = current ? visibleTiles(current.id, permissions) : [];
  const sheetTile = sheet && Object.values(TILES).flat().find(t => t.id === sheet);
  const pState = selected ? paymentState(selected) : null;
  const sentence = current ? (current.id === 'people' && !session.individualAccounts ? 'Individual accounts are ready and switch on with owner approval.' : current.note) : 'Choose an area to work in.';

  return <div className="plp-adm">
    <header className="plp-adm-top">
      <button type="button" className="plp-adm-round" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={18} strokeWidth={1.5} /></button>
      <h1 className="plp-adm-title">{title}</h1>
      <button type="button" className="plp-adm-round plp-adm-round--quiet" aria-label="Refresh" title={syncAt ? 'Updated ' + syncAt.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }) : 'Refresh'} disabled={loading} onClick={() => load()}><RefreshCw size={16} strokeWidth={1.5} className={loading ? 'plp-spin' : ''} /></button>
    </header>
    <main className="plp-adm-body">
      <p className="plp-adm-notice">{error || notice || sentence}</p>
      {!current && <div className="plp-adm-tiles">{screens.map(item => <Tile key={item.id} tile={item} screen onOpen={() => go(item.id)} />)}</div>}
      {current && <div className="plp-adm-tiles">{tiles.map(tile => <Tile key={tile.id} tile={tile} value={values[current.id]?.[tile.id]} onOpen={() => openSheet(tile.id)} />)}</div>}
      {current?.id === 'growth' && <>
        <p className="plp-adm-subhead">Waiting on the owners</p>
        <SimpleRows items={OWNER_CONFIRMATIONS.map(item => ({ key: item.id, title: item.title, detail: item.detail }))} />
      </>}
      {current && !tiles.length && <Empty>Nothing to show for your role.</Empty>}
    </main>
    <button type="button" className="plp-adm-crest" aria-label="Administration home" onClick={() => go('home')}><img src="/brand/PLP_Editorial_Reversed_Ivory.svg" alt="" width="26" height="36" /></button>

    {drawer && <div className="plp-adm-sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setDrawer(false); }}>
      <nav className="plp-adm-drawer" aria-label="Administration">
        <div className="plp-adm-drawer__brand"><img src="/brand/PLP_Editorial_Vector_Logo.svg" alt="" width="30" height="42" /><span>Pueblo La Perla</span><button type="button" className="plp-adm-round" aria-label="Close menu" onClick={() => setDrawer(false)}><X size={18} strokeWidth={1.5} /></button></div>
        {screens.map((item, index) => { const Icon = SCREEN_ICONS[item.id]; return <button type="button" key={item.id} className={screen === item.id ? 'is-active' : ''} aria-current={screen === item.id ? 'page' : undefined} onClick={() => go(item.id)}><small>{String(index + 1).padStart(2, '0')}</small><Icon size={17} strokeWidth={1.3} aria-hidden="true" />{item.label}</button>; })}
        <div className="plp-adm-drawer__foot"><span>{session.email || 'Shared staff access'}</span><button type="button" onClick={logout}><LogOut size={16} strokeWidth={1.4} aria-hidden="true" /> Sign out</button></div>
      </nav>
    </div>}

    {sheet && <Sheet title={sheetTile?.label || ''} onClose={closeSheet}>{message && <p className="plp-adm-notice" role="status">{message}</p>}{sheetContent(sheet)}</Sheet>}

    {selected && <Sheet title={guestName(selected)} onClose={closeSelected}>
      {message && <p className="plp-adm-notice" role="status">{message}</p>}
      <dl className="plp-adm-facts">{[
        ['Booking', reservationReference(selected)], ['Status', bookingStatus(rowField(selected, ['booking_status', 'status']))],
        ['Room', rowField(selected, ['accommodation_name', 'accommodation'], '—')], ['Stay', `${checkIn(selected) || '—'} → ${checkOut(selected) || '—'}`],
        ['Email', rowField(selected, ['guest_email', 'email'], '—')], ['Phone', rowField(selected, ['guest_phone', 'phone', 'guest_whatsapp'], '—')],
        ...(allowed('reservations') ? [['Total', recordMoney(selected.total_amount_php, selected)], ['Deposit', recordMoney(selected.deposit_amount_php ?? selected.payment_amount_php, selected)], ['Balance', recordMoney(selected.balance_amount_php, selected)], ['Payment', selected.payment_verification_status || 'Not verified']] : []),
        ['Requests', rowField(selected, ['special_requests', 'guest_notes', 'notes', 'message'], '—')],
      ].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>
      {allowed('reservations') && !pState.final && <div className="plp-adm-actions">
        {pState.verify === 'VERIFIED' && !pState.exception && ['SUCCEEDED', 'CAPTURED'].includes(pState.pay) && <button type="button" className="plp-adm-button" disabled={loading} onClick={() => setStatus(reservationReference(selected), 'CONFIRMED')}>Confirm stay</button>}
        {pState.verify !== 'VERIFIED' && !pState.exception && <button type="button" className="plp-adm-button plp-adm-button--quiet" disabled={loading} onClick={() => setStatus(reservationReference(selected), 'PAYMENT_PROCESSING')}>Mark payment processing</button>}
        {pState.exception && <p className="plp-adm-fine">Payment needs review before this stay can be confirmed.</p>}
      </div>}
      {allowed('tasks') && <>{taskList(tasks.filter(t => t.booking_reference === reservationReference(selected) && !['done', 'cancelled'].includes(String(t.status).toLowerCase())), true)}
        <form className="plp-adm-form" onSubmit={(event) => { event.preventDefault(); const title = new FormData(event.currentTarget).get('title'); if (String(title || '').trim()) { saveTask({ reference: reservationReference(selected), title: String(title).trim(), kind: 'task', category: 'concierge', priority: 'normal' }); event.currentTarget.reset(); } }}>
          <label>New task<input name="title" maxLength={160} /></label><button className="plp-adm-button" disabled={loading} type="submit">Add</button></form></>}
    </Sheet>}
  </div>;
}
