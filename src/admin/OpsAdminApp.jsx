import React, { useMemo, useState } from 'react';
import { AlertCircle, Bell, Calendar, CheckCircle2, Clock, Database, FileText, LayoutDashboard, Link2, Lock, LogOut, RefreshCw, Search, Settings, Shield, TrendingUp, Users } from 'lucide-react';
import { OTA_ADMIN_SECTIONS, OTA_CHANNELS, OTA_CHANNEL_LABELS, OTA_FOUNDATION_NOTICE, OTA_SYNC_STATUSES, listSupportedOtaChannels } from '../../lib/ota/channels.js';

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
  { id: 'channel-sync', label: 'Channel Sync', icon: Link2 },
];

const SEARCHABLE_TABS = new Set(['exceptions', 'notifications']);
const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH')}`;
const RESERVATION_STATUS_OPTIONS = ['All', 'Pending', 'Awaiting deposit', 'Payment processing', 'Deposit verified', 'Confirmed', 'Checked In', 'Checked Out', 'Cancelled', 'Review needed'];
const STAY_FILTER_OPTIONS = ['All', 'Upcoming', 'In-house', 'Past'];
const SORT_OPTIONS = ['Newest booking first', 'Check-in soonest', 'Guest name A-Z', 'Status A-Z'];

const isReviewBooking = (row) => !['CONFIRMED', 'FULLY_PAID', 'CANCELLED'].includes(String(row.booking_status || row.status || '').toUpperCase());

function statusClass(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('SENT') || text.includes('VERIFIED') || text.includes('CONFIRMED') || text.includes('SUCCEEDED') || text.includes('CAPTURED') || text.includes('SYNCED')) return 'bg-green-50 text-green-700 border-green-100';
  if (text.includes('FAILED') || text.includes('MISMATCH') || text.includes('UNMATCHED') || text.includes('CANCELLED') || text.includes('EXPIRED') || text.includes('CONFLICT')) return 'bg-red-50 text-red-700 border-red-100';
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
        setMessage('Live reservations and payment checks are ready. Notifications are ready too.');
      } catch {
        setNotifications([]);
        setMessage('Live reservations and payment checks are ready. Notifications can be retried later.');
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
  const showGlobalSearch = SEARCHABLE_TABS.has(activeTab);

  return (
    <div className="min-h-screen bg-[#F7F2EA] text-[#211F1B]">
      <div className="flex items-center justify-between gap-3 border-b border-[#B8977E]/20 bg-[#17130F] px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-[#B8977E]">
        <span>PLP Resort Command · Reservations</span>
        <span className="shrink-0 text-[#6A645B]">Last Sync: {lastSync ? lastSync.toLocaleTimeString() : 'Not loaded'}</span>
      </div>
      <div className="grid min-h-[calc(100vh-30px)] lg:grid-cols-[260px_1fr]">
        <aside className="bg-[#17130F] p-4 text-white lg:p-6">
          <div className="mb-4 lg:mb-8">
            <p className="text-[10px] uppercase tracking-[0.32em] text-[#B8977E]">Pueblo La Perla</p>
            <h1 className="text-2xl font-light tracking-[-0.05em] lg:text-3xl">Resort Command</h1>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-[#6A645B]">Reservations first · live database</p>
          </div>
          <nav className="grid max-h-[42vh] grid-cols-2 gap-2 overflow-y-auto pr-1 lg:max-h-none lg:grid-cols-1 lg:space-y-1 lg:pr-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex min-h-11 w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs transition lg:text-sm ${activeTab === tab.id ? 'bg-[#B8977E]/10 text-[#B8977E]' : 'text-[#8C8378] hover:bg-white/5 hover:text-[#F4F0E8]'}`}><Icon size={16} /> <span>{tab.label}</span></button>;
            })}
          </nav>
          <button onClick={logout} className="mt-4 flex w-full items-center justify-between border-t border-[#B8977E]/10 pt-4 text-sm text-[#6A645B] hover:text-[#B8977E]">Secure Logout <LogOut size={16} /></button>
        </aside>
        <main className="min-w-0 overflow-auto p-4 md:p-8">
          <header className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#B8977E]">Pueblo La Perla Resort Operations</p>
              <h2 className="text-3xl font-light tracking-[-0.05em] text-[#17130F] md:text-4xl">{activeLabel}</h2>
              <p className="mt-2 max-w-3xl text-sm text-[#6A645B]">A quiet luxury command center for reservations, payments, villa readiness, guest memory, Boracay service delivery, and future OTA sync.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {showGlobalSearch && <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A645B]" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ref, guest, payment, email..." className="w-full rounded-sm border border-[#E5E0D8] bg-white py-2.5 pl-9 pr-4 text-sm focus:border-[#B8977E] focus:outline-none" /></div>}
              <button onClick={() => loadData(accessKey)} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-[#17130F] px-4 py-2.5 text-sm font-medium text-[#F4F0E8] disabled:opacity-60"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
            </div>
          </header>
          {message && <div className="mb-4 rounded-sm border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
          {error && <div className="mb-4 rounded-sm border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {activeTab === 'bookings' && <BookingsTable rows={filteredRows} totalRows={rows.length} controls={{ reservationSearch, setReservationSearch, reservationStatus, setReservationStatus, stayFilter, setStayFilter, reservationSort, setReservationSort }} updateBooking={updateBooking} />}
          {activeTab === 'dashboard' && <Dashboard kpis={kpis} />}
          {activeTab === 'exceptions' && <ExceptionsTable rows={filteredExceptions} />}
          {activeTab === 'notifications' && <NotificationsTable rows={filteredNotifications} />}
          {activeTab === 'channel-sync' && <ChannelSyncFoundation />}
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
  if (['PAID_DEPOSIT', 'DEPOSIT_VERIFIED'].includes(text)) return 'Deposit verified';
  if (['PAYMENT_PROCESSING', 'PROCESSING'].includes(text)) return 'Payment processing';
  if (['PENDING_PAYMENT', 'AWAITING_DEPOSIT'].includes(text)) return 'Awaiting deposit';
  if (['REVIEW_NEEDED', 'NEEDS_REVIEW', 'EXCEPTION'].includes(text)) return 'Review needed';
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
    rowValue(row, ['guest_count', 'guests', 'party_size']),
    rowValue(row, ['payment_status', 'booking_payment_status', 'payment_verification_status']),
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
  return <div className="flex min-h-screen items-center justify-center bg-[#17130F] p-4"><form onSubmit={onSubmit} className="w-full max-w-md rounded-md border-t-4 border-[#B8977E] bg-[#FBFAF7] p-6 shadow-2xl md:p-8"><div className="mb-8 text-center"><p className="text-[10px] uppercase tracking-[0.32em] text-[#B8977E]">Pueblo La Perla</p><h1 className="text-4xl font-light tracking-[-0.05em] text-[#17130F]">Resort Command</h1><p className="mt-3 text-xs uppercase tracking-widest text-[#6A645B]">Reservation Reconciliation</p></div><label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#6A645B]">PLP Access Key</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A645B]" size={16} /><input type="password" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} required className="w-full rounded-sm border border-[#E5E0D8] bg-white py-3 pl-10 pr-4 text-sm text-[#17130F] focus:border-[#B8977E] focus:outline-none" placeholder="Enter access key" /></div>{error && <div className="mt-4 rounded-sm border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}<button disabled={loading} className="mt-6 w-full rounded-sm bg-[#17130F] py-3 font-medium text-[#F4F0E8] disabled:opacity-60">{loading ? 'Loading database...' : 'Open Resort Command'}</button><p className="mt-6 text-center text-[10px] uppercase tracking-widest text-[#6A645B]">Authorized personnel only</p></form></div>;
}

function Dashboard({ kpis }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"><Metric icon={Database} label="Reservation Rows" value={kpis.bookings} help="All rows from payment reconciliation" /><Metric icon={CheckCircle2} label="Verified Deposits" value={kpis.verified} help="payment_verification_status = VERIFIED" /><Metric icon={Clock} label="Need Review" value={kpis.review} help="Not confirmed, fully paid, or cancelled" /><Metric icon={AlertCircle} label="Payment Exceptions" value={kpis.exceptions} help="Payment mismatches / unmatched events" tone="danger" /><Metric icon={Bell} label="Notifications" value={kpis.notifications} help="Notification activity rows" /><Metric icon={TrendingUp} label="Verified Deposit Total" value={money(kpis.verifiedDepositTotal)} help="Sum of verified deposits" dark /></div>;
}

function Metric({ icon: Icon, label, value, help, tone, dark }) {
  return <div className={`${dark ? 'bg-[#17130F] text-[#F4F0E8] border-[#2A241D]' : tone === 'danger' ? 'bg-white border-red-200' : 'bg-white border-[#E5E0D8]'} rounded-md border p-5 shadow-sm`}><div className="flex items-center justify-between"><p className={`text-xs font-semibold uppercase tracking-widest ${dark ? 'text-[#B8977E]' : tone === 'danger' ? 'text-red-800' : 'text-[#6A645B]'}`}>{label}</p><Icon size={17} className={tone === 'danger' ? 'text-red-500' : 'text-[#B8977E]'} /></div><p className="mt-4 text-3xl font-light">{value}</p><p className="mt-1 text-xs text-[#6A645B]">{help}</p></div>;
}

function BookingCard({ row, updateBooking }) {
  const guestPhone = rowValue(row, ['guest_phone', 'phone', 'phone_number', 'whatsapp', 'guestPhone']);
  const guestCount = rowValue(row, ['guest_count', 'guests', 'party_size']);
  const requests = rowValue(row, ['special_requests', 'notes', 'message', 'guest_notes', 'arrival_notes']);
  return <article className="space-y-3 rounded-md border border-[#E5E0D8] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-bold leading-tight text-[#17130F]">{row.booking_reference || '—'}</p><p className="text-xs uppercase tracking-widest text-[#6A645B]">{row.provider || 'XENDIT'}</p></div><Pill value={row.payment_verification_status || row.booking_status} /></div><div><p className="font-medium text-[#17130F]">{row.guest_name || '—'}</p><p className="break-all text-xs text-[#6A645B]">{row.guest_email || ''}</p><p className="text-xs text-[#6A645B]">{guestPhone || 'No phone captured'} · {guestCount || '—'} guests</p></div><div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"><div><p className="text-[10px] uppercase tracking-widest text-[#6A645B]">Stay</p><p>{row.accommodation_name || '—'}</p><p className="text-[#6A645B]">{row.check_in || '—'} → {row.check_out || '—'}</p><p className="text-[#6A645B]">{guestCount || '—'} guests</p></div><div><p className="text-[10px] uppercase tracking-widest text-[#6A645B]">Amounts</p><p>Total: {money(row.total_amount_php)}</p><p>Deposit: {money(row.deposit_amount_php)}</p><p>Balance: {money(row.balance_amount_php)}</p></div></div>{requests && <div className="rounded-sm bg-[#F7F2EA] px-3 py-2 text-xs text-[#6A645B]"><span className="font-semibold uppercase tracking-widest text-[#17130F]">Requests</span><br />{requests}</div>}<div className="grid grid-cols-2 gap-2 text-xs"><div><span className="text-[#6A645B]">Booking</span><br /><Pill value={row.booking_status} /></div><div><span className="text-[#6A645B]">Payment</span><br /><Pill value={row.payment_status || row.booking_payment_status} /></div></div><div className="grid gap-2 pt-2 sm:flex sm:flex-wrap"><Action onClick={() => updateBooking(row.booking_reference, 'CONFIRMED')} tone="good">Confirm after verified deposit</Action><Action onClick={() => updateBooking(row.booking_reference, 'PAYMENT_PROCESSING')} tone="warn">Mark payment review</Action><Action onClick={() => updateBooking(row.booking_reference, 'CANCELLED')} tone="bad">Cancel</Action></div></article>;
}

function BookingsTable({ rows, totalRows, controls, updateBooking }) {
  const emptyMessage = totalRows === 0 ? 'No reservations loaded yet.' : 'No reservations match the current search or filters.';
  return <Panel title="Reservations" count={rows.length}><ReservationControls rowsShown={rows.length} totalRows={totalRows} controls={controls} /><div className="grid gap-3 md:hidden">{rows.length === 0 ? <div className="py-8 text-center text-[#6A645B]">{emptyMessage}</div> : rows.map((row) => <BookingCard key={row.booking_reference || row.provider_payment_id || JSON.stringify(row)} row={row} updateBooking={updateBooking} />)}</div><div className="hidden md:block"><Table columns={['Ref', 'Guest', 'Stay', 'Requests', 'Amounts', 'Booking', 'Payment', 'Verification', 'Actions']}>{rows.length === 0 ? <Empty colSpan={9} text={emptyMessage} /> : rows.map((row) => <tr key={row.booking_reference || row.provider_payment_id || JSON.stringify(row)} className="hover:bg-[#F4F0E8]/40"><td className="cell"><strong>{row.booking_reference || '—'}</strong><br /><span className="muted">{row.provider || 'XENDIT'}</span></td><td className="cell">{row.guest_name || '—'}<br /><span className="muted">{row.guest_email || ''}</span><br /><span className="muted">{rowValue(row, ['guest_phone', 'phone', 'phone_number', 'whatsapp', 'guestPhone']) || 'No phone captured'}</span></td><td className="cell">{row.accommodation_name || '—'}<br /><span className="muted">{row.check_in || '—'} → {row.check_out || '—'}</span><br /><span className="muted">{rowValue(row, ['guest_count', 'guests', 'party_size']) || '—'} guests</span></td><td className="cell max-w-[240px]"><span className="muted">{rowValue(row, ['special_requests', 'notes', 'message', 'guest_notes', 'arrival_notes']) || 'No requests noted'}</span></td><td className="cell">Total: {money(row.total_amount_php)}<br />Deposit: {money(row.deposit_amount_php)}<br />Balance: {money(row.balance_amount_php)}</td><td className="cell"><Pill value={row.booking_status} /></td><td className="cell"><Pill value={row.payment_status || row.booking_payment_status} /><br /><span className="muted">{row.provider_payment_id || row.provider_session_id || 'No provider ID yet'}</span></td><td className="cell"><Pill value={row.payment_verification_status} /><br /><span className="muted">{row.verification_error || row.verification_note || 'Webhook verification is the payment source of truth'}</span></td><td className="cell"><div className="flex flex-wrap gap-2"><Action onClick={() => updateBooking(row.booking_reference, 'CONFIRMED')} tone="good">Confirm after verified deposit</Action><Action onClick={() => updateBooking(row.booking_reference, 'PAYMENT_PROCESSING')} tone="warn">Mark payment review</Action><Action onClick={() => updateBooking(row.booking_reference, 'CANCELLED')} tone="bad">Cancel</Action></div></td></tr>)}</Table></div></Panel>;
}

function ReservationControls({ rowsShown, totalRows, controls }) {
  return <div className="mb-5 rounded-md border border-[#D8CEC0] bg-[#FBFAF7] p-4 shadow-sm"><div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#B8977E]">Reservation desk</p><h4 className="font-serif text-2xl font-light text-[#17130F]">Find and prepare each stay</h4></div><p className="text-sm text-[#6A645B]">Showing <span className="font-semibold text-[#17130F]">{rowsShown}</span> of <span className="font-semibold text-[#17130F]">{totalRows}</span> reservations</p></div><div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(160px,0.8fr))]"><label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#6A645B]">Search reservations</span><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7A63]" size={16} /><input value={controls.reservationSearch} onChange={(event) => controls.setReservationSearch(event.target.value)} placeholder="Guest, email, phone, ref, villa, notes..." className="w-full rounded-sm border border-[#E5E0D8] bg-white py-2.5 pl-9 pr-3 text-sm text-[#17130F] placeholder:text-[#9B9287] focus:border-[#B8977E] focus:outline-none" /></div></label><SelectControl label="Status" value={controls.reservationStatus} onChange={controls.setReservationStatus} options={RESERVATION_STATUS_OPTIONS} /><SelectControl label="Stay" value={controls.stayFilter} onChange={controls.setStayFilter} options={STAY_FILTER_OPTIONS} /><SelectControl label="Sort" value={controls.reservationSort} onChange={controls.setReservationSort} options={SORT_OPTIONS} /></div></div>;
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

function ChannelSyncFoundation() {
  const channels = listSupportedOtaChannels();
  const statusList = Object.values(OTA_SYNC_STATUSES);
  return <Panel title="OTA Channel Sync Foundation" count={OTA_ADMIN_SECTIONS.length}><div className="space-y-5"><div className="rounded-md border border-[#D8CEC0] bg-[#FBFAF7] p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#B8977E]">Phase 2A foundation only</p><h4 className="mt-1 font-serif text-2xl font-light text-[#17130F]">Future external booking and calendar sync command center</h4><p className="mt-3 text-sm font-semibold text-[#17130F]">{OTA_FOUNDATION_NOTICE}</p><p className="mt-2 max-w-4xl text-sm text-[#6A645B]">No live Booking.com, Agoda, Airbnb, Expedia, or Vrbo API calls are made from this screen. No OTA credentials are requested or stored client-side. Imported bookings, iCal feeds, room mapping, availability blocks, conflicts, and sync logs are staged as a records-first model for future reviewed backend work.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{OTA_ADMIN_SECTIONS.map((section) => <div key={section.id} className="rounded-md border border-[#E5E0D8] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-[#B8977E]">Placeholder</p><h5 className="mt-1 text-lg font-semibold text-[#17130F]">{section.label}</h5></div><Pill value={section.status} /></div><p className="mt-3 text-sm text-[#6A645B]">{section.description}</p></div>)}</div><div className="grid gap-4 xl:grid-cols-[1fr_1fr]"><div className="rounded-md border border-[#E5E0D8] bg-[#F7F2EA] p-4"><p className="text-[10px] font-semibold uppercase tracking-widest text-[#6A645B]">Supported future channels</p><div className="mt-3 flex flex-wrap gap-2">{channels.map((channel) => <span key={channel.id} className="rounded-full border border-[#D8CEC0] bg-white px-3 py-1 text-xs font-semibold text-[#17130F]">{channel.label}</span>)}</div><p className="mt-3 break-words text-xs text-[#6A645B]">Internal keys: {Object.values(OTA_CHANNELS).join(', ')}</p></div><div className="rounded-md border border-[#E5E0D8] bg-[#F7F2EA] p-4"><p className="text-[10px] font-semibold uppercase tracking-widest text-[#6A645B]">Shared statuses</p><div className="mt-3 flex flex-wrap gap-2">{statusList.map((status) => <Pill key={status} value={status} />)}</div><p className="mt-3 text-xs text-[#6A645B]">Direct website remains {OTA_CHANNEL_LABELS.direct}; staff-created rows remain {OTA_CHANNEL_LABELS.manual}. Payment verification remains outside OTA sync.</p></div></div></div></Panel>;
}

function Placeholder({ tab, rows }) {
  return <Panel title={tab} count={rows.length}><div className="rounded-xl border border-dashed border-[#E5E0D8] bg-[#F7F2EA] p-8 text-center text-[#6A645B]"><p className="text-sm uppercase tracking-widest text-[#17130F]">{tab} module staged</p><p className="mt-2 text-sm">This section is now part of the Resort Command IA. It will be wired to dedicated tables/endpoints after Reservations, Payments, and Reservation 360 are stable.</p></div></Panel>;
}
function Panel({ title, count, children }) {
  return <section className="overflow-hidden rounded-md border border-[#E5E0D8] bg-white shadow-sm"><div className="flex flex-col gap-2 border-b border-[#E5E0D8] bg-[#FBFAF7] p-4 sm:flex-row sm:items-center sm:justify-between md:p-5"><h3 className="text-sm font-semibold uppercase tracking-widest text-[#17130F]">{title}</h3>{count !== undefined && <span className="text-xs text-[#6A645B]">{count} rows</span>}</div><div className="p-4 md:p-5">{children}</div></section>;
}
function Table({ columns, children }) {
  return <div className="overflow-x-auto rounded-sm border border-[#E5E0D8]"><table className="w-full min-w-[1080px] border-collapse text-left"><thead><tr className="bg-[#F4F0E8]/60">{columns.map((column) => <th key={column} className="px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-[#6A645B]">{column}</th>)}</tr></thead><tbody className="divide-y divide-[#E5E0D8] text-sm">{children}</tbody></table></div>;
}
function Empty({ colSpan, text }) { return <tr><td colSpan={colSpan} className="px-6 py-10 text-center text-[#6A645B]">{text}</td></tr>; }
function Action({ children, onClick, tone }) { const cls = tone === 'good' ? 'bg-green-50 text-green-700 border-green-100' : tone === 'bad' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100'; return <button onClick={onClick} className={`rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${cls}`}>{children}</button>; }
