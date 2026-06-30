(() => {
  let rowsCache = [];
  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const field = (row, names) => names.map((name) => row?.[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
  const status = (value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

  function guest(row) { return field(row, ['guest_name', 'name', 'full_name', 'guestName']) || 'Unnamed guest'; }
  function room(row) { return field(row, ['accommodation_name', 'accommodation', 'room_name', 'villa_name', 'room', 'villa']) || 'Unassigned'; }
  function code(row) { return field(row, ['booking_reference', 'reference', 'booking_code', 'code']); }
  function arrive(row) { return field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']); }
  function depart(row) { return field(row, ['check_out', 'checkOut', 'departure_date', 'departureDate']); }
  function dateOnly(value) { const date = value ? new Date(`${String(value).slice(0, 10)}T00:00:00`) : null; return date && !Number.isNaN(date.getTime()) ? date : null; }
  function iso(date) { return date.toISOString().slice(0, 10); }
  function plus(date, count) { const next = new Date(date); next.setDate(next.getDate() + count); return next; }

  function stayDates(row) {
    const start = dateOnly(arrive(row));
    const end = dateOnly(depart(row));
    const out = [];
    if (!start || !end || end <= start) return out;
    for (let day = new Date(start); day < end; day = plus(day, 1)) out.push(iso(day));
    return out;
  }

  function active(row) {
    const text = `${status(field(row, ['booking_status', 'status']))} ${status(field(row, ['payment_verification_status', 'verification_status']))}`;
    return !/CANCELLED|CANCELED|EXPIRED|FAILED/.test(text);
  }

  function build(rows) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 14 }, (_, index) => iso(plus(today, index)));
    const board = new Map();
    (rows || []).forEach((row, index) => {
      if (!active(row)) return;
      const name = room(row);
      if (!board.has(name)) board.set(name, Object.fromEntries(days.map((day) => [day, []])));
      stayDates(row).forEach((day) => { if (board.get(name)[day]) board.get(name)[day].push({ row, index }); });
    });
    return { days, board };
  }

  function renderCell(items) {
    if (!items.length) return '<td class="avail-open">Open</td>';
    const first = items[0];
    const label = items.length > 1 ? `${items.length} records` : 'Occupied';
    return `<td class="avail-booked"><button type="button" onclick="window.openReservation360(${first.index})"><strong>${esc(label)}</strong><span>${esc(guest(first.row))}</span><small>${esc(code(first.row))}</small></button></td>`;
  }

  function timeline(rows) {
    const events = [];
    (rows || []).forEach((row, index) => {
      if (arrive(row)) events.push({ type: 'Check-in', date: arrive(row), row, index });
      if (depart(row)) events.push({ type: 'Check-out', date: depart(row), row, index });
    });
    return events.sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 18);
  }

  function ensureShell() {
    if (document.getElementById('availability-board')) return;
    const style = document.createElement('style');
    style.textContent = '.availability-wrap{overflow:auto;border:1px solid rgba(229,224,216,.88);border-radius:20px;background:rgba(255,253,248,.82);box-shadow:var(--shadow)}.availability-table{width:100%;border-collapse:collapse;min-width:900px}.availability-table th,.availability-table td{border-bottom:1px solid rgba(229,224,216,.8);border-right:1px solid rgba(229,224,216,.55);padding:10px;text-align:left;vertical-align:top}.availability-table th{position:sticky;top:0;background:var(--sand);z-index:1;color:var(--teak);font-size:11px}.availability-table th:first-child,.availability-table td:first-child{position:sticky;left:0;background:#FFFDF8;z-index:2;min-width:170px}.avail-open{color:var(--muted);font-size:12px}.avail-booked{background:rgba(184,151,126,.14);font-size:12px}.avail-booked button{width:100%;border:0;background:transparent;text-align:left;color:inherit;padding:0}.avail-booked span,.avail-booked small{display:block;margin-top:3px;color:var(--muted);font-size:11px}.availability-timeline{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:14px}.availability-event{border:1px solid rgba(229,224,216,.88);border-radius:16px;background:rgba(255,253,248,.82);padding:12px;overflow-wrap:anywhere}.availability-note{border-radius:12px;background:var(--sand);padding:10px;color:var(--muted);font-size:12px;line-height:1.45;margin-bottom:14px;border:1px dashed rgba(184,151,126,.42)}@media(max-width:900px){.availability-timeline{grid-template-columns:1fr}}';
    document.head.appendChild(style);
    const anchor = document.getElementById('concierge-queue') || document.getElementById('guest-profile-360') || document.getElementById('confirmation-workflow') || document.getElementById('today-lists') || document.getElementById('summary');
    if (!anchor) return;
    const section = document.createElement('section');
    section.id = 'availability-board';
    section.innerHTML = '<div class="section-head"><div><h2>Availability Board</h2><p>Read-only 14-day occupancy board from loaded reservation rows.</p></div><div class="section-actions"><button type="button" class="ghost" onclick="setMessage(\'Availability Board V1 is read-only.\')">Board safety</button></div></div><div class="availability-note"><strong>Read-only board:</strong> This view derives occupancy from loaded admin rows only.</div><div class="availability-wrap" id="availabilityBoardWrap"></div><div class="availability-timeline" id="availabilityTimeline"></div>';
    anchor.insertAdjacentElement('afterend', section);
  }

  function render(rows) {
    rowsCache = rows || [];
    ensureShell();
    const wrap = document.getElementById('availabilityBoardWrap');
    const line = document.getElementById('availabilityTimeline');
    if (!wrap || !line) return;
    const data = build(rowsCache);
    const roomRows = Array.from(data.board.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    wrap.innerHTML = roomRows.length ? `<table class="availability-table"><thead><tr><th>Accommodation</th>${data.days.map((day) => `<th>${esc(day.slice(5))}</th>`).join('')}</tr></thead><tbody>${roomRows.map(([name, slots]) => `<tr><td><strong>${esc(name)}</strong></td>${data.days.map((day) => renderCell(slots[day] || [])).join('')}</tr>`).join('')}</tbody></table>` : '<div class="empty-state">No availability rows derived from loaded reservations.</div>';
    const events = timeline(rowsCache);
    line.innerHTML = events.length ? events.map((event) => `<article class="availability-event"><strong>${esc(event.type)}</strong><p>${esc(event.date)} · ${esc(guest(event.row))} · ${esc(room(event.row))}</p><button type="button" class="r360-view" onclick="window.openReservation360(${event.index})">View 360</button></article>`).join('') : '<div class="empty-state">No check-in/check-out timeline available.</div>';
  }

  function loadHousekeeping() {
    if (document.querySelector('script[data-housekeeping-readiness]')) return;
    const script = document.createElement('script');
    script.src = '/housekeeping-readiness.js';
    script.defer = true;
    script.setAttribute('data-housekeeping-readiness', 'true');
    document.body.appendChild(script);
  }

  const oldToday = window.renderTodayCommand;
  if (typeof oldToday === 'function') window.renderTodayCommand = function (rows, notifications) { const out = oldToday.apply(this, arguments); render(rows || []); return out; };
  const oldRows = window.renderRows;
  if (typeof oldRows === 'function') window.renderRows = function (rows) { const out = oldRows.apply(this, arguments); render(rows || []); return out; };
  ensureShell();
  render(rowsCache);
  loadHousekeeping();
})();
