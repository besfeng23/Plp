(() => {
  let rowsCache = [];
  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const field = (row, names) => names.map((name) => row?.[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';

  function guest(row) { return field(row, ['guest_name', 'name', 'full_name', 'guestName']) || 'Unnamed guest'; }
  function room(row) { return field(row, ['accommodation_name', 'accommodation', 'room_name', 'villa_name', 'room', 'villa']) || 'Unassigned'; }
  function code(row) { return field(row, ['booking_reference', 'reference', 'booking_code', 'code']); }
  function arrive(row) { return field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']); }
  function depart(row) { return field(row, ['check_out', 'checkOut', 'departure_date', 'departureDate']); }
  function dateOnly(value) { const date = value ? new Date(`${String(value).slice(0, 10)}T00:00:00`) : null; return date && !Number.isNaN(date.getTime()) ? date : null; }
  function today() { const date = new Date(); date.setHours(0, 0, 0, 0); return date; }
  function daysFromToday(value) { const date = dateOnly(value); return date ? Math.round((date.getTime() - today().getTime()) / 86400000) : null; }

  function classify(row) {
    const inDays = daysFromToday(arrive(row));
    const outDays = daysFromToday(depart(row));
    if (outDays === 0 && inDays === 0) return { bucket: 'sameDay', label: 'Same-day turnover', priority: 'High' };
    if (outDays === 0) return { bucket: 'checkout', label: 'Checkout turnover', priority: 'High' };
    if (inDays === 0) return { bucket: 'checkin', label: 'Arrival prep today', priority: 'High' };
    if (inDays !== null && inDays > 0 && inDays <= 3) return { bucket: 'prep', label: `Prep in ${inDays} day${inDays === 1 ? '' : 's'}`, priority: 'Medium' };
    if (dateOnly(arrive(row)) && dateOnly(depart(row)) && dateOnly(arrive(row)) <= today() && today() < dateOnly(depart(row))) return { bucket: 'inhouse', label: 'In-house refresh', priority: 'Normal' };
    return null;
  }

  function tasks(rows) {
    return (rows || []).map((row, index) => ({ row, index, info: classify(row) })).filter((item) => item.info).sort((a, b) => ({ High: 3, Medium: 2, Normal: 1 }[b.info.priority] || 0) - ({ High: 3, Medium: 2, Normal: 1 }[a.info.priority] || 0));
  }

  function pill(priority) {
    const cls = priority === 'High' ? 'danger' : priority === 'Medium' ? 'warn' : 'ok';
    return `<span class="pill ${cls}">${esc(priority)}</span>`;
  }

  function readiness(item) {
    if (item.info.bucket === 'sameDay') return 'Dirty → inspect → ready before arrival';
    if (item.info.bucket === 'checkout') return 'Dirty after checkout; turnover required';
    if (item.info.bucket === 'checkin') return 'Inspect and ready before arrival';
    if (item.info.bucket === 'prep') return 'Upcoming prep check';
    return 'Stayover refresh check';
  }

  function card(item) {
    const row = item.row;
    return `<article class="hk-card"><div class="hk-card__top"><div><strong>${esc(room(row))}</strong><span>${esc(item.info.label)}</span></div>${pill(item.info.priority)}</div><div class="hk-grid"><div><span>Guest</span>${esc(guest(row))}</div><div><span>Stay</span>${esc(arrive(row) || '—')} → ${esc(depart(row) || '—')}</div><div><span>Reference</span>${esc(code(row))}</div><div><span>Readiness</span>${esc(readiness(item))}</div></div><button type="button" class="r360-view" onclick="window.openReservation360(${item.index})">View 360</button></article>`;
  }

  function ensureShell() {
    if (document.getElementById('housekeeping-readiness')) return;
    const style = document.createElement('style');
    style.textContent = '.hk-grid-wrap{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.hk-card{border:1px solid rgba(229,224,216,.88);border-radius:20px;background:rgba(255,253,248,.82);box-shadow:var(--shadow);padding:16px;overflow-wrap:anywhere}.hk-card__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.hk-card__top span{display:block;margin-top:3px;color:var(--muted);font-size:12px}.hk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;color:var(--muted);font-size:12px;margin-bottom:12px}.hk-grid span{display:block;color:var(--brass);font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.hk-note{border-radius:12px;background:var(--sand);padding:10px;color:var(--muted);font-size:12px;line-height:1.45;margin-bottom:14px;border:1px dashed rgba(184,151,126,.42)}@media(max-width:1100px){.hk-grid-wrap{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.hk-grid-wrap,.hk-grid{grid-template-columns:1fr}.hk-card .r360-view{width:100%}}';
    document.head.appendChild(style);
    const anchor = document.getElementById('availability-board') || document.getElementById('concierge-queue') || document.getElementById('guest-profile-360') || document.getElementById('confirmation-workflow') || document.getElementById('today-lists') || document.getElementById('summary');
    if (!anchor) return;
    const section = document.createElement('section');
    section.id = 'housekeeping-readiness';
    section.innerHTML = '<div class="section-head"><div><h2>Housekeeping Readiness</h2><p>Read-only turnover and stayover readiness from loaded reservation dates.</p></div><div class="section-actions"><button type="button" class="ghost" onclick="setMessage(\'Housekeeping Readiness V1 is read-only. It does not save room status.\')">Housekeeping safety</button></div></div><div class="hk-note"><strong>Read-only readiness:</strong> Dirty, inspect, ready, turnover, and refresh labels are derived from booking timing only. No room status is saved in this phase.</div><div class="hk-grid-wrap" id="housekeepingGrid"></div>';
    anchor.insertAdjacentElement('afterend', section);
  }

  function render(rows) {
    rowsCache = rows || [];
    ensureShell();
    const grid = document.getElementById('housekeepingGrid');
    if (!grid) return;
    const items = tasks(rowsCache);
    grid.innerHTML = items.length ? items.map(card).join('') : '<div class="empty-state">No housekeeping readiness items derived from loaded reservations.</div>';
    window.plpHousekeepingReadiness = items;
  }

  const oldToday = window.renderTodayCommand;
  if (typeof oldToday === 'function') window.renderTodayCommand = function (rows, notifications) { const out = oldToday.apply(this, arguments); render(rows || []); return out; };
  const oldRows = window.renderRows;
  if (typeof oldRows === 'function') window.renderRows = function (rows) { const out = oldRows.apply(this, arguments); render(rows || []); return out; };
  ensureShell();
  render(rowsCache);
})();
