import React from 'react';
import { CommandPanel } from './v3Components.jsx';

const settings = [
  ['Property rules', 'Check-in and check-out windows, capacity, buffers, and operating calendar.'],
  ['Rate strategy', 'Seasonal rates, long-stay rules, per-night overrides, and promo windows.'],
  ['System health', 'Database, payment provider, email provider, and webhook readiness.'],
  ['Access model', 'Staff identity, roles, session controls, approval gates, and activity history.'],
];

export default function V3SettingsView() {
  return (
    <CommandPanel title="Settings" subtitle="Configuration blueprint for a proper luxury resort operations system.">
      <div className="grid gap-3 md:grid-cols-2">
        {settings.map(([title, text]) => (
          <article key={title} className="rounded-xl border border-[#E5E0D8] bg-[#FFFDF8] p-5">
            <p className="font-medium">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[#6A645B]">{text}</p>
          </article>
        ))}
      </div>
    </CommandPanel>
  );
}
