import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CommandBadge, CommandPanel, EmptyState } from './v3Components.jsx';
import { displayStatus, formatDate, money, nightsBetween, pick } from './v3Format.js';

export default function V3ReservationsView({ rows = [], onOpen }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => JSON.stringify(row || {}).toLowerCase().includes(needle));
  }, [rows, query]);

  return (
    <CommandPanel title="Reservations" subtitle="Guest, villa, stay, deposit, balance, and source record in one calm view.">
      <div className="relative w-full md:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A645B]" size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search reference, guest, email, villa..."
          className="w-full rounded-sm border border-[#E5E0D8] bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-[#B8977E]"
        />
      </div>
      <div className="mt-5 grid gap-3">
        {filtered.length === 0 && <EmptyState text="No reservation rows match this view." />}
        {filtered.map((row, index) => <ReservationCard key={`${pick(row, ['booking_reference'], index)}-${index}`} row={row} onOpen={onOpen} />)}
      </div>
    </CommandPanel>
  );
}

function ReservationCard({ row, onOpen }) {
  const state = displayStatus(row);
  const checkIn = pick(row, ['check_in']);
  const checkOut = pick(row, ['check_out']);
  return (
    <article className="rounded-2xl border border-[#E5E0D8] bg-[#FFFDF8] p-4 shadow-sm transition hover:border-[#B8977E]/60">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_.8fr_auto]">
        <div>
          <p className="font-mono text-lg font-semibold tracking-[-0.04em] text-[#17130F]">{pick(row, ['booking_reference', 'reference'], '—')}</p>
          <p className="mt-1 text-sm text-[#6A645B]">{pick(row, ['guest_name', 'full_name', 'name'], '—')}</p>
          <p className="break-all text-xs text-[#6A645B]">{pick(row, ['guest_email', 'email'], '')}</p>
          <div className="mt-2"><CommandBadge value={state.label} tone={state.tone} /></div>
        </div>
        <div>
          <p className="text-sm font-medium">{pick(row, ['accommodation_name', 'accommodation'], '—')}</p>
          <p className="mt-1 text-xs text-[#6A645B]">{formatDate(checkIn)} → {formatDate(checkOut)}</p>
          <p className="text-xs text-[#6A645B]">{nightsBetween(checkIn, checkOut)} nights</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs lg:block lg:space-y-1">
          <p><span className="text-[#6A645B]">Total</span><br />{money(pick(row, ['total_amount_php'], 0))}</p>
          <p><span className="text-[#6A645B]">Deposit</span><br />{money(pick(row, ['deposit_amount_php', 'payment_amount_php'], 0))}</p>
          <p><span className="text-[#6A645B]">Balance</span><br />{money(pick(row, ['balance_amount_php'], 0))}</p>
        </div>
        <div className="flex justify-start lg:justify-end">
          <button onClick={() => onOpen?.(row)} className="btnish">Open 360</button>
        </div>
      </div>
    </article>
  );
}
