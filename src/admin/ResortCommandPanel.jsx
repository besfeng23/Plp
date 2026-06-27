import React, { useMemo, useState } from 'react';
import { Database, Home, Key } from 'lucide-react';
import { CommandMetric, CommandPanel, EmptyState } from './v3Components.jsx';
import { buildAttentionQueue, summarizeReservation } from './v3ReservationModel.js';
import { displayStatus } from './v3Format.js';
import V3ReservationsView from './v3ReservationsView.jsx';
import V3PaymentsView from './v3PaymentsView.jsx';
import V3AvailabilityView from './v3AvailabilityView.jsx';
import V3GuestsView from './v3GuestsView.jsx';
import V3ContentStudioView from './v3ContentStudioView.jsx';
import V3SettingsView from './v3SettingsView.jsx';
import V3RoomsView from './v3RoomsView.jsx';
import V3RatesPolicyView from './v3RatesPolicyView.jsx';

const nav = ['Today', 'Reservations', 'Payments', 'Availability', 'Guests', 'Content', 'Rooms', 'Rates', 'Settings'];

export default function ResortCommandPanel({ rows = [], exceptions = [], contentRows = [], blocks = [] }) {
  const [tab, setTab] = useState('Today');
  const attention = useMemo(() => buildAttentionQueue(rows, exceptions, []), [rows, exceptions]);
  const paid = rows.filter((row) => displayStatus(row).label === 'Paid deposit');
  const highTouch = rows.filter((row) => summarizeReservation(row).isHighTouch);

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <aside className="rounded-2xl border border-[#E5E0D8] bg-[#17130F] p-4 text-white">
        <p className="text-[10px] uppercase tracking-[0.32em] text-[#B8977E]">Resort Command</p>
        <nav className="mt-5 space-y-1">
          {nav.map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`w-full rounded-sm px-3 py-2 text-left text-sm ${tab === item ? 'bg-[#B8977E]/15 text-[#B8977E]' : 'text-[#8E867C] hover:bg-white/5 hover:text-white'}`}>{item}</button>
          ))}
        </nav>
      </aside>
      <section>
        {tab === 'Today' && <Today rows={rows} paid={paid} highTouch={highTouch} exceptions={exceptions} attention={attention} />}
        {tab === 'Reservations' && <V3ReservationsView rows={rows} />}
        {tab === 'Payments' && <V3PaymentsView rows={rows} exceptions={exceptions} />}
        {tab === 'Availability' && <V3AvailabilityView rows={rows} blocks={blocks} />}
        {tab === 'Guests' && <V3GuestsView rows={rows} />}
        {tab === 'Content' && <V3ContentStudioView rows={contentRows} />}
        {tab === 'Rooms' && <V3RoomsView />}
        {tab === 'Rates' && <V3RatesPolicyView />}
        {tab === 'Settings' && <V3SettingsView />}
      </section>
    </div>
  );
}

function Today({ rows, paid, highTouch, exceptions, attention }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <CommandMetric icon={<Database size={16} />} label="Reservations" value={rows.length} />
        <CommandMetric icon={<Key size={16} />} label="Paid deposits" value={paid.length} tone="good" />
        <CommandMetric icon={<Home size={16} />} label="High-touch" value={highTouch.length} />
        <CommandMetric icon={<Database size={16} />} label="Exceptions" value={exceptions.length} tone="bad" />
      </div>
      <CommandPanel title="Needs Attention" subtitle="Revenue, stay length, and reconciliation items.">
        {attention.length === 0 ? <EmptyState text="No urgent items." /> : attention.slice(0, 8).map((item, index) => (
          <article key={index} className="mb-3 rounded-xl border border-[#E5E0D8] bg-[#FFFDF8] p-4">
            <p className="font-mono text-sm font-bold">{item.summary.reference}</p>
            <p className="mt-1 text-sm text-[#6A645B]">{item.summary.guestName} · {item.summary.room}</p>
            <p className="mt-2 text-xs text-[#6A645B]">{item.message}</p>
          </article>
        ))}
      </CommandPanel>
    </div>
  );
}
