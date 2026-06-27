import React from 'react';
import { CommandBadge, CommandPanel, EmptyState } from './v3Components.jsx';
import { pick, safe } from './v3Format.js';

const sections = ['Homepage', 'Rooms', 'Experiences', 'Policies', 'FAQ', 'SEO', 'Images', 'Promos'];

export default function V3ContentStudioView({ rows = [] }) {
  return (
    <CommandPanel title="Content Studio" subtitle="Structured website content for the public PLP experience.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => {
          const row = rows.find((item) => String(item.section || '').toLowerCase() === section.toLowerCase());
          return (
            <article key={section} className="rounded-xl border border-[#E5E0D8] bg-[#FFFDF8] p-4">
              <p className="font-medium">{section}</p>
              <p className="mt-2 text-xs text-[#6A645B]">{row ? `Status: ${safe(pick(row, ['status']))}` : 'No row yet'}</p>
              <div className="mt-3">{row ? <CommandBadge value={safe(pick(row, ['status']))} tone="warn" /> : <CommandBadge value="Draft needed" tone="warn" />}</div>
              <p className="mt-3 text-xs leading-5 text-[#6A645B]">Draft, preview, publish, version history, and rollback are staged for the next content phase.</p>
            </article>
          );
        })}
      </div>
      {rows.length === 0 && <div className="mt-4"><EmptyState text="No content rows returned yet." /></div>}
    </CommandPanel>
  );
}
