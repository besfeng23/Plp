import React from 'react';

export function CommandPanel({ title, subtitle, action, children }) {
  return (
    <section className="rounded-2xl border border-[#E5E0D8] bg-[#FFFDF8] shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#E5E0D8] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#B8977E] font-semibold">{title}</p>
          {subtitle && <p className="mt-1 text-sm text-[#6A645B]">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

export function CommandMetric({ label, value, help, icon, tone = 'neutral', dark = false }) {
  const toneClass = tone === 'bad' ? 'border-red-200 text-[#B75B50]' : tone === 'good' ? 'border-green-100 text-green-700' : 'border-[#E5E0D8] text-[#6A645B]';
  return (
    <div className={`${dark ? 'bg-[#17130F] text-[#F7F2EA] border-[#17130F]' : 'bg-[#FFFDF8]'} rounded-xl border ${toneClass} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold">{label}</p>
        <span className="text-[#B8977E]">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-light tracking-[-0.04em]">{value}</p>
      {help && <p className="mt-1 text-xs text-[#6A645B]">{help}</p>}
    </div>
  );
}

export function CommandBadge({ value, tone = 'warn' }) {
  const cls = tone === 'good'
    ? 'border-green-100 bg-green-50 text-green-700'
    : tone === 'bad'
      ? 'border-red-100 bg-red-50 text-red-700'
      : 'border-yellow-100 bg-yellow-50 text-yellow-700';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${cls}`}>{value || '—'}</span>;
}

export function EmptyState({ text }) {
  return <div className="rounded-xl border border-dashed border-[#E5E0D8] bg-[#F7F2EA] p-6 text-center text-sm text-[#6A645B]">{text}</div>;
}
