import React from 'react';
import { CommandPanel } from './v3Components.jsx';

const cards = [
  ['Rate foundation', 'Base nightly prices, seasonal rules, and long-stay considerations.'],
  ['Deposit rules', 'Deposit percentage, balance handling, and payment timing notes.'],
  ['Stay policies', 'Check-in, check-out, occupancy, guest count, and house rules.'],
  ['Review notes', 'Operational notes for exceptions, manual review, and guest handling.'],
];

export default function V3RatesPolicyView() {
  return (
    <CommandPanel title="Rates & Policies" subtitle="Commercial and stay-rule blueprint for the property.">
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map(([title, text]) => (
          <article key={title} className="rounded-xl border border-[#E5E0D8] bg-[#FFFDF8] p-5">
            <p className="font-medium">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[#6A645B]">{text}</p>
          </article>
        ))}
      </div>
    </CommandPanel>
  );
}
