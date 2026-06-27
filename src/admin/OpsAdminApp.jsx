import React, { useMemo, useState } from 'react';
import { AlertCircle, Bell, Calendar, CheckCircle2, Clock, Database, FileText, LayoutDashboard, Lock, LogOut, RefreshCw, Search, Settings, Shield, TrendingUp, Users } from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Today', icon: LayoutDashboard },
  { id: 'bookings', label: 'Reservations', icon: Database },
  { id: 'exceptions', label: 'Payments', icon: AlertCircle },
  { id: 'availability', label: 'Availability', icon: Calendar },
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'housekeeping', label: 'Housekeeping', icon: CheckCircle2 },
  { id: 'concierge', label: 'Concierge', icon: Bell },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'staff', label: 'Staff & Roles', icon: Shield },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH')}`;
const RESERVATION_STATUS_OPTIONS = ['All', 'Pending', 'Confirmed', 'Checked In', 'Checked Out', 'Cancelled'];
const STAY_FILTER_OPTIONS = ['All', 'Upcoming', 'In-house', 'Past'];
const SORT_OPTIONS = ['Newest booking first', 'Check-in soonest', 'Guest name A-Z', 'Status A-Z'];

const isReviewBooking = (row) => !['CONFIRMED', 'FULLY_PAID', 'CANCELLED'].includes(String(row.booking_status || row.status || '').toUpperCase());

function statusClass(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('SENT') || text.includes('VERIFIED') || text.includes('CONFIRMED') || text.includes('SUCCEEDED') || text.includes('CAPTURED')) return 'bg-green-50 text-green-700 border-green-100';
  if (text.includes('FAILED') || text.includes('MISMATCH') || text.includes('UNMATCHED') || text.includes('CANCELLED') || text.includes('EXPIRED')) return 'bg-red-50 text-red-700 border-red-100';
  return 'bg-yellow-50 text-yellow-700 border-yellow-100';
}

function Pill({ value }) {
  return <span className={`inline-flex border rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase ${statusClass(value)}`}>{value || '—'}</span>;
}

async function adminFetch(action, accessKey, options = {}) {
  const response = await fetch(`/api/admin?action=${encodeURIComponent(action)}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'X-PLP-Staff-Code': accessKey || '' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || data.detail || `Admin request failed (${response.status})`);
  return data;
}

export default function OpsAdminApp() {
  const [accessKey, setAccessKey] = useState('');
  const [isUnlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState('bookings');
  const [rows, setRows] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [query, setQuery] = useState('');
  const [reservationSearch, setReservationSearch] = useState('');
  const [reservationStatus, setReservationStatus] = useState('All');
  const [stayFilter, setStayFilter] = useState('All');
  const [reservationSort, setReservationSort] = useState('Newest booking first');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(null);

  const filteredRows = useMemo(() => filterReservations(rows, { search: reservationSearch, status: reservationStatus, stay: stayFilter, sort: reservationSort }), [rows, reservationSearch, reservationStatus, stayFilter, reservationSort]);
  const filteredExceptions = useMemo(() => filterRows(exceptions, query), [exceptions, query]);
  const filteredNotifications = useMemo(() => filterRows(notifications, query), [notifications, query]);
  const kpis = useMemo(() => ({
    bookings: rows.length,
    verified: rows.filter((row) => row.payment_verification_status === 'VERIFIED').length,
    review: rows.filter(isReviewBooking).length,
    exceptions: exceptions.length,
    notifications: notifications.length,
    verifiedDepositTotal: rows.filter((row) => row.payment_verification_status === 'VERIFIED').reduce((sum, row) => sum + Number(row.deposit_amount_php || row.payment_amount_php || 0), 0),
  }), [rows, exceptions, notifications]);

  async function loadData(nextKey = accessKey) {
    if (!nextKey) return setError('Enter the PLP staff access key to open live reservation records.');
    setLoading(true);
    setError('');
    setMessage('Loading live reservations and payment checks for the reservation desk...');
    try {
      const operations = await adminFetch('operations', nextKey);
      setRows(operations.rows || []);
      setExceptions(operations.exceptions || []);
      setLastSync(new Date());
      setActiveTab('bookings');
      setUnlocked(true);
      try {
        const notificationData = await adminFetch('notifications', nextKey);
        setNotifications(notificationData.rows || []);
        setMessage(`Live reservations and payment checks are ready. Notifications are ready too.`);
      } catch {
        setNotifications([]);
        setMessage(`Live reservations and payment checks are ready. Notifications can be retried later.`);
      }
    } catch (err) {
      setError(err.message || 'Unable to load live reservation records. Please check the staff access key and try again.');
      setMessage('');
    } finally {
      setLoading(false);
    }
  }

  async function updateBooking(reference, nextStatus) {
    const reason = window.prompt(`Reason for updating ${reference} to ${nextStatus}?`, nextStatus === 'CONFIRMED' ? 'Deposit verified and availability reviewed' : 'Staff operations update');
    if (!reason) return;
    setLoading(true);
    setError('');
    try {
      await adminFetch('booking-status', accessKey, { method: 'POST', body: { reference, nextStatus, reason } });
      setMessage(`${reference} updated to ${nextStatus}.`);
      await loadData(accessKey);
    } catch (err) {
      setError(err.message || 'Unable to update booking.');
    } finally {
      setLoading(false);
    }
  }

  function unlock(event) {
    event.preventDefault();
    loadData(accessKey);
  }

  function logout() {
    setAccessKey('');
    setUnlocked(false);
    setRows([]);
    setExceptions([]);
    setNotifications([]);
  }

  if (!isUnlocked) return <LoginScreen accessKey={accessKey} setAccessKey={setAccessKey} onSubmit={unlock} loading={loading} error={error} />;

  const activeLabel = TABS.find((tab) => tab.id === activeTab)?.label || 'Reservations';

  return (
    <div className="min-h-screen bg-[#F7F2EA] text-[#211F1B]">
      <div className="bg-[#17130F] text-[#B8977E] px-4 py-1.5 text-[10px] tracking-[0.2em] uppercase flex justify-between items-center border-b border-[#B8977E]/20">
        <span>PLP Resort Command · Reservations</span><span className="text-[#6A645B]">Last Sync: {lastSync ? lastSync.toLocaleTimeString() : 'Not loaded'}</span>
      </div>
      <div className="grid lg:grid-cols-[260px_1fr] min-h-[calc(100vh-30px)]">
        <aside className="bg-[#17130F] text-white p-6 flex flex-col">
          <div className="mb-8"><p className="text-[10px] text-[#B8977E] tracking-[0.32em] uppercase">Pueblo La Perla</p><h1 className="text-3xl tracking-[-0.05em] font-light">Resort Command</h1><p className="text-[10px] text-[#6A645B] mt-2 tracking-widest uppercase">Reservations first · live database</p></div>
          <nav className="space-y-1 flex-1 overflow-y-auto">{TABS.map((tab) => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-sm text-sm transition ${activeTab === tab.id ? 'bg-[#B8977E]/10 text-[#B8977E]' : 'text-[#6A645B] hover:text-[#F4F0E8] hover:bg-white/5'}`}><Icon size={17} /> {tab.label}</button>; })}</nav>
          <button onClick={logout} className="border-t border-[#B8977E]/10 pt-4 w-full flex items-center justify-between text-[#6A645B] hover:text-[#B8977E] text-sm">Secure Logout <LogOut size={16} /></button>
        </aside>
        <main className="p-4 md:p-8 overflow-auto">
          <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6"><div><p className="text-[10px] tracking-widest uppercase text-[#B8977E]">Pueblo La Perla Resort Operations</p><h2 className="text-3xl md:text-4xl font-light tracking-[-0.05em] text-[#17130F]">{activeLabel}</h2><p className="text-sm text-[#6A645B] mt-2 max-w-3xl">A quiet luxury command center for reservations, payments, villa readiness, guest memory, and Boracay service delivery.</p></div><div className="flex flex-wrap gap-2">{activeTab !== 'bookings' && (<div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A645B]" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ref, guest, payment, email..." className="w-full bg-white border border-[#E5E0D8] rounded-sm pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#B8977E]" /></div>)}<button onClick={() => loadData(accessKey)} disabled={loading} className="inline-flex items-center gap-2 bg-[#17130F] text-[#F4F0E8] px-4 py-2.5 rounded-sm text-sm font-medium disabled:opacity-60"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button></div></header>
          {message && <div className="mb-4 bg-green-50 border border-green-100 text-green-700 rounded-sm px-4 py-3 text-sm">{message}</div>}
          {error && <div className="mb-4 bg-red-50 border border-red-100 text-red-700 rounded-sm px-4 py-3 text-sm">{error}</div>}
          {activeTab === 'bookings' && <BookingsTable rows={filteredRows} totalRows={rows.length} controls={{ reservationSearch, setReservationSearch, reservationStatus, setReservationStatus, stayFilter, setStayFilter, reservationSort, setReservationSort }} updateBooking={updateBooking} />}
          {activeTab === 'dashboard' && <Dashboard kpis={kpis} />}
          {activeTab === 'exceptions' && <ExceptionsTable rows={filteredExceptions} />}
          {activeTab === 'notifications' && <NotificationsTable rows={filteredNotifications} />}
          {['availability', 'guests', 'housekeeping', 'concierge', 'content', 'staff', 'settings'].includes(activeTab) && <Placeholder tab={activeLabel} rows={rows} />}
        </main>
      </div>
    </div>
  );
}


function rowValue(row, fields) {
  return fields.map((field) => row[field]).find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
}

function normalizeStatus(value) {
  const text = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (['CONFIRMED', 'FULLY_PAID'].includes(text)) return 'Confirmed';
  if (['CHECKED_IN', 'IN_HOUSE', 'ARRIVED'].includes(text)) return 'Checked In';
  if (['CHECKED_OUT', 'DEPARTED', 'COMPLETED'].includes(text)) return 'Checked Out';
  if (['CANCELLED', 'CANCELED'].includes(text)) return 'Cancelled';
  return 'Pending';
}

function dateOnly(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stayBucket(row) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkIn = dateOnly(rowValue(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']));
  const checkOut = dateOnly(rowValue(row, ['check_out', 'checkOut', 'departure_date', 'departureDate']));
  if (checkIn && checkIn > today) return 'Upcoming';
  if (checkIn && checkOut && checkIn <= today && today <= checkOut) return 'In-house';
  if (checkOut && checkOut < today) return 'Past';
  return 'All';
}

function reservationSearchText(row) {
  return [
    rowValue(row, ['guest_name', 'name', 'full_name', 'guestName']),
    rowValue(row, ['guest_email', 'email', 'guestEmail']),
    rowValue(row, ['guest_phone', 'phone', 'phone_number', 'whatsapp', 'guestPhone']),
    rowValue(row, ['booking_reference', 'reference', 'booking_code', 'code']),
    rowValue(row, ['accommodation_name', 'accommodation', 'room_name', 'villa_name', 'room', 'villa']),
    rowValue(row, ['notes', 'special_requests', 'message', 'guest_notes', 'arrival_notes']),
  ].join(' ').toLowerCase();
}

function bookingTimestamp(row) {
  const value = rowValue(row, ['created_at', 'booking_created_at', 'booking_date', 'createdAt', 'updated_at']);
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
}

function filterReservations(rows, controls) {
  const needle = controls.search.trim().toLowerCase();
  return rows
    .filter((row) => !needle || reservationSearchText(row).includes(needle))
    .filter((row) => controls.status === 'All' || normalizeStatus(rowValue(row, ['booking_status', 'status'])) === controls.status)
    .filter((row) => controls.stay === 'All' || stayBucket(row) === controls.stay)
    .slice()
    .sort((a, b) => {
      if (controls.sort === 'Check-in soonest') return (dateOnly(rowValue(a, ['check_in', 'checkIn']))?.getTime() || Number.MAX_SAFE_INTEGER) - (dateOnly(rowValue(b, ['check_in', 'checkIn']))?.getTime() || Number.MAX_SAFE_INTEGER);
      if (controls.sort === 'Guest name A-Z') return String(rowValue(a, ['guest_name', 'name', 'full_name', 'guestName'])).localeCompare(String(rowValue(b, ['guest_name', 'name', 'full_name', 'guestName'])));
      if (controls.sort === 'Status A-Z') return normalizeStatus(rowValue(a, ['booking_status', 'status'])).localeCompare(normalizeStatus(rowValue(b, ['booking_status', 'status'])));
      return bookingTimestamp(b) - bookingTimestamp(a);
    });
}

function filterRows(rows, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
}

function LoginScreen({ accessKey, setAccessKey, onSubmit, loading, error }) {
  return <div className="min-h-screen bg-[#17130F] flex items-center justify-center p-4"><form onSubmit={onSubmit} className="w-full max-w-md bg-[#FBFAF7] rounded-md p-8 shadow-2xl border-t-4 border-[#B8977E]"><div className="text-center mb-8"><p className="text-[10px] text-[#B8977E] tracking-[0.32em] uppercase">Pueblo La Perla</p><h1 className="text-4xl text-[#17130F] tracking-[-0.05em] font-light">Resort Command</h1><p className="text-xs text-[#6A645B] mt-3 uppercase tracking-widest">Reservation Reconciliation</p></div><label className="block text-[10px] font-bold text-[#6A645B] uppercase tracking-widest mb-2">PLP Access Key</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A645B]" size={16} /><input type="password" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} required className="w-full bg-white border border-[#E5E0D8] text-[#17130F] rounded-sm pl-10 pr-4 py-3 focus:outline-none focus:border-[#B8977E] text-sm" placeholder="Enter access key" /></div>{error && <div className="mt-4 bg-red-50 border border-red-100 text-red-700 rounded-sm px-3 py-2 text-xs">{error}</div>}<button disabled={loading} className="mt-6 w-full bg-[#17130F] text-[#F4F0E8] py-3 rounded-sm font-medium disabled:opacity-60">{loading ? 'Loading database...' : 'Open Resort Command'}</button><p className="text-center mt-6 text-[10px] text-[#6A645B] uppercase tracking-widest">Authorized personnel only</p></form></div>;
}

function Dashboard({ kpis }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"><Metric icon={Database} label="Reservation Rows" value={kpis.bookings} help="All rows from payment reconciliation" /><Metric icon={CheckCircle2} label="Verified Deposits" value={kpis.verified} help="payment_verification_status = VERIFIED" /><Metric icon={Clock} label="Need Review" value={kpis.review} help="Not confirmed, fully paid, or cancelled" /><Metric icon={AlertCircle} label="Payment Exceptions" value={kpis.exceptions} help="Payment mismatches / unmatched events" tone="danger" /><Metric icon={Bell} label="Notifications" value={kpis.notifications} help="Notification activity rows" /><Metric icon={TrendingUp} label="Verified Deposit Total" value={money(kpis.verifiedDepositTotal)} help="Sum of verified deposits" dark /></div>;
}

function Metric({ icon: Icon, label, value, help, tone, dark }) {
  return <div className={`${dark ? 'bg-[#17130F] text-[#F4F0E8] border-[#2A241D]' : tone === 'danger' ? 'bg-white border-red-200' : 'bg-white border-[#E5E0D8]'} border rounded-md p-5 shadow-sm`}><div className="flex items-center justify-between"><p className={`text-xs tracking-widest uppercase font-semibold ${dark ? 'text-[#B8977E]' : tone === 'danger' ? 'text-red-800' : 'text-[#6A645B]'}`}>{label}</p><Icon size={17} className={tone === 'danger' ? 'text-red-500' : 'text-[#B8977E]'} /></div><p className="text-3xl font-light mt-4">{value}</p><p className="text-xs text-[#6A645B] mt-1">{help}</p></div>;
}

function BookingCard({ row, updateBooking }) {
  return <article className="bg-white border border-[#E5E0D8] rounded-md p-4 shadow-sm space-y-3"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-bold leading-tight text-[#17130F]">{row.booking_reference || '—'}</p><p className="text-xs uppercase tracking-widest text-[#6A645B]">{row.provider || 'XENDIT'}</p></div><Pill value={row.payment_verification_status || row.booking_status} /></div><div><p className="font-medium text-[#17130F]">{row.guest_name || '—'}</p><p className="text-xs text-[#6A645B] break-all">{row.guest_email || ''}</p></div><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-[10px] uppercase tracking-widest text-[#6A645B]">Stay</p><p>{row.accommodation_name || '—'}</p><p className="text-[#6A645B]">{row.check_in || '—'} → {row.check_out || '—'}</p></div><div><p className="text-[10px] uppercase tracking-widest text-[#6A645B]">Amounts</p><p>Total: {money(row.total_amount_php)}</p><p>Deposit: {money(row.deposit_amount_php)}</p><p>Balance: {money(row.balance_amount_php)}</p></div></div><div className="grid grid-cols-2 gap-2 text-xs"><div><span className="text-[#6A645B]">Booking</span><br /><Pill value={row.booking_status} /></div><div><span className="text-[#6A645B]">Payment</span><br /><Pill value={row.payment_status || row.booking_payment_status} /></div></div><div className="flex flex-wrap gap-2 pt-2"><Action onClick={() => updateBooking(row.booking_reference, 'CONFIRMED')} tone="good">Confirm</Action><Action onClick={() => updateBooking(row.booking_reference, 'PAYMENT_PROCESSING')} tone="warn">Review</Action><Action onClick={() => updateBooking(row.booking_reference, 'CANCELLED')} tone="bad">Cancel</Action></div></article>;
}

function BookingsTable({ rows, totalRows, controls, updateBooking }) {
  const emptyMessage = totalRows === 0 ? 'No reservations loaded yet.' : 'No reservations match the current search or filters.';

  return <Panel title="Reservations" count={rows.length}><ReservationControls rowsShown={rows.length} totalRows={totalRows} controls={controls} /><div className="grid gap-3 md:hidden">{rows.length === 0 ? <div className="text-center text-[#6A645B] py-8">{emptyMessage}</div> : rows.map((row) => <BookingCard key={row.booking_reference || row.provider_payment_id || JSON.stringify(row)} row={row} updateBooking={updateBooking} />)}</div><div className="hidden md:block"><Table columns={['Ref', 'Guest', 'Stay', 'Amounts', 'Booking', 'Payment', 'Verification', 'Actions']}>{rows.length === 0 ? <Empty colSpan={8} text={emptyMessage} /> : rows.map((row) => <tr key={row.booking_reference || row.provider_payment_id || JSON.stringify(row)} className="hover:bg-[#F4F0E8]/40"><td className="cell"><strong>{row.booking_reference || '—'}</strong><br /><span className="muted">{row.provider || 'XENDIT'}</span></td><td className="cell">{row.guest_name || '—'}<br /><span className="muted">{row.guest_email || ''}</span></td><td className="cell">{row.accommodation_name || '—'}<br /><span className="muted">{row.check_in || '—'} → {row.check_out || '—'}</span></td><td className="cell">Total: {money(row.total_amount_php)}<br />Deposit: {money(row.deposit_amount_php)}<br />Balance: {money(row.balance_amount_php)}</td><td className="cell"><Pill value={row.booking_status} /></td><td className="cell"><Pill value={row.payment_status || row.booking_payment_status} /><br /><span className="muted">{row.provider_payment_id || row.provider_session_id || 'No provider ID yet'}</span></td><td className="cell"><Pill value={row.payment_verification_status} /><br /><span className="muted">{row.verification_error || ''}</span></td><td className="cell"><div className="flex flex-wrap gap-2"><Action onClick={() => updateBooking(row.booking_reference, 'CONFIRMED')} tone="good">Confirm</Action><Action onClick={() => updateBooking(row.booking_reference, 'PAYMENT_PROCESSING')} tone="warn">Review</Action><Action onClick={() => updateBooking(row.booking_reference, 'CANCELLED')} tone="bad">Cancel</Action></div></td></tr>)}</Table></div></Panel>;
}


function ReservationControls({ rowsShown, totalRows, controls }) {
  return <div className="mb-5 rounded-md border border-[#D8CEC0] bg-[#FBFAF7] p-4 shadow-sm">
    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#B8977E]">Reservation desk</p><h4 className="font-serif text-2xl font-light text-[#17130F]">Find and prepare each stay</h4></div>
      <p className="text-sm text-[#6A645B]">Showing <span className="font-semibold text-[#17130F]">{rowsShown}</span> of <span className="font-semibold text-[#17130F]">{totalRows}</span> reservations</p>
    </div>
    <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(160px,0.8fr))]">
      <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#6A645B]">Search reservations</span><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7A63]" size={16} /><input value={controls.reservationSearch} onChange={(event) => controls.setReservationSearch(event.target.value)} placeholder="Guest, email, phone, ref, villa, notes..." className="w-full rounded-sm border border-[#E5E0D8] bg-white py-2.5 pl-9 pr-3 text-sm text-[#17130F] placeholder:text-[#9B9287] focus:border-[#B8977E] focus:outline-none" /></div></label>
      <SelectControl label="Status" value={controls.reservationStatus} onChange={controls.setReservationStatus} options={RESERVATION_STATUS_OPTIONS} />
      <SelectControl label="Stay" value={controls.stayFilter} onChange={controls.setStayFilter} options={STAY_FILTER_OPTIONS} />
      <SelectControl label="Sort" value={controls.reservationSort} onChange={controls.setReservationSort} options={SORT_OPTIONS} />
    </div>
  </div>;
}

function SelectControl({ label, value, onChange, options }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#6A645B]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-sm border border-[#E5E0D8] bg-white px-3 py-2.5 text-sm text-[#17130F] focus:border-[#B8977E] focus:outline-none">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function ExceptionsTable({ rows }) {
  return <Panel title="Payment Exceptions" count={rows.length}><Table columns={['Reference', 'Issue', 'Expected', 'Received', 'Event', 'Notes']}>{rows.length === 0 ? <Empty colSpan={6} text="No payment exceptions." /> : rows.map((row) => <tr key={row.id || row.provider_event_id || JSON.stringify(row)} className="hover:bg-[#F4F0E8]/40"><td className="cell"><strong>{row.booking_reference || row.provider_reference_id || '—'}</strong></td><td className="cell"><Pill value={row.verification_status} /></td><td className="cell">{money(row.expected_amount_php)} {row.expected_currency || 'PHP'}</td><td className="cell">{money(row.amount_php)} {row.currency || ''}</td><td className="cell">{row.event_type || '—'}<br /><span className="muted">{row.provider_event_id || ''}</span></td><td className="cell">{row.verification_notes || '—'}</td></tr>)}</Table></Panel>;
}

function NotificationsTable({ rows }) {
  return <Panel title="Notification Activity" count={rows.length}><Table columns={['Reference', 'Recipient', 'Subject', 'Status', 'Sent', 'Error']}>{rows.length === 0 ? <Empty colSpan={6} text="No notification activity." /> : rows.map((row) => <tr key={row.id || `${row.booking_reference}-${row.notification_key}`} className="hover:bg-[#F4F0E8]/40"><td className="cell"><strong>{row.booking_reference || '—'}</strong><br /><span className="muted">{row.notification_key || ''}</span></td><td className="cell">{row.recipient_type || '—'}<br /><span className="muted">{row.recipient_email || 'No recipient'}</span></td><td className="cell">{row.subject || '—'}</td><td className="cell"><Pill value={row.status} /></td><td className="cell">{row.sent_at || row.created_at || '—'}</td><td className="cell">{row.error || '—'}</td></tr>)}</Table></Panel>;
}

function Placeholder({ tab, rows }) { return <Panel title={tab} count={rows.length}><div className="bg-[#F7F2EA] border border-dashed border-[#E5E0D8] rounded-xl p-8 text-center text-[#6A645B]"><p className="text-sm uppercase tracking-widest text-[#17130F]">{tab} module staged</p><p className="mt-2 text-sm">This section is now part of the Resort Command IA. It will be wired to dedicated tables/endpoints after Reservations, Payments, and Reservation 360 are stable.</p></div></Panel>; }
function Panel({ title, count, children }) { return <section className="bg-white border border-[#E5E0D8] rounded-md shadow-sm overflow-hidden"><div className="p-5 border-b border-[#E5E0D8] bg-[#FBFAF7] flex items-center justify-between"><h3 className="text-sm tracking-widest uppercase font-semibold text-[#17130F]">{title}</h3>{count !== undefined && <span className="text-xs text-[#6A645B]">{count} rows</span>}</div><div className="p-4 md:p-5">{children}</div></section>; }
function Table({ columns, children }) { return <div className="overflow-x-auto border border-[#E5E0D8] rounded-sm"><table className="w-full text-left border-collapse min-w-[1080px]"><thead><tr className="bg-[#F4F0E8]/60">{columns.map((column) => <th key={column} className="py-4 px-6 text-[10px] font-semibold tracking-widest text-[#6A645B] uppercase">{column}</th>)}</tr></thead><tbody className="text-sm divide-y divide-[#E5E0D8]">{children}</tbody></table></div>; }
function Empty({ colSpan, text }) { return <tr><td colSpan={colSpan} className="py-10 px-6 text-center text-[#6A645B]">{text}</td></tr>; }
function Action({ children, onClick, tone }) { const cls = tone === 'good' ? 'bg-green-50 text-green-700 border-green-100' : tone === 'bad' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100'; return <button onClick={onClick} className={`border rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${cls}`}>{children}</button>; }
