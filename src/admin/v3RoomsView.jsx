import React from 'react';
import { CommandPanel } from './v3Components.jsx';

const rooms = ['Grand Ocean Villa', 'Sunset Suite', 'Smart Room Premium'];

export default function V3RoomsView() {
  return (
    <CommandPanel title="Rooms" subtitle="PLP room collection overview.">
      <div className="grid gap-3 md:grid-cols-3">
        {rooms.map((room) => (
          <article key={room} className="rounded-xl border border-[#E5E0D8] bg-[#FFFDF8] p-5">
            <p className="font-medium">{room}</p>
            <p className="mt-2 text-xs leading-5 text-[#6A645B]">Room summary card prepared for availability, stay, and service data.</p>
          </article>
        ))}
      </div>
    </CommandPanel>
  );
}
