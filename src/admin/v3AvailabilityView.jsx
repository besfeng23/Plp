import React from 'react';
import { CommandPanel } from './v3Components.jsx';
import { buildAvailabilitySummary } from './v3ServiceModel.js';

export default function V3AvailabilityView({ rows = [], blocks = [] }) {
  const summary = buildAvailabilitySummary(rows, blocks);
  return (
    <CommandPanel title="Availability" subtitle="Villa inventory summary. Calendar grid comes next.">
      <div className="grid gap-3 md:grid-cols-3">
        {summary.map((room) => (
          <article key={room.room} className="rounded-xl border border-[#E5E0D8] bg-[#FFFDF8] p-4">
            <p className="font-medium">{room.room}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <p>Reservations<br /><strong>{room.reservations}</strong></p>
              <p>Blocks<br /><strong>{room.blocked}</strong></p>
              <p>Long stays<br /><strong>{room.longStays}</strong></p>
              <p>Total value<br /><strong>{room.totalValue}</strong></p>
            </div>
          </article>
        ))}
      </div>
    </CommandPanel>
  );
}
