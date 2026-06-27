import React from 'react';
import { AlertCircle, CheckCircle2, Clock, CreditCard } from 'lucide-react';
import { CommandBadge, CommandMetric, CommandPanel, EmptyState } from './v3Components.jsx';
import { displayStatus, money, pick } from './v3Format.js';

export default function V3PaymentsView({ rows = [], exceptions = [] }) {
  const verified = rows.filter((row) => displayStatus(row).label === 'Paid deposit');
  const pending = rows.filter((row) => ['Payment review', 'Pending'].includes(displayStatus(row).label));
  const total = verified.reduce((sum, row) => sum + Number(pick(row, ['deposit_amount_php', 'payment_amount_php'], 0)), 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <CommandMetric icon={<CheckCircle2 size={16} />} label="Verified deposits" value={verified.length} tone="good" />
        <CommandMetric icon={<Clock size={16} />} label="Pending review" value={pending.length} />
        <CommandMetric icon={<AlertCircle size={16} />} label="Exceptions" value={exceptions.length} tone="bad" />
        <CommandMetric icon={<CreditCard size={16} />} label="Deposit total" value={money(total)} dark />
      </div>
      <CommandPanel title="Payment Exceptions" subtitle="Rows that need staff review before a reservation is treated as clean.">
        {exceptions.length === 0 ? <EmptyState text="No payment exceptions." /> : (
          <div className="grid gap-3">
            {exceptions.map((row, index) => (
              <article key={row.id || index} className="rounded-xl border border-red-100 bg-[#FFFDF8] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-bold">{pick(row, ['booking_reference', 'provider_reference_id'], '—')}</p>
                    <p className="mt-1 text-xs text-[#6A645B]">{pick(row, ['event_type'], 'Payment event')}</p>
                  </div>
                  <CommandBadge value={pick(row, ['verification_status', 'status'], 'Review')} tone="bad" />
                </div>
                <p className="mt-3 text-sm">Expected {money(pick(row, ['expected_amount_php'], 0))} · Received {money(pick(row, ['amount_php'], 0))}</p>
                <p className="mt-1 text-xs text-[#6A645B]">{pick(row, ['verification_notes', 'verification_error'], 'Manual review required.')}</p>
              </article>
            ))}
          </div>
        )}
      </CommandPanel>
    </div>
  );
}
