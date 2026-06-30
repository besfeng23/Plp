(() => {
  let rowsCache = [];
  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const field = (row, names) => names.map((name) => row?.[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
  const status = (value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH')}`;

  function dateOnly(value) {
    if (!value) return null;
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function daysUntil(value) {
    const date = dateOnly(value);
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((date.getTime() - today.getTime()) / 86400000);
  }

  function guest(row) { return field(row, ['guest_name', 'name', 'full_name', 'guestName']) || 'Unnamed guest'; }
  function ref(row) { return field(row, ['booking_reference', 'reference', 'booking_code', 'code']); }
  function room(row) { return field(row, ['accommodation_name', 'accommodation', 'room_name', 'villa_name', 'room', 'villa']) || 'Unassigned'; }
  function checkIn(row) { return field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']); }
  function checkOut(row) { return field(row, ['check_out', 'checkOut', 'departure_date', 'departureDate']); }
  function noteText(row) { return field(row, ['special_requests', 'notes', 'message', 'guest_notes', 'arrival_notes']); }
  function paymentReview(row) {
    const text = `${status(field(row, ['payment_status', 'booking_payment_status']))} ${status(field(row, ['payment_verification_status', 'verification_status']))} ${status(field(row, ['verification_error', 'verification_note', 'verification_notes']))}`;
    return !text.includes('VERIFIED') || /PENDING|PROCESSING|AWAITING|REVIEW|FAILED|MISMATCH|UNMATCHED|ERROR/.test(text);
  }

  function inferCategory(row) {
    const text = noteText(row).toLowerCase();
    if (/airport|transfer|pickup|pick up|boat|jetty|caticlan|kalibo|arrival|van|car/.test(text)) return 'Transfers';
    if (/birthday|anniversary|proposal|honeymoon|celebration|decor|cake|flowers/.test(text)) return 'Occasions';
    if (/dinner|breakfast|food|chef|wine|restaurant|diet|allergy|vegetarian|halal/.test(text)) return 'Dining';
    if (/spa|massage|wellness|yoga|tour|island|activity|experience/.test(text)) return 'Experiences';
    if (paymentReview(row)) return 'Follow-up';
    return 'Guest Requests';
  }

  function priority(row) {
    const arriveIn = daysUntil(checkIn(row));
    if (paymentReview(row)) return 'High';
    if (arriveIn !== null && arriveIn >= 0 && arriveIn <= 2) return 'High';
    if (arriveIn !== null && arriveIn >= 0 && arriveIn <= 7) return 'Medium';
    return 'Normal';
  }

  function deriveTasks(rows) {
    const tasks = [];
    (rows || []).forEach((row, index) => {
      const arriveIn = daysUntil(checkIn(row));
      const notes = noteText(row);
      if (notes) tasks.push({ row, index, category: inferCategory(row), title: notes, source: 'Booking request note', priority: priority(row) });
      if (arriveIn !== null && arriveIn >= 0 && arriveIn <= 7) tasks.push({ row, index, category: 'Arriving Soon', title: `Prepare arrival for ${guest(row)} in ${arriveIn === 0 ? 'today' : `${arriveIn} day${arriveIn === 1 ? '' : 's'}`}.`, source: 'Arrival date', priority: arriveIn <= 2 ? 'High' : 'Medium' });
      if (paymentReview(row)) tasks.push({ row, index, category: 'Follow-up', title: 'Review deposit/payment state before confirming guest arrangements.', source: 'Payment status', priority: 'High' });
      const balance = Number(field(row, ['balance_amount_php']) || 0);
      if (balance > 0) tasks.push({ row, index, category: 'Follow-up', title: `Balance due remains ${money(balance)}.`, source: 'Balance amount', priority: 'Medium' });
    });
    return tasks.sort((a, b) => ({ High: 3, Medium: 2, Normal: 1 }[b.priority] || 0) - ({ High: 3, Medium: 2, Normal: 1 }[a.priority] || 0));
  }

  function pill(text) {
    const cls = text === 'High' ? 'danger' : text === 'Medium' ? 'warn' : 'ok';
    return `<span class="pill ${cls}">${esc(text)}</span>`;
  }

  function taskCard(task) {
    return `<article class="concierge-task-card"><div class="concierge-task-card__top"><div><strong>${esc(task.category)}</strong><span>${esc(task.source)}</span></div>${pill(task.priority)}</div><p>${esc(task.title)}</p><div class="concierge-task-meta"><div><span>Guest</span>${esc(guest(task.row))}</div><div><span>Stay</span>${esc(checkIn(task.row) || '—')} → ${esc(checkOut(task.row) || '—')}</div><div><span>Room</span>${esc(room(task.row))}</div><div><span>Reference</span>${esc(ref(task.row))}</div></div><button type="button" class="r360-view" onclick="window.openReservation360(${task.index})">View 360</button></article>`;
  }

  function ensureShell() {
    if (document.getElementById('concierge-queue')) return;
    const style = document.createElement('style');
    style.textContent = '.concierge-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.concierge-task-card{border:1px solid rgba(229,224,216,.88);border-radius:20px;background:rgba(255,253,248,.82);box-shadow:var(--shadow);padding:16px;overflow-wrap:anywhere}.concierge-task-card__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.concierge-task-card__top span{display:block;margin-top:3px;color:var(--muted);font-size:12px}.concierge-task-card p,.concierge-note{border-radius:12px;background:var(--sand);padding:10px;color:var(--muted);font-size:12px;line-height:1.45}.concierge-note{margin-bottom:14px;border:1px dashed rgba(184,151,126,.42)}.concierge-task-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;color:var(--muted);font-size:12px;margin:12px 0}.concierge-task-meta span{display:block;color:var(--brass);font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}@media(max-width:1100px){.concierge-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.concierge-grid,.concierge-task-meta{grid-template-columns:1fr}.concierge-task-card .r360-view{width:100%}}';
    document.head.appendChild(style);
    const anchor = document.getElementById('guest-profile-360') || document.getElementById('confirmation-workflow') || document.getElementById('today-lists') || document.getElementById('summary');
    if (!anchor) return;
    const section = document.createElement('section');
    section.id = 'concierge-queue';
    section.innerHTML = '<div class="section-head"><div><h2>Concierge Queue</h2><p>Read-only derived queue from arrivals, booking notes, balances, payment states, and guest requests.</p></div><div class="section-actions"><button type="button" class="ghost" onclick="setMessage(\'Concierge Queue V1 is read-only. It does not save tasks or notes yet.\')">Queue safety</button></div></div><div class="concierge-note"><strong>Read-only queue:</strong> Tasks are derived from loaded admin rows. Staff tasks are not persisted in this phase.</div><div class="concierge-grid" id="conciergeQueueGrid"></div>';
    anchor.insertAdjacentElement('afterend', section);
  }

  function renderQueue(rows) {
    rowsCache = rows || [];
    ensureShell();
    const grid = document.getElementById('conciergeQueueGrid');
    if (!grid) return;
    const tasks = deriveTasks(rowsCache);
    grid.innerHTML = tasks.length ? tasks.map(taskCard).join('') : '<div class="empty-state">No concierge tasks derived from loaded records.</div>';
    window.plpConciergeQueue = tasks;
  }

  const oldToday = window.renderTodayCommand;
  if (typeof oldToday === 'function') window.renderTodayCommand = function (rows, notifications) { const out = oldToday.apply(this, arguments); renderQueue(rows || []); return out; };
  const oldRows = window.renderRows;
  if (typeof oldRows === 'function') window.renderRows = function (rows) { const out = oldRows.apply(this, arguments); renderQueue(rows || []); return out; };
  ensureShell();
  renderQueue(rowsCache);
})();
