import React from 'react';
import { CommandBadge, CommandPanel, EmptyState } from './v3Components.jsx';
import { buildGuestProfiles } from './v3ServiceModel.js';
import { money } from './v3Format.js';

export default function V3GuestsView({ rows = [] }) {
  const guests = buildGuestProfiles(rows);
  return (
    <CommandPanel title="Guest Memory" subtitle="A luxury stay should remember the guest, not only the reservation.">
      {guests.length === 0 ? <EmptyState text="Guest profiles appear as reservations load." /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {guests.map((guest) => (
            <article key={guest.email} className="rounded-xl border border-[#E5E0D8] bg-[#FFFDF8] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{guest.name || 'Guest'}</p>
                  <p className="break-all text-xs text-[#6A645B]">{guest.email}</p>
                </div>
                {guest.highTouch && <CommandBadge value="High-touch" tone="warn" />}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <p>Stays<br /><strong>{guest.stays}</strong></p>
                <p>Total value<br /><strong>{money(guest.totalValue)}</strong></p>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#6A645B]">Preferences, transfers, special occasions, and guest notes are staged for the next data phase.</p>
            </article>
          ))}
        </div>
      )}
    </CommandPanel>
  );
}
