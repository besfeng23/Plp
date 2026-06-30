(() => {
  let rowsCache = [];
  const field = (row, names) => names.map((name) => row?.[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const norm = (value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const peso = (value) => `₱${Number(value || 0).toLocaleString('en-PH')}`;
  const exceptionTokens = ['FAILED', 'MISMATCH', 'UNMATCHED', 'ORDER_ID', 'DATABASE_UNCONFIGURED', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'CAPTURE_NOT_COMPLETED'];

  function booking(row) { return norm(field(row, ['booking_status', 'status'])) || 'MISSING'; }
  function payment(row) { return norm(field(row, ['payment_status', 'booking_payment_status'])) || 'MISSING'; }
  function verification(row) { return norm(field(row, ['payment_verification_status', 'verification_status'])) || 'MISSING'; }
  function hasException(row) {
    const text = `${booking(row)} ${payment(row)} ${verification(row)} ${field(row, ['verification_error', 'verification_note', 'verification_notes'])}`;
    return exceptionTokens.some((token) => text.includes(token)) || Boolean(field(row, ['verification_error', 'verification_note', 'verification_notes']));
  }
  function group(row) {
    if (hasException(row)) return 'exceptions';
    if (['CONFIRMED', 'FULLY_PAID', 'CHECKED_IN', 'CHECKED_OUT'].includes(booking(row))) return 'confirmed';
    if (verification(row) === 'VERIFIED' && /READY|REVIEWED|PAID_DEPOSIT/.test(booking(row))) return 'ready';
    if (verification(row) === 'VERIFIED') return 'verified';
    if (field(row, ['provider_session_id', 'provider_payment_id', 'last_webhook_id']) || /PROCESS/.test(`${payment(row)} ${booking(row)}`)) return 'processing';
    return 'awaiting';
  }
  function pill(value) {
    const text = norm(value || 'MISSING');
    const cls = /VERIFIED|CONFIRMED|SUCCEEDED|PAID/.test(text) ? 'ok' : /FAILED|MISMATCH|UNMATCHED|CANCEL|EXPIRED|MISSING/.test(text) ? 'danger' : 'warn';
    return `<span class="pill ${cls}">${esc(text)}</span>`;
  }
  function nextAction(row) {
    const bucket = group(row);
    if (bucket === 'exceptions') return 'Do not confirm. Resolve the payment exception first.';
    if (bucket === 'awaiting') return 'Await deposit startup or contact guest.';
    if (bucket === 'processing') return 'Wait for provider verification or review payment row.';
    if (bucket === 'verified') return 'Payment verified. Staff still reviews availability and guest details.';
    if (bucket === 'ready') return 'Ready for manual final confirmation.';
    return 'Confirmed/final operational row.';
  }
  function card(row, index) {
    const ref = field(row, ['booking_reference', 'reference', 'booking_code', 'code']);
    const guest = field(row, ['guest_name', 'name', 'full_name', 'guestName']);
    const stay = `${field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']) || '—'} → ${field(row, ['check_out', 'checkOut', 'departure_date', 'departureDate']) || '—'}`;
    return `<article class="confirmation-card"><div class="confirmation-card__top"><div><strong>${esc(ref)}</strong><span>${esc(guest)}</span></div><button class="r360-view" type="button" onclick="window.openReservation360(${index})">View 360</button></div><div class="confirmation-card__grid"><div><span>Stay</span>${esc(stay)}</div><div><span>Payment</span>${pill(payment(row))}</div><div><span>Verification</span>${pill(verification(row))}</div><div><span>Balance</span>${peso(field(row, ['balance_amount_php']))}</div><div><span>Status</span>${pill(booking(row))}</div></div><p>${esc(nextAction(row))}</p></article>`;
  }
  function ensureShell() {
    if (document.getElementById('confirmation-workflow')) return;
    const style = document.createElement('style');
    style.textContent = '.confirmation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.confirmation-column,.confirmation-card{border:1px solid rgba(229,224,216,.88);border-radius:20px;background:rgba(255,253,248,.82);box-shadow:var(--shadow);padding:16px;overflow-wrap:anywhere}.confirmation-list{display:grid;gap:10px}.confirmation-card__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.confirmation-card__top span{display:block;color:var(--muted);font-size:12px}.confirmation-card__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;color:var(--muted);font-size:12px}.confirmation-card__grid span{display:block;color:var(--brass);font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.confirmation-card p,.confirmation-policy{border-radius:12px;background:var(--sand);padding:10px;color:var(--muted);font-size:12px;line-height:1.45}.confirmation-policy{margin-bottom:14px;border:1px dashed rgba(184,151,126,.42)}@media(max-width:760px){.confirmation-grid,.confirmation-card__grid{grid-template-columns:1fr}.confirmation-card__top{display:grid}.confirmation-card__top .r360-view{width:100%}}';
    document.head.appendChild(style);
    const anchor = document.getElementById('today-lists') || document.getElementById('summary');
    if (!anchor) return;
    const section = document.createElement('section');
    section.id = 'confirmation-workflow';
    section.innerHTML = '<div class="section-head"><div><h2>Payment Review → Confirmation Workflow</h2><p>Review-first workflow. Saved status actions remain in the existing admin endpoint.</p></div><div class="section-actions"><button type="button" class="ghost" onclick="setMessage(\'Admin workflow only. No booking prices, public booking UI, PayPal, Xendit, or webhook logic changed.\')">Workflow safety</button></div></div><div class="confirmation-policy"><strong>Confirmation policy:</strong> VERIFIED payment can be finally confirmed only after staff review. Exceptions cannot be confirmed.</div><div class="confirmation-grid" id="confirmationWorkflowGrid"></div>';
    anchor.insertAdjacentElement('afterend', section);
  }
  function renderWorkflow(rows) {
    rowsCache = rows || [];
    ensureShell();
    const grid = document.getElementById('confirmationWorkflowGrid');
    if (!grid) return;
    const labels = { awaiting: ['Awaiting payment', 'No verified deposit yet.'], processing: ['Payment processing', 'Wait for verification.'], verified: ['Payment verified / availability review', 'Staff review needed.'], ready: ['Confirmation ready', 'Ready for final confirmation.'], confirmed: ['Confirmed reservations', 'Final rows.'], exceptions: ['Payment exceptions', 'Do not confirm.'] };
    const buckets = Object.fromEntries(Object.keys(labels).map((key) => [key, []]));
    rowsCache.forEach((row, index) => buckets[group(row)].push({ row, index }));
    grid.innerHTML = Object.entries(labels).map(([key, label]) => `<div class="confirmation-column"><h3>${esc(label[0])} · ${buckets[key].length}</h3><p>${esc(label[1])}</p><div class="confirmation-list">${buckets[key].length ? buckets[key].map((item) => card(item.row, item.index)).join('') : '<div class="empty-state">No matching loaded records.</div>'}</div></div>`).join('');
  }
  function decorateDrawer(row) {
    const body = document.getElementById('r360Body');
    if (!row || !body || body.querySelector('.r360-workflow-note')) return;
    const note = document.createElement('div');
    note.className = 'r360-workflow-note';
    note.innerHTML = `<strong>Confirmation workflow guidance</strong>${esc(nextAction(row))}`;
    body.prepend(note);
  }
  function loadGuestProfiles() {
    if (document.querySelector('script[data-guest-profile-360]')) return;
    const script = document.createElement('script');
    script.src = '/guest-profile-360.js';
    script.defer = true;
    script.setAttribute('data-guest-profile-360', 'true');
    document.body.appendChild(script);
  }
  const oldToday = window.renderTodayCommand;
  if (typeof oldToday === 'function') window.renderTodayCommand = function (rows, notifications) { const out = oldToday.apply(this, arguments); renderWorkflow(rows || []); return out; };
  const oldRows = window.renderRows;
  if (typeof oldRows === 'function') window.renderRows = function (rows) { const out = oldRows.apply(this, arguments); renderWorkflow(rows || []); return out; };
  const oldOpen = window.openReservation360;
  if (typeof oldOpen === 'function') window.openReservation360 = function (index) { const row = rowsCache[index]; const out = oldOpen.apply(this, arguments); setTimeout(() => decorateDrawer(row), 0); return out; };
  ensureShell();
  renderWorkflow(rowsCache);
  loadGuestProfiles();
  if (typeof window.loadData === 'function') window.loadData();
})();
