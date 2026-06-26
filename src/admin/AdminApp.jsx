import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  CreditCard,
  Database,
  ExternalLink,
  FileText,
  History,
  Key,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Shield,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react';

const PERMISSIONS = {
  SUPER_ADMIN: ['staff.read', 'staff.create', 'staff.update', 'staff.disable', 'booking.read', 'booking.confirm', 'booking.cancel', 'payment.review', 'payment.export', 'content.publish', 'availability.read', 'availability.block', 'audit.read'],
  FINANCE: ['booking.read', 'payment.review', 'payment.export', 'audit.read'],
  RECEPTION: ['booking.read', 'booking.contact', 'availability.read', 'availability.block'],
};

const STAFF_ROLES = [
  { value: 'Super Admin', key: 'SUPER_ADMIN', label: 'Super Admin (Full Access)' },
  { value: 'Finance', key: 'FINANCE', label: 'Finance & Payments' },
  { value: 'Reception', key: 'RECEPTION', label: 'Reception & Operations' },
];

const MOCK_USERS = [
  { id: 'usr_01', name: 'Joven', role: 'Super Admin', roleKey: 'SUPER_ADMIN', permissions: PERMISSIONS.SUPER_ADMIN, email: 'joven@plp.com', status: 'Active', mfa: true, lastActive: 'Just now' },
  { id: 'usr_02', name: 'Melodee', role: 'Super Admin', roleKey: 'SUPER_ADMIN', permissions: PERMISSIONS.SUPER_ADMIN, email: 'melodee@plp.com', status: 'Active', mfa: true, lastActive: '2 mins ago' },
  { id: 'usr_03', name: 'Front Desk A', role: 'Reception', roleKey: 'RECEPTION', permissions: PERMISSIONS.RECEPTION, email: 'frontdesk@plp.com', status: 'Active', mfa: false, lastActive: '1 hr ago' },
  { id: 'usr_04', name: 'Finance B', role: 'Finance', roleKey: 'FINANCE', permissions: PERMISSIONS.FINANCE, email: 'finance@plp.com', status: 'Inactive', mfa: true, lastActive: '2 days ago' },
];

const MOCK_LOGS = [
  { id: 'log_992', created_at: '2026-10-24T14:32:01+08:00', actor_name: 'Melodee', actor_role: 'Super Admin', action: 'BOOKING_CONFIRMED', entity_type: 'booking', entity_id: 'BKG-883A', severity: 'high', ip_address: '112.201.33.4', previous_state: { status: 'PAYMENT_PROCESSING' }, new_state: { status: 'CONFIRMED' }, reason: 'Wire transfer verified by bank', request_id: 'req_88a1b2' },
  { id: 'log_991', created_at: '2026-10-24T11:15:44+08:00', actor_name: 'Joven', actor_role: 'Super Admin', action: 'ROLE_UPDATED', entity_type: 'staff', entity_id: 'usr_03', severity: 'critical', ip_address: '112.201.33.4', previous_state: { role: 'Guest Services' }, new_state: { role: 'Reception' }, reason: 'Promotion', request_id: 'req_99b2c3' },
  { id: 'log_990', created_at: '2026-10-24T09:02:11+08:00', actor_name: 'Front Desk A', actor_role: 'Reception', action: 'DATE_BLOCKED', entity_type: 'availability', entity_id: 'VIL-1-OCT28', severity: 'medium', ip_address: '202.14.99.1', previous_state: null, new_state: { dates: 'Oct 28 - Oct 30', unit: 'Villa 1' }, reason: 'Maintenance - AC repair', request_id: 'req_11c3d4' },
  { id: 'log_989', created_at: '2026-10-24T08:45:00+08:00', actor_name: 'Front Desk A', actor_role: 'Reception', action: 'LOGIN_SUCCESS', entity_type: 'system', entity_id: 'sys_login', severity: 'low', ip_address: '202.14.99.1', previous_state: null, new_state: null, reason: 'Standard shift start', request_id: 'req_22d4e5' },
];

const ROOM_NAMES = ['Grand Ocean Villa', 'Sunset Suite', 'Smart Room Premium'];
const AUDIT_FILTERS = ['All', 'Bookings', 'Payments', 'Availability', 'Staff Access', 'CMS', 'Critical Only'];
const ENTITY_TAB_MAP = { booking: 'bookings', payment: 'payments', availability: 'availability', guest: 'guests', staff: 'staff', content: 'content', notification: 'notifications', system: 'dashboard' };
const TAB_SUBTITLES = {
  dashboard: 'Real-time property metrics and operational alerts.',
  bookings: 'Manage reservations, guest holds, and arrival statuses.',
  payments: 'Review transactions, webhook exceptions, and manual settlements.',
  availability: 'Control room inventory, manual blocks, and operational holds.',
  guests: 'Guest profiles, stay history, and special requests.',
  content: 'Manage website copy, policies, and published room data.',
  notifications: 'Track automated emails and guest communication logs.',
  staff: 'Manage personnel access, roles, and security policies.',
  audit: 'Immutable activity trail for staff, booking, payment, and content actions.',
  settings: 'Global property rules and configuration parameters.',
};

const can = (user, permission) => user?.permissions?.includes(permission);

async function adminApi(action, { method = 'GET', body, staffCode } = {}) {
  if (['audit-logs', 'staff-list', 'staff-invite', 'staff-update-role', 'staff-reset', 'staff-disable'].includes(action)) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (action === 'audit-logs') return { ok: true, rows: MOCK_LOGS, nextCursor: null };
    if (action === 'staff-list') return { ok: true, rows: MOCK_USERS };
    return { ok: true };
  }

  const response = await fetch(`/api/admin?action=${encodeURIComponent(action)}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-PLP-Staff-Code': staffCode || '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || `Admin request failed with ${response.status}`);
  return data;
}

function money(value) {
  return `₱${Number(value || 0).toLocaleString('en-PH')}`;
}

function pick(row, keys, fallback = '') {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key];
  }
  return fallback;
}

function date(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('en-PH');
}

function daysBetween(start, end) {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 86400000);
}

function normalizedStatus(row) {
  const verification = String(pick(row, ['payment_verification_status', 'verification_status'], '')).toUpperCase();
  const payment = String(pick(row, ['payment_status', 'booking_payment_status'], '')).toUpperCase();
  const booking = String(pick(row, ['booking_status', 'status'], '')).toUpperCase();
  if (booking === 'CONFIRMED') return { label: 'Confirmed', cls: 'good' };
  if (booking === 'CANCELLED') return { label: 'Cancelled', cls: 'bad' };
  if (verification === 'VERIFIED' && ['SUCCEEDED', 'CAPTURED'].includes(payment)) return { label: 'Paid deposit', cls: 'good' };
  if (verification && !['VERIFIED', 'PENDING'].includes(verification)) return { label: 'Payment exception', cls: 'bad' };
  if (payment === 'FAILED' || payment === 'EXPIRED') return { label: payment, cls: 'bad' };
  if (payment === 'PROCESSING' || booking === 'PAYMENT_PROCESSING') return { label: 'Payment review', cls: 'warn' };
  return { label: booking || payment || 'Pending', cls: 'warn' };
}

function csvExport(filename, rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return;
  const keys = [...new Set(list.flatMap((row) => Object.keys(row || {})))];
  const escape = (value) => `"${String(typeof value === 'object' ? JSON.stringify(value) : value ?? '').replace(/"/g, '""')}"`;
  const csv = [keys.join(','), ...list.map((row) => keys.map((key) => escape(row[key])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function useClipboard() {
  const [copied, setCopied] = useState(null);
  const copyId = async (id) => {
    try {
      await navigator.clipboard.writeText(String(id));
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      console.warn('Clipboard copy failed');
    }
  };
  return { copied, copyId };
}

function useCoreData(staffCode) {
  const [state, setState] = useState({ loading: true, error: '', operations: [], exceptions: [], blockedDates: [], calendar: [], content: [], notifications: [] });
  const load = async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const [operations, dates, content, notifications] = await Promise.all([
        adminApi('operations', { staffCode }),
        adminApi('date-blocks', { staffCode }),
        adminApi('content', { staffCode }),
        adminApi('notifications', { staffCode }),
      ]);
      setState({
        loading: false,
        error: '',
        operations: operations.rows || [],
        exceptions: operations.exceptions || [],
        blockedDates: dates.blockedDates || [],
        calendar: dates.calendar || [],
        content: content.content || [],
        notifications: notifications.rows || [],
      });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message }));
    }
  };
  useEffect(() => {
    if (staffCode) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffCode]);
  return { ...state, refresh: load };
}

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedEntityContext, setSelectedEntityContext] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isInviteDrawerOpen, setIsInviteDrawerOpen] = useState(false);
  const [dangerousAction, setDangerousAction] = useState(null);
  const core = useCoreData(session?.staffCode);

  if (!session) return <LoginScreen onLogin={setSession} />;

  const goToTab = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    setSelectedEntityContext(null);
  };

  const handleOpenContext = (type, id) => {
    const nextTab = ENTITY_TAB_MAP[type];
    if (!nextTab) return;
    setSelectedLog(null);
    setActiveTab(nextTab);
    setSelectedEntityContext({ type, id });
  };

  const title = activeTab.replace('-', ' ');

  return (
    <div className="flex flex-col h-screen bg-[#F4F0E8] font-sans text-[#211F1B] overflow-hidden">
      <StatusStrip staffCode={session.staffCode} />
      <div className="flex flex-1 overflow-hidden relative">
        {isSidebarOpen && <div className="md:hidden absolute inset-0 bg-[#17130F]/40 backdrop-blur-sm z-30" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
        <aside className={`absolute md:relative z-40 w-64 h-full bg-[#17130F] text-white flex flex-col justify-between transition-transform duration-300 ease-in-out border-r border-[#B8977E]/20 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="flex flex-col h-full">
            <div className="p-8 pb-8 flex items-center justify-between">
              <div>
                <h1 className="text-xl tracking-[0.2em] font-light uppercase">PLP <span className="font-bold text-[#B8977E]">Ops</span></h1>
                <p className="text-[10px] text-[#6A645B] mt-1 tracking-widest uppercase">Admin Console v2</p>
              </div>
              <button className="md:hidden text-[#6A645B] hover:text-white" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={20} /></button>
            </div>
            <nav className="space-y-0.5 px-4 flex-1 overflow-y-auto">
              <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" isActive={activeTab === 'dashboard'} onClick={() => goToTab('dashboard')} />
              <NavItem icon={<Database size={18} />} label="Bookings" isActive={activeTab === 'bookings'} onClick={() => goToTab('bookings')} />
              <NavItem icon={<CreditCard size={18} />} label="Payments" isActive={activeTab === 'payments'} onClick={() => goToTab('payments')} />
              <NavItem icon={<Calendar size={18} />} label="Availability" isActive={activeTab === 'availability'} onClick={() => goToTab('availability')} />
              <NavItem icon={<Users size={18} />} label="Guests" isActive={activeTab === 'guests'} onClick={() => goToTab('guests')} />
              <NavItem icon={<FileText size={18} />} label="Content" isActive={activeTab === 'content'} onClick={() => goToTab('content')} />
              <NavItem icon={<Bell size={18} />} label="Notifications" isActive={activeTab === 'notifications'} onClick={() => goToTab('notifications')} />
              <div className="pt-6 pb-2 px-4 text-[10px] tracking-widest text-[#6A645B] uppercase font-semibold">Security & Access</div>
              <NavItem icon={<Shield size={18} />} label="Staff & Roles" isActive={activeTab === 'staff'} onClick={() => goToTab('staff')} />
              <NavItem icon={<History size={18} />} label="Audit Logs" isActive={activeTab === 'audit'} onClick={() => goToTab('audit')} />
              <NavItem icon={<Settings size={18} />} label="Settings" isActive={activeTab === 'settings'} onClick={() => goToTab('settings')} />
            </nav>
            <SidebarUser user={session} onLogout={() => setSession(null)} />
          </div>
        </aside>
        <main className="flex-1 flex flex-col h-full min-w-0 relative z-10">
          <header className="py-5 bg-[#FBFAF7] border-b border-[#E5E0D8] flex items-center px-6 md:px-10 justify-between shrink-0">
            <div className="flex items-center gap-4">
              <button className="md:hidden text-[#211F1B] mt-1" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
              <div>
                <h2 className="text-xl md:text-2xl font-light tracking-tight text-[#17130F] capitalize">{title}</h2>
                <p className="text-xs text-[#6A645B] mt-1 hidden md:block">{TAB_SUBTITLES[activeTab]}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button type="button" onClick={core.refresh} className="hidden md:inline-flex border border-[#E5E0D8] bg-white px-4 py-2.5 rounded-sm text-sm font-medium hover:bg-[#F4F0E8]">Refresh</button>
              {activeTab === 'staff' && can(session, 'staff.create') && (
                <button type="button" onClick={() => setIsInviteDrawerOpen(true)} className="bg-[#17130F] text-[#F4F0E8] px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-[#2A241D] transition-colors flex items-center gap-2 shadow-sm"><Plus size={16} /> <span className="hidden md:inline">Add Staff</span></button>
              )}
            </div>
          </header>
          <div className="flex-1 overflow-auto p-4 md:p-10 relative">
            {core.error && <div className="mb-4 border border-red-100 bg-red-50 text-red-700 p-3 text-sm rounded-sm">{core.error}</div>}
            {activeTab === 'dashboard' && <DashboardView data={core} />}
            {activeTab === 'bookings' && <BookingsView data={core} session={session} requestAction={setDangerousAction} />}
            {activeTab === 'payments' && <PaymentsView data={core} />}
            {activeTab === 'availability' && <AvailabilityView data={core} session={session} />}
            {activeTab === 'content' && <ContentView data={core} session={session} />}
            {activeTab === 'notifications' && <NotificationsView data={core} />}
            {activeTab === 'audit' && <AuditView staffCode={session.staffCode} onSelectLog={setSelectedLog} />}
            {activeTab === 'staff' && <StaffView currentUser={session} onSelectStaff={setSelectedStaff} />}
            {['guests', 'settings'].includes(activeTab) && <ConstructionState context={selectedEntityContext} />}
          </div>
        </main>
      </div>
      {selectedLog && <LogDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} onOpenContext={handleOpenContext} />}
      {selectedStaff && <StaffDetailDrawer staff={selectedStaff} currentUser={session} onClose={() => setSelectedStaff(null)} requestAction={setDangerousAction} />}
      {isInviteDrawerOpen && <InviteStaffDrawer staffCode={session.staffCode} onClose={() => setIsInviteDrawerOpen(false)} />}
      {dangerousAction && <ActionConfirmationModal action={dangerousAction} onClose={() => setDangerousAction(null)} />}
    </div>
  );
}

function DashboardView({ data }) {
  const paidDeposits = data.operations.filter((row) => normalizedStatus(row).label === 'Paid deposit');
  const failedNotifications = data.notifications.filter((row) => String(row.status || '').toUpperCase() === 'FAILED');
  const revenue = paidDeposits.reduce((sum, row) => sum + Number(pick(row, ['deposit_amount_php', 'payment_amount_php', 'amount_php'], 0)), 0);
  return (
    <div className="space-y-6">
      {data.loading && <LoadingState text="Loading property metrics..." />}
      {!data.loading && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard tone="danger" icon={<AlertCircle size={16} />} label="Payment Exceptions" value={data.exceptions.length} help="Requires manual reconciliation" />
        <MetricCard icon={<Clock size={16} />} label="Deposits Paid" value={paidDeposits.length} help="Awaiting final confirmation" />
        <MetricCard icon={<User size={16} />} label="Bookings in Queue" value={data.operations.length} help="From reconciliation view" />
        <MetricCard icon={<Calendar size={16} />} label="Active Blocked Dates" value={data.blockedDates.length} help="Maintenance / owner stays" />
        <MetricCard icon={<Bell size={16} />} label="Failed Notifications" value={failedNotifications.length} help="Email delivery issues" />
        <MetricCard dark icon={<TrendingUp size={16} />} label="Verified Deposits" value={money(revenue)} help="Operational deposit total" />
      </div>}
    </div>
  );
}

function MetricCard({ label, value, help, icon, tone, dark }) {
  return <div className={`${dark ? 'bg-[#17130F] border-[#2A241D] text-[#F4F0E8]' : tone === 'danger' ? 'bg-white border-red-200' : 'bg-white border-[#E5E0D8]'} border rounded-md p-5 shadow-sm flex flex-col justify-between`}>
    <div className="flex justify-between items-start"><h3 className={`text-xs tracking-widest uppercase font-semibold ${dark ? 'text-[#B8977E]' : tone === 'danger' ? 'text-red-800' : 'text-[#6A645B]'}`}>{label}</h3><span className={tone === 'danger' ? 'text-red-500' : 'text-[#B8977E]'}>{icon}</span></div>
    <div className="mt-4"><p className="text-3xl font-light text-inherit">{value}</p><p className="text-xs text-[#6A645B] mt-1">{help}</p></div>
  </div>;
}

function BookingsView({ data, session, requestAction }) {
  const [filter, setFilter] = useState('');
  const rows = data.operations.filter((row) => JSON.stringify(row).toLowerCase().includes(filter.toLowerCase()));
  const updateBooking = (row, nextStatus) => {
    const reference = pick(row, ['booking_reference', 'reference']);
    requestAction({
      title: nextStatus === 'CONFIRMED' ? 'Confirm Booking' : 'Cancel Booking',
      description: `${nextStatus === 'CONFIRMED' ? 'Confirm' : 'Cancel'} booking ${reference}. A reason is required and the backend will enforce payment rules.`,
      onConfirm: async ({ reason }) => {
        await adminApi('booking-status', { method: 'POST', staffCode: session.staffCode, body: { reference, nextStatus, reason } });
        await data.refresh();
      },
    });
  };
  return <Panel title="Booking Operations" action={<button className="btnish" onClick={() => csvExport('plp-bookings.csv', rows)}>Export CSV</button>}>
    <SearchBox value={filter} onChange={setFilter} placeholder="Search bookings, guest, room..." />
    <div className="mt-4 grid gap-3">
      {data.loading && <LoadingState text="Loading bookings..." />}
      {!data.loading && rows.length === 0 && <EmptyState text="No booking rows returned." />}
      {rows.map((row, index) => {
        const status = normalizedStatus(row);
        const reference = pick(row, ['booking_reference', 'reference'], `row-${index}`);
        return <article key={`${reference}-${index}`} className={`bg-white border ${status.cls === 'bad' ? 'border-red-200' : 'border-[#E5E0D8]'} rounded-md p-4 grid md:grid-cols-[1.3fr_.9fr_.9fr_auto] gap-4 items-start`}>
          <div><strong className="text-xl font-light text-[#17130F]">{reference}</strong><p className="text-xs text-[#6A645B] mt-1">{pick(row, ['guest_name', 'full_name', 'name'])} · {pick(row, ['guest_email', 'email'])}</p><Badge label={status.label} cls={status.cls} /></div>
          <div className="text-sm"><strong>{pick(row, ['accommodation_name', 'accommodation'])}</strong><p className="text-xs text-[#6A645B]">{pick(row, ['check_in'])} → {pick(row, ['check_out'])} · {daysBetween(pick(row, ['check_in']), pick(row, ['check_out']))} nights</p></div>
          <div className="text-sm"><strong>{money(pick(row, ['total_amount_php', 'amount'], 0))}</strong><p className="text-xs text-[#6A645B]">Deposit {money(pick(row, ['deposit_amount_php', 'payment_amount_php'], 0))}</p></div>
          <div className="flex flex-wrap gap-2 justify-start md:justify-end"><button className="btnish" disabled={status.label !== 'Paid deposit'} onClick={() => updateBooking(row, 'CONFIRMED')}>Confirm</button><button className="btnish danger" onClick={() => updateBooking(row, 'CANCELLED')}>Cancel</button></div>
        </article>;
      })}
    </div>
  </Panel>;
}

function PaymentsView({ data }) {
  return <Panel title="Payment Exceptions" action={<button className="btnish" onClick={() => csvExport('plp-payment-exceptions.csv', data.exceptions)}>Export CSV</button>}>
    {data.loading && <LoadingState text="Loading payment exceptions..." />}
    {!data.loading && data.exceptions.length === 0 && <EmptyState text="No payment exceptions currently returned." />}
    {!data.loading && data.exceptions.length > 0 && <Table columns={['Reference', 'Issue', 'Expected', 'Received', 'When']} rows={data.exceptions.map((row) => [pick(row, ['booking_reference', 'provider_reference_id', 'reference']), pick(row, ['verification_status', 'status'], 'Review'), `${money(pick(row, ['expected_amount_php', 'deposit_amount_php'], 0))} ${pick(row, ['expected_currency'], 'PHP')}`, `${money(pick(row, ['amount_php', 'received_amount_php'], 0))} ${pick(row, ['currency'], '')}`, date(pick(row, ['created_at', 'processed_at', 'payment_created_at']))])} />}
  </Panel>;
}

function AvailabilityView({ data, session }) {
  const [busy, setBusy] = useState(false);
  const createBlock = async (event) => {
    event.preventDefault();
    setBusy(true);
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await adminApi('date-blocks', { method: 'POST', staffCode: session.staffCode, body });
      event.currentTarget.reset();
      await data.refresh();
    } finally { setBusy(false); }
  };
  const cancelBlock = async (id) => {
    if (!window.confirm('Cancel this active date block?')) return;
    await adminApi('date-blocks', { method: 'PATCH', staffCode: session.staffCode, body: { id } });
    await data.refresh();
  };
  return <Panel title="Availability Command" action={<button className="btnish" onClick={() => csvExport('plp-availability.csv', data.calendar)}>Export Calendar</button>}>
    <form onSubmit={createBlock} className="grid md:grid-cols-5 gap-3 mb-5">
      <select name="accommodation" className="inputish">{ROOM_NAMES.map((name) => <option key={name}>{name}</option>)}</select>
      <input name="startDate" type="date" required className="inputish" />
      <input name="endDate" type="date" required className="inputish" />
      <input name="reason" placeholder="Owner stay, maintenance..." className="inputish" />
      <button disabled={busy} className="bg-[#17130F] text-[#F4F0E8] rounded-sm px-4 py-3 text-sm font-medium">{busy ? 'Blocking...' : 'Block Dates'}</button>
    </form>
    <div className="grid lg:grid-cols-2 gap-5">
      <div><h3 className="tinyhead mb-3">Active Blocked Dates</h3>{data.blockedDates.length ? <Table columns={['Room', 'Dates', 'Reason', '']} rows={data.blockedDates.map((row) => [pick(row, ['accommodation_name', 'name']), `${pick(row, ['start_date'])} → ${pick(row, ['end_date'])}`, pick(row, ['reason'], 'Manual block'), <button className="text-red-700 text-xs font-medium" onClick={() => cancelBlock(pick(row, ['id']))}>Cancel</button>])} /> : <EmptyState text="No active blocked dates." />}</div>
      <div><h3 className="tinyhead mb-3">Calendar Feed</h3>{data.calendar.length ? <Table columns={['Room', 'Dates', 'Type', 'Status']} rows={data.calendar.slice(0, 80).map((row) => [pick(row, ['accommodation_name', 'name']), `${pick(row, ['start_date', 'check_in'])} → ${pick(row, ['end_date', 'check_out'])}`, pick(row, ['source', 'kind', 'type']), pick(row, ['status'])])} /> : <EmptyState text="No availability calendar rows returned." />}</div>
    </div>
  </Panel>;
}

function ContentView({ data, session }) {
  const starter = data.content.length ? data.content : [{ section: 'homepage', status: 'DRAFT', content: { heroTitle: 'Pueblo La Perla', primaryCta: 'Reserve your stay' } }];
  return <Panel title="Content Studio"><div className="mb-4 bg-[#F4F0E8] border border-[#E5E0D8] p-3 text-xs text-[#6A645B]">JSON is still supported, but this panel now lives inside the Admin v2 shell. Structured forms should replace raw JSON in the next phase.</div>{starter.map((row, index) => <ContentCard key={row.section || index} row={row} session={session} refresh={data.refresh} />)}</Panel>;
}

function ContentCard({ row, session, refresh }) {
  const [content, setContent] = useState(JSON.stringify(row.content || {}, null, 2));
  const [status, setStatus] = useState(row.status || 'DRAFT');
  const [section, setSection] = useState(row.section || 'homepage');
  const [busy, setBusy] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await adminApi('content', { method: 'POST', staffCode: session.staffCode, body: { section, status, content: JSON.parse(content), updatedBy: session.email } });
      await refresh();
    } finally { setBusy(false); }
  };
  return <form onSubmit={save} className="bg-white border border-[#E5E0D8] p-4 rounded-sm mb-3"><div className="grid md:grid-cols-2 gap-3 mb-3"><input className="inputish" value={section} onChange={(e) => setSection(e.target.value)} /><select className="inputish" value={status} onChange={(e) => setStatus(e.target.value)}><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select></div><textarea className="inputish min-h-56 font-mono text-xs" value={content} onChange={(e) => setContent(e.target.value)} /><button disabled={busy} className="mt-3 bg-[#17130F] text-[#F4F0E8] rounded-sm px-4 py-2 text-sm">{busy ? 'Saving...' : 'Save Section'}</button></form>;
}

function NotificationsView({ data }) {
  return <Panel title="Notifications" action={<button className="btnish" onClick={() => csvExport('plp-notifications.csv', data.notifications)}>Export CSV</button>}>
    {data.notifications.length ? <Table columns={['Status', 'Recipient', 'Subject', 'When']} rows={data.notifications.map((row) => [pick(row, ['status'], 'PENDING'), `${pick(row, ['recipient_type'])} · ${pick(row, ['recipient_email'])}`, pick(row, ['subject']), date(pick(row, ['sent_at', 'created_at', 'updated_at']))])} /> : <EmptyState text="No notification activity returned." />}
  </Panel>;
}

function StaffView({ currentUser, onSelectStaff }) {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  useEffect(() => { const t = setTimeout(() => setLoading(false), 450); return () => clearTimeout(t); }, []);
  const rows = MOCK_USERS.filter((staff) => JSON.stringify(staff).toLowerCase().includes(query.toLowerCase()));
  if (loading) return <LoadingState text="Loading personnel records..." />;
  return <Panel title="Personnel Access"><SearchBox value={query} onChange={setQuery} placeholder="Search staff..." /><div className="mt-4 overflow-x-auto"><table className="w-full text-left border-collapse min-w-[800px]"><thead><tr className="bg-[#F4F0E8]/50 border-b border-[#E5E0D8]"><HeaderCell>Personnel</HeaderCell><HeaderCell>Role & Access</HeaderCell><HeaderCell>Security</HeaderCell><HeaderCell>Last Active</HeaderCell><HeaderCell align="right">Actions</HeaderCell></tr></thead><tbody className="text-sm divide-y divide-[#E5E0D8]">{rows.map((staff) => <tr key={staff.id} className="hover:bg-[#F4F0E8]/40 transition-colors"><td className="py-4 px-6 flex items-center gap-4"><Avatar name={staff.name} /><div><p className="font-medium text-[#17130F]">{staff.name}</p><p className="text-xs text-[#6A645B]">{staff.email}</p></div></td><td className="py-4 px-6"><span className="bg-[#F4F0E8] text-[#17130F] px-2.5 py-1 rounded-sm text-xs font-medium border border-[#E5E0D8]">{staff.role}</span></td><td className="py-4 px-6"><SecurityPosture staff={staff} /></td><td className="py-4 px-6 text-[#6A645B] font-mono text-xs">{staff.lastActive}</td><td className="py-4 px-6 text-right"><button disabled={!can(currentUser, 'staff.read')} onClick={() => onSelectStaff(staff)} className="p-2 text-[#6A645B] hover:text-[#17130F] hover:bg-[#E5E0D8] rounded-sm"><MoreVertical size={16} /></button></td></tr>)}</tbody></table></div></Panel>;
}

function AuditView({ staffCode, onSelectLog }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    adminApi('audit-logs', { staffCode, body: { filter: activeFilter, search: searchQuery, cursor } }).then((res) => {
      if (mounted) { setLogs(res.rows || []); setNextCursor(res.nextCursor || null); setLoading(false); }
    }).catch(() => { if (mounted) { setLogs(MOCK_LOGS); setLoading(false); } });
    return () => { mounted = false; };
  }, [staffCode, cursor, activeFilter, searchQuery]);
  useEffect(() => { setCursor(null); }, [searchQuery, activeFilter]);
  const filteredLogs = useMemo(() => logs.filter((log) => {
    const query = searchQuery.toLowerCase();
    const searchableText = [log.id, log.actor_name, log.actor_role, log.action, log.entity_type, log.entity_id, log.severity, log.ip_address, log.reason, log.request_id].filter(Boolean).join(' ').toLowerCase();
    if (query && !searchableText.includes(query)) return false;
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Critical Only') return log.severity === 'critical';
    if (activeFilter === 'Bookings') return log.entity_type === 'booking';
    if (activeFilter === 'Payments') return log.entity_type === 'payment';
    if (activeFilter === 'Availability') return log.entity_type === 'availability';
    if (activeFilter === 'Staff Access') return log.entity_type === 'staff' || log.entity_type === 'system';
    if (activeFilter === 'CMS') return log.entity_type === 'content';
    return true;
  }), [logs, searchQuery, activeFilter]);
  if (loading) return <LoadingState text="Fetching immutable audit trail..." />;
  return <Panel title="Audit Trail" action={<button className="btnish" onClick={() => csvExport('plp-audit-logs.csv', filteredLogs)}>Export CSV</button>}><div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between"><SearchBox value={searchQuery} onChange={setSearchQuery} placeholder="Search action, reason, IP, actor..." /><div className="flex flex-wrap gap-2">{AUDIT_FILTERS.map((filter) => <button key={filter} onClick={() => setActiveFilter(filter)} className={`px-3 py-1.5 text-xs font-medium rounded-sm border ${activeFilter === filter ? 'bg-[#17130F] text-[#F4F0E8] border-[#17130F]' : 'bg-white text-[#6A645B] border-[#E5E0D8] hover:bg-[#F4F0E8]'}`}>{filter}</button>)}</div></div><div className="mt-4 overflow-x-auto min-h-[360px]">{filteredLogs.length === 0 ? <EmptyState text="No audit records match the current filters." /> : <table className="w-full text-left border-collapse min-w-[1000px]"><thead><tr className="bg-[#F4F0E8]/50 border-b border-[#E5E0D8]"><HeaderCell>Timestamp</HeaderCell><HeaderCell>Actor</HeaderCell><HeaderCell>Operation</HeaderCell><HeaderCell>Entity</HeaderCell><HeaderCell align="right">Inspection</HeaderCell></tr></thead><tbody className="text-sm divide-y divide-[#E5E0D8]">{filteredLogs.map((log) => <tr key={log.id} className="hover:bg-[#F4F0E8]/40 cursor-pointer group" onClick={() => onSelectLog(log)}><td className="py-4 px-6"><p className="font-mono text-[#17130F] text-xs">{new Date(log.created_at).toLocaleTimeString()}</p><p className="text-[10px] text-[#6A645B]">{new Date(log.created_at).toLocaleDateString()}</p></td><td className="py-4 px-6"><div className="flex items-center gap-2"><User size={14} className="text-[#B8977E]" /><div><p className="font-medium text-[#17130F]">{log.actor_name}</p><p className="text-[10px] text-[#6A645B] uppercase tracking-wider">{log.actor_role}</p></div></div></td><td className="py-4 px-6"><SeverityBadge log={log} /></td><td className="py-4 px-6"><span className="text-[10px] uppercase tracking-widest text-[#6A645B] bg-[#E5E0D8] px-1.5 py-0.5 rounded-sm">{log.entity_type}</span> <span className="text-[#17130F] font-mono text-xs">{log.entity_id}</span></td><td className="py-4 px-6 text-right"><span className="text-[#B8977E] group-hover:text-[#17130F] inline-flex items-center gap-1 text-xs">View <ChevronRight size={16} /></span></td></tr>)}</tbody></table>}</div><div className="p-4 -mx-5 -mb-5 mt-4 border-t border-[#E5E0D8] bg-[#FBFAF7] flex items-center justify-between text-sm text-[#6A645B]"><span>Showing records</span><div className="flex gap-2"><button disabled={!cursor} onClick={() => setCursor(null)} className="btnish">Previous</button><button disabled={!nextCursor} onClick={() => setCursor(nextCursor)} className="btnish">Next</button></div></div></Panel>;
}

function LogDetailDrawer({ log, onClose, onOpenContext }) {
  const { copied, copyId } = useClipboard();
  return <Drawer title="Audit Record" onClose={onClose}><p className="text-[10px] text-[#6A645B] font-mono -mt-6 mb-6 flex items-center gap-2">{log.id}<button onClick={() => copyId(log.id)}>{copied === log.id ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}</button></p><div className="grid grid-cols-2 gap-y-6 gap-x-4"><Info label="Actor" value={log.actor_name} /><Info label="Timestamp" value={new Date(log.created_at).toLocaleString()} mono /><div><p className="tinyhead mb-1">Target Entity</p><div className="flex items-center gap-2"><span className="font-mono text-xs bg-[#F4F0E8] px-2 py-0.5 rounded-sm">{log.entity_id}</span><button onClick={() => copyId(log.entity_id)}>{copied === log.entity_id ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}</button></div></div><Info label="IP Address" value={log.ip_address} mono /></div><div className="pt-6 border-t border-[#E5E0D8]"><p className="tinyhead mb-3">Operation Executed</p><div className="flex items-center justify-between bg-[#17130F] text-[#F4F0E8] p-3 rounded-sm"><span className="font-mono text-xs">{log.action}</span><span className="text-[10px] uppercase tracking-widest text-[#B8977E]">{log.severity}</span></div>{log.reason && <div className="mt-3 text-sm border-l-2 border-[#B8977E] pl-3 italic bg-[#FBFAF7] py-2">“{log.reason}”</div>}</div><div><p className="tinyhead mb-3">State Mutator Payload</p>{log.previous_state || log.new_state ? <div className="space-y-2 font-mono text-xs">{log.previous_state && <pre className="bg-red-50 text-red-900 p-3 rounded-sm overflow-x-auto">- {JSON.stringify(log.previous_state, null, 2)}</pre>}{log.new_state && <pre className="bg-green-50 text-green-900 p-3 rounded-sm overflow-x-auto">+ {JSON.stringify(log.new_state, null, 2)}</pre>}</div> : <EmptyState text="No payload recorded for this event." />}</div>{log.entity_type !== 'system' && <button onClick={() => onOpenContext(log.entity_type, log.entity_id)} className="w-full py-3 border border-[#E5E0D8] rounded-sm text-sm font-medium hover:bg-[#F4F0E8] flex items-center justify-center gap-2"><ExternalLink size={14} /> Open Context ({log.entity_type})</button>}</Drawer>;
}

function InviteStaffDrawer({ staffCode, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());
      await adminApi('staff-invite', { method: 'POST', staffCode, body: form });
      onClose();
    } catch (err) { setError(err.message); setLoading(false); }
  };
  return <Drawer title="Invite Personnel" onClose={onClose}><form onSubmit={handleSubmit} className="space-y-6"><Field label="Full Name"><input required name="name" className="inputish" placeholder="John Doe" /></Field><Field label="Email Address"><input required name="email" type="email" className="inputish" placeholder="staff@plp.com" /></Field><Field label="System Role"><select name="role" className="inputish">{STAFF_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></Field><div className="bg-[#F4F0E8] p-4 rounded-sm border border-[#E5E0D8] flex gap-3"><Lock className="text-[#6A645B] shrink-0 mt-0.5" size={16} /><p className="text-xs text-[#6A645B] leading-relaxed"><strong className="text-[#17130F]">Strict Security Policy:</strong> New personnel will be forced to configure MFA upon first login.</p></div>{error && <div className="text-xs text-red-700 bg-red-50 border border-red-100 p-3 rounded-sm">{error}</div>}<button disabled={loading} className="w-full bg-[#17130F] text-[#F4F0E8] font-medium py-3 rounded-sm disabled:opacity-70">{loading ? 'Sending Secure Invite...' : 'Issue Invitation'}</button></form></Drawer>;
}

function StaffDetailDrawer({ staff, currentUser, onClose, requestAction }) {
  const isSelf = currentUser?.id === staff.id;
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState(staff.role);
  const handleRoleSave = () => {
    if (selectedRole === staff.role) return setIsEditingRole(false);
    requestAction({ title: 'Update Assigned Role', description: `Changing role for ${staff.name} from ${staff.role} to ${selectedRole}.`, onConfirm: async ({ reason }) => { await adminApi('staff-update-role', { method: 'POST', staffCode: currentUser.staffCode, body: { staffId: staff.id, newRole: selectedRole, reason } }); setIsEditingRole(false); } });
  };
  return <Drawer title="Personnel File" onClose={onClose}><div className="flex items-center gap-4 border-b border-[#E5E0D8] pb-6"><Avatar name={staff.name} large /><div><h2 className="text-xl text-[#17130F]">{staff.name} {isSelf && <span className="text-[10px] bg-[#E5E0D8] text-[#6A645B] px-1.5 py-0.5 rounded-sm ml-2 uppercase tracking-widest align-middle">You</span>}</h2><p className="text-sm text-[#6A645B]">{staff.email}</p></div></div><div><p className="tinyhead mb-2">Assigned Role</p><div className="flex items-center justify-between bg-[#F4F0E8] p-3 rounded-sm border border-[#E5E0D8]">{isEditingRole ? <div className="flex items-center gap-2 w-full"><select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="inputish py-1.5">{STAFF_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select><button onClick={handleRoleSave} className="text-xs bg-[#17130F] text-[#F4F0E8] px-3 py-1.5 rounded-sm">Save</button><button onClick={() => { setIsEditingRole(false); setSelectedRole(staff.role); }} className="text-xs text-[#6A645B] px-2">Cancel</button></div> : <><span className="font-medium text-[#17130F]">{staff.role}</span>{can(currentUser, 'staff.update') && <button onClick={() => setIsEditingRole(true)} className="text-xs text-[#B8977E] font-medium hover:underline">Change</button>}</>}</div></div><div><p className="tinyhead mb-2">Security Posture</p><SecurityPosture staff={staff} detailed /></div><div className="pt-6 space-y-3"><p className="tinyhead border-b border-[#E5E0D8] pb-2">Administrative Actions</p>{can(currentUser, 'staff.update') && <button onClick={() => requestAction({ title: 'Force Password Reset', description: `Invalidate current sessions for ${staff.name} and email a reset link.`, onConfirm: async ({ reason }) => adminApi('staff-reset', { method: 'POST', staffCode: currentUser.staffCode, body: { staffId: staff.id, reason } }) })} className="drawer-action">Force Password Reset</button>}{can(currentUser, 'staff.disable') && <div className="pt-2"><div className="bg-red-50/50 border border-red-100 rounded-sm p-1"><button disabled={isSelf} onClick={() => requestAction({ title: 'Suspend Account', description: `Suspend ${staff.name}. They will immediately lose access to PLP Ops.`, onConfirm: async ({ reason }) => adminApi('staff-disable', { method: 'POST', staffCode: currentUser.staffCode, body: { staffId: staff.id, reason } }) })} className="w-full text-left px-3 py-2 rounded-sm hover:bg-red-100 text-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">Suspend Personnel Access</button></div>{isSelf && <p className="text-[10px] text-red-500 mt-1.5 px-1 font-medium">Action restricted: self-suspension is disabled.</p>}</div>}</div></Drawer>;
}

function ActionConfirmationModal({ action, onClose }) {
  const [input, setInput] = useState('');
  const [reason, setReason] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState('');
  const isReady = input === 'CONFIRM' && reason.trim().length > 5;
  const handleConfirm = async () => { setIsExecuting(true); setError(''); try { await action.onConfirm({ reason }); onClose(); } catch (err) { setError(err.message || 'The backend rejected this operation.'); setIsExecuting(false); } };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true"><div className="absolute inset-0 bg-[#17130F]/60 backdrop-blur-sm" onClick={onClose} /><div className="relative w-full max-w-lg bg-white rounded-md shadow-2xl border border-[#E5E0D8] overflow-hidden"><div className="bg-[#17130F] p-6 text-[#F4F0E8]"><div className="flex items-center gap-3 mb-2 text-red-400"><AlertTriangle size={20} /><span className="text-[10px] tracking-widest uppercase font-bold">Critical Operation Gate</span></div><h2 className="text-xl font-light tracking-tight text-white">{action.title}</h2><p className="text-sm text-[#6A645B] mt-2 leading-relaxed">{action.description}</p></div><div className="p-6 space-y-5 bg-[#FBFAF7]">{error && <div className="text-xs text-red-700 bg-red-50 border border-red-100 p-3 rounded-sm font-medium">Error: {error}</div>}<Field label="Audit Reason (Required)"><textarea className="inputish h-20 resize-none" placeholder="Explain why this action is necessary..." value={reason} onChange={(e) => setReason(e.target.value)} disabled={isExecuting} /></Field><Field label="Authorization"><p className="text-xs text-[#6A645B] mb-2">Type <strong className="text-[#17130F] font-mono">CONFIRM</strong> to proceed.</p><input className="inputish font-mono" value={input} onChange={(e) => setInput(e.target.value)} disabled={isExecuting} /></Field></div><div className="p-4 bg-[#F4F0E8] border-t border-[#E5E0D8] flex justify-end gap-3"><button onClick={onClose} disabled={isExecuting} className="px-4 py-2 text-sm font-medium text-[#6A645B]">Cancel</button><button onClick={handleConfirm} disabled={!isReady || isExecuting} className={`px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 ${isReady && !isExecuting ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#E5E0D8] text-[#6A645B] cursor-not-allowed'}`}>{isExecuting && <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />}{isExecuting ? 'Executing...' : 'Execute Operation'}</button></div></div></div>;
}

function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleAuth = async (event) => {
    event.preventDefault();
    setLoading(true); setError('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const staffCode = String(form.get('password') || '');
    try {
      await adminApi('health', { staffCode });
      const role = email.includes('finance') ? MOCK_USERS[3] : email.includes('front') ? MOCK_USERS[2] : MOCK_USERS[0];
      onLogin({ ...role, email: email || role.email, staffCode });
    } catch (err) { setError(err.message || 'Invalid staff credentials.'); setLoading(false); }
  };
  return <div className="min-h-screen bg-[#17130F] flex items-center justify-center p-4 relative overflow-hidden"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#B8977E]/5 rounded-full blur-[120px] pointer-events-none" /><div className="w-full max-w-md relative z-10"><div className="text-center mb-10"><h1 className="text-4xl text-white tracking-[0.2em] font-light uppercase mb-3">PLP <span className="font-bold text-[#B8977E]">Ops</span></h1><div className="inline-flex items-center gap-2 bg-[#2A241D] border border-[#B8977E]/20 px-3 py-1 rounded-full text-[10px] text-[#B8977E] tracking-widest uppercase"><Shield size={12} /> Secure Admin Session</div></div><form onSubmit={handleAuth} className="bg-[#FBFAF7] rounded-md p-8 shadow-2xl border-t-4 border-[#B8977E]"><div className="space-y-6"><Field label="Staff Identity"><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A645B]" size={16} /><input type="email" name="email" required autoComplete="username" className="inputish pl-10" placeholder="Enter email address" /></div></Field><Field label="Secure Passcode"><div className="relative"><Key className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A645B]" size={16} /><input type="password" name="password" required autoComplete="current-password" className="inputish pl-10 font-mono tracking-widest" placeholder="••••••••" /></div></Field>{error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-sm border border-red-100">{error}</p>}<button disabled={loading} className="w-full bg-[#17130F] text-[#F4F0E8] font-medium py-3.5 rounded-sm hover:bg-[#2A241D] transition-all flex items-center justify-center gap-2 disabled:opacity-70">{loading ? <><span className="w-4 h-4 border-2 border-[#B8977E] border-t-transparent rounded-full animate-spin" /> Authenticating...</> : <>Establish Session <ArrowRight size={16} /></>}</button></div></form><p className="text-center mt-8 text-[10px] text-[#6A645B] uppercase tracking-widest">Restricted System. Authorized Personnel Only.</p></div></div>;
}

function StatusStrip({ staffCode }) {
  const [health, setHealth] = useState({ supabase: 'checking', xendit: 'checking', resend: 'checking', environment: 'production' });
  const [lastSync, setLastSync] = useState(null);
  useEffect(() => {
    let mounted = true;
    adminApi('health', { staffCode }).then((res) => { if (mounted) { setHealth(res); setLastSync(new Date()); } }).catch(() => { if (mounted) setHealth({ supabase: 'error', xendit: 'error', resend: 'error', environment: 'production' }); });
    return () => { mounted = false; };
  }, [staffCode]);
  return <div className="bg-[#17130F] text-[#B8977E] px-4 py-1.5 text-[10px] tracking-[0.2em] uppercase flex justify-between items-center shrink-0 z-50 relative border-b border-[#B8977E]/20"><div className="flex items-center gap-4"><span className="flex items-center gap-1.5 bg-[#B8977E]/10 px-2 rounded-full border border-[#B8977E]/30"><span className="w-1.5 h-1.5 rounded-full bg-[#B8977E] animate-pulse" />{health.environment || 'production'}</span><span className="hidden md:inline">Supabase {health.supabase === 'connected' ? 'Connected' : health.supabase === 'checking' ? 'Checking...' : 'Error'}</span><span className="hidden md:inline">Xendit {health.xendit === 'configured' ? 'Configured' : health.xendit === 'checking' ? 'Checking...' : 'Missing'}</span><span className="hidden lg:inline">Resend {health.resend === 'configured' ? 'Configured' : health.resend === 'checking' ? 'Checking...' : 'Missing'}</span></div><div className="flex items-center gap-4 text-[#6A645B]"><span>Last Sync: {lastSync ? lastSync.toLocaleTimeString() : 'Checking...'}</span></div></div>;
}

function Panel({ title, action, children }) { return <section className="bg-white border border-[#E5E0D8] rounded-md shadow-sm overflow-hidden"><div className="p-5 border-b border-[#E5E0D8] flex items-center justify-between bg-[#FBFAF7]"><h3 className="text-sm tracking-widest uppercase font-semibold text-[#17130F]">{title}</h3>{action}</div><div className="p-5">{children}</div></section>; }
function Drawer({ title, onClose, children }) { return <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true"><div className="absolute inset-0 bg-[#17130F]/40 backdrop-blur-sm" onClick={onClose} /><div className="relative w-full max-w-md bg-white shadow-2xl border-l border-[#E5E0D8] flex flex-col h-full"><div className="p-6 border-b border-[#E5E0D8] flex items-center justify-between bg-[#FBFAF7]"><h3 className="font-light text-xl tracking-tight text-[#17130F]">{title}</h3><button onClick={onClose} className="p-2 hover:bg-[#E5E0D8] text-[#6A645B] rounded-sm"><X size={18} /></button></div><div className="p-6 flex-1 overflow-y-auto space-y-8">{children}</div></div></div>; }
function NavItem({ icon, label, isActive, onClick }) { return <button type="button" onClick={onClick} aria-current={isActive ? 'page' : undefined} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-sm text-sm transition-all duration-200 group ${isActive ? 'bg-[#B8977E]/10 text-[#B8977E] font-medium' : 'text-[#6A645B] hover:text-[#F4F0E8] hover:bg-[#F4F0E8]/5'}`}><span className={isActive ? 'text-[#B8977E]' : 'text-[#6A645B] group-hover:text-[#F4F0E8]'}>{icon}</span><span className="tracking-wide">{label}</span></button>; }
function SidebarUser({ user, onLogout }) { return <div className="p-6 border-t border-[#B8977E]/10 bg-[#17130F]"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><Avatar name={user.name} /><div><p className="text-sm font-medium text-[#F4F0E8]">{user.name}</p><p className="text-[10px] text-[#B8977E] uppercase tracking-wider">{user.role}</p></div></div><button onClick={onLogout} className="text-[#6A645B] hover:text-[#B8977E] p-2" title="Secure Logout" aria-label="Logout"><LogOut size={16} /></button></div></div>; }
function Avatar({ name, large }) { return <div className={`${large ? 'w-16 h-16 text-2xl font-light' : 'w-9 h-9 text-sm'} rounded-sm bg-[#17130F] text-[#B8977E] flex items-center justify-center shadow-sm border border-[#B8977E]/30`}>{String(name || '?').charAt(0).toUpperCase()}</div>; }
function LoadingState({ text }) { return <div className="flex flex-col items-center justify-center h-full min-h-60 text-[#6A645B] space-y-4"><div className="w-8 h-8 border-2 border-[#E5E0D8] border-t-[#B8977E] rounded-full animate-spin" /><p className="text-xs uppercase tracking-widest font-medium">{text}</p></div>; }
function EmptyState({ text }) { return <div className="flex items-center justify-center min-h-28 text-sm text-[#6A645B] bg-[#F4F0E8]/50 border border-dashed border-[#E5E0D8] rounded-sm p-6">{text}</div>; }
function ConstructionState({ context }) { return <div className="flex flex-col items-center justify-center h-full text-[#6A645B] space-y-4"><Activity size={32} className="opacity-20" /><p className="text-sm uppercase tracking-widest text-center">Module Construction<br /><span className="text-xs normal-case">{context ? `Filtering context for ID: ${context.id}` : 'Awaiting phase 2 integration.'}</span></p></div>; }
function SearchBox({ value, onChange, placeholder }) { return <div className="relative w-full lg:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A645B]" size={16} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="inputish pl-9" /></div>; }
function HeaderCell({ children, align }) { return <th className={`py-4 px-6 text-[10px] font-semibold tracking-widest text-[#6A645B] uppercase ${align === 'right' ? 'text-right' : ''}`}>{children}</th>; }
function Table({ columns, rows }) { return <div className="overflow-x-auto border border-[#E5E0D8] rounded-sm"><table className="w-full text-left border-collapse min-w-[720px]"><thead><tr className="bg-[#F4F0E8]/60">{columns.map((column) => <HeaderCell key={column}>{column}</HeaderCell>)}</tr></thead><tbody className="text-sm divide-y divide-[#E5E0D8]">{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="py-3 px-6 text-[#211F1B] align-top">{cell}</td>)}</tr>)}</tbody></table></div>; }
function Badge({ label, cls }) { const color = cls === 'good' ? 'bg-green-50 text-green-700 border-green-100' : cls === 'bad' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100'; return <span className={`inline-flex mt-2 text-[10px] tracking-widest uppercase font-semibold px-2 py-1 border rounded-sm ${color}`}>{label}</span>; }
function SeverityBadge({ log }) { const color = log.severity === 'critical' ? 'bg-red-50 text-red-800 border-red-200' : log.severity === 'high' ? 'bg-orange-50 text-orange-800 border-orange-200' : log.severity === 'medium' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' : 'bg-[#F4F0E8] text-[#6A645B] border-[#E5E0D8]'; return <span className={`px-2 py-1 rounded-sm text-[10px] font-mono border ${color}`}>{log.action}</span>; }
function Field({ label, children }) { return <label className="block"><span className="block text-xs font-medium text-[#17130F] uppercase tracking-widest mb-2">{label}</span>{children}</label>; }
function Info({ label, value, mono }) { return <div><p className="tinyhead mb-1">{label}</p><p className={`${mono ? 'font-mono text-xs' : 'font-medium text-sm'} text-[#17130F]`}>{value}</p></div>; }
function SecurityPosture({ staff, detailed }) { return <div className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="text-[#6A645B]">Status</span><span className={staff.status === 'Active' ? 'text-green-700 font-medium' : 'text-[#6A645B]'}>{staff.status}</span></div><div className="flex items-center justify-between text-sm"><span className="text-[#6A645B]">Two-Factor Auth</span>{staff.mfa ? <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={14} /> Enabled</span> : <span className="text-red-600 font-medium flex items-center gap-1"><AlertTriangle size={14} /> Disabled</span>}</div>{detailed && <div className="flex items-center justify-between text-sm"><span className="text-[#6A645B]">Last Login</span><span className="font-mono text-xs">{staff.lastActive}</span></div>}</div>; }
