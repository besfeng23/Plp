(() => {
  let rowsCache = [];

  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const field = (row, names) => names.map((name) => row?.[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
  const norm = (value) => String(value || '').trim().toLowerCase();
  const status = (value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH')}`;
  const today = () => { const date = new Date(); date.setHours(0, 0, 0, 0); return date; };

  function dateOnly(value) {
    if (!value) return null;
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function daysUntil(value) {
    const date = dateOnly(value);
    if (!date) return null;
    return Math.round((date.getTime() - today().getTime()) / 86400000);
  }

  function guestName(row) {
    return field(row, ['guest_name', 'name', 'full_name', 'guestName']) || 'Unnamed guest';
  }

  function guestEmail(row) {
    return field(row, ['guest_email', 'email', 'guestEmail', 'normalized_email']);
  }

  function guestPhone(row) {
    return field(row, ['guest_phone', 'phone', 'mobile', 'whatsapp', 'guestPhone']);
  }

  function guestKey(row) {
    return norm(guestEmail(row)) || norm(guestPhone(row)) || norm(guestName(row));
  }

  function accommodation(row) {
    return field(row, ['accommodation_name', 'accommodation', 'room_name', 'villa_name', 'room', 'villa']) || 'Unassigned accommodation';
  }

  function bookingRef(row) {
    return field(row, ['booking_reference', 'reference', 'booking_code', 'code']);
  }

  function notes(row) {
    return field(row, ['special_requests', 'notes', 'message', 'guest_notes', 'arrival_notes']);
  }

  function hasPaymentException(row) {
    const text = `${status(field(row, ['booking_status', 'status']))} ${status(field(row, ['payment_status', 'booking_payment_status']))} ${status(field(row, ['payment_verification_status', 'verification_status']))} ${status(field(row, ['verification_error', 'verification_note', 'verification_notes']))}`;
    return /FAILED|MISMATCH|UNMATCHED|ORDER_ID|DATABASE_UNCONFIGURED|AMOUNT_MISMATCH|CURRENCY_MISMATCH|CAPTURE_NOT_COMPLETED/.test(text) || Boolean(field(row, ['verification_error', 'verification_note', 'verification_notes']));
  }

  function needsPaymentReview(row) {
    const verification = status(field(row, ['payment_verification_status', 'verification_status']));
    const payment = status(field(row, ['payment_status', 'booking_payment_status']));
    const booking = status(field(row, ['booking_status', 'status']));
    return verification !== 'VERIFIED' || /PENDING|PROCESSING|AWAITING|REVIEW/.test(`${payment} ${booking}`) || hasPaymentException(row);
  }

  function buildProfiles(rows) {
    const map = new Map();
    (rows || []).forEach((row, originalIndex) => {
      const key = guestKey(row) || `row-${originalIndex}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: guestName(row),
          email: guestEmail(row),
          phone: guestPhone(row),
          rows: [],
          indices: [],
          total: 0,
          balance: 0,
          deposits: 0,
          accommodations: new Map(),
          notes: [],
          flags: new Set(),
        });
      }
      const profile = map.get(key);
      profile.rows.push(row);
      profile.indices.push(originalIndex);
      profile.total += Number(field(row, ['total_amount_php']) || 0);
      profile.balance += Number(field(row, ['balance_amount_php']) || 0);
      profile.deposits += Number(field(row, ['deposit_amount_php', 'payment_amount_php', 'expected_amount_php']) || 0);
      const room = accommodation(row);
      profile.accommodations.set(room, (profile.accommodations.get(room) || 0) + 1);
      const note = notes(row);
      if (note) profile.notes.push(String(note).slice(0, 180));
      if (!profile.email) profile.flags.add('Missing email');
      if (!profile.phone) profile.flags.add('Missing phone');
      if (profile.rows.length > 1) profile.flags.add('Repeat guest');
      if (hasPaymentException(row)) profile.flags.add('Payment exception');
      if (needsPaymentReview(row)) profile.flags.add('Payment review');
      if (Number(field(row, ['balance_amount_php']) || 0) > 0) profile.flags.add('Balance due');
      const arrivalIn = daysUntil(field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']));
      if (arrivalIn !== null && arrivalIn >= 0 && arrivalIn <= 7) profile.flags.add('Arriving soon');
    });
    return Array.from(map.values()).sort((a, b) => {
      const aAttention = Number(a.flags.has('Payment exception')) * 4 + Number(a.flags.has('Arriving soon')) * 3 + Number(a.flags.has('Payment review')) * 2 + Number(a.flags.has('Balance due'));
      const bAttention = Number(b.flags.has('Payment exception')) * 4 + Number(b.flags.has('Arriving soon')) * 3 + Number(b.flags.has('Payment review')) * 2 + Number(b.flags.has('Balance due'));
      return bAttention - aAttention || b.rows.length - a.rows.length || a.name.localeCompare(b.name);
    });
  }

  function pill(text) {
    const normalized = status(text);
    const cls = /EXCEPTION|MISSING|REVIEW|BALANCE/.test(normalized) ? 'danger' : /ARRIVING|REPEAT/.test(normalized) ? 'warn' : 'ok';
    return `<span class="pill ${cls}">${esc(text)}</span>`;
  }

  function preferredRoom(profile) {
    return Array.from(profile.accommodations.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  }

  function latestIndex(profile) {
    let best = profile.indices[0] || 0;
    let bestTime = -Infinity;
    profile.rows.forEach((row, i) => {
      const time = dateOnly(field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']))?.getTime() || 0;
      if (time >= bestTime) {
        bestTime = time;
        best = profile.indices[i];
      }
    });
    return best;
  }

  function profileCard(profile) {
    const firstNote = profile.notes[0] || 'No saved request text in loaded rows.';
    const flags = Array.from(profile.flags);
    return `<article class="guest-profile-card"><div class="guest-profile-card__top"><div><strong>${esc(profile.name)}</strong><span>${esc(profile.email || profile.phone || 'No contact captured')}</span></div><button type="button" class="r360-view" onclick="window.openReservation360(${latestIndex(profile)})">Open latest 360</button></div><div class="guest-profile-grid"><div><span>Bookings</span>${profile.rows.length}</div><div><span>Preferred stay</span>${esc(preferredRoom(profile))}</div><div><span>Total value</span>${money(profile.total)}</div><div><span>Balance</span>${money(profile.balance)}</div><div><span>Deposit basis</span>${money(profile.deposits)}</div><div><span>Contact</span>${esc(profile.email || '—')}<br>${esc(profile.phone || '—')}</div></div><div class="guest-flags">${flags.length ? flags.map(pill).join('') : pill('No attention flag')}</div><p>${esc(firstNote)}</p></article>`;
  }

  function ensureShell() {
    if (document.getElementById('guest-profile-360')) return;
    const style = document.createElement('style');
    style.textContent = '.guest-profile-grid-wrap{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.guest-profile-card{border:1px solid rgba(229,224,216,.88);border-radius:20px;background:rgba(255,253,248,.82);box-shadow:var(--shadow);padding:16px;overflow-wrap:anywhere}.guest-profile-card__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.guest-profile-card__top strong{display:block;color:var(--teak)}.guest-profile-card__top span{display:block;margin-top:3px;color:var(--muted);font-size:12px}.guest-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;color:var(--muted);font-size:12px}.guest-profile-grid span{display:block;color:var(--brass);font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.guest-flags{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.guest-profile-card p,.guest-profile-note{border-radius:12px;background:var(--sand);padding:10px;color:var(--muted);font-size:12px;line-height:1.45}.guest-profile-note{margin-bottom:14px;border:1px dashed rgba(184,151,126,.42)}.r360-guest-note{margin-bottom:12px;border:1px solid rgba(184,151,126,.35);background:rgba(255,253,248,.78);border-radius:16px;padding:14px;color:#6A645B;line-height:1.5}.r360-guest-note strong{display:block;color:#17130F;margin-bottom:6px}@media(max-width:1100px){.guest-profile-grid-wrap{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.guest-profile-grid-wrap,.guest-profile-grid{grid-template-columns:1fr}.guest-profile-card__top{display:grid}.guest-profile-card__top .r360-view{width:100%}}';
    document.head.appendChild(style);
    const anchor = document.getElementById('confirmation-workflow') || document.getElementById('today-lists') || document.getElementById('summary');
    if (!anchor) return;
    const section = document.createElement('section');
    section.id = 'guest-profile-360';
    section.innerHTML = '<div class="section-head"><div><h2>Guest Profile 360</h2><p>Guest summaries derived from loaded reservation rows only: history, preferences, balances, requests, and attention flags.</p></div><div class="section-actions"><button type="button" class="ghost" onclick="setMessage(\'Guest Profile 360 is read-only in this phase. It does not save guest notes, memories, or tasks.\')">Profile safety</button></div></div><div class="guest-profile-note"><strong>Read-only profile layer:</strong> These cards group existing admin rows by guest contact. They do not create or modify guest records.</div><div class="guest-profile-grid-wrap" id="guestProfileGrid"></div>';
    anchor.insertAdjacentElement('afterend', section);
  }

  function renderProfiles(rows) {
    rowsCache = rows || [];
    ensureShell();
    const grid = document.getElementById('guestProfileGrid');
    if (!grid) return;
    const profiles = buildProfiles(rowsCache);
    grid.innerHTML = profiles.length ? profiles.map(profileCard).join('') : '<div class="empty-state">No guest profiles available from loaded records.</div>';
    window.plpGuestProfiles = profiles;
  }

  function profileForRow(row) {
    const key = guestKey(row);
    return buildProfiles(rowsCache).find((profile) => profile.key === key);
  }

  function decorateDrawer(row) {
    const body = document.getElementById('r360Body');
    if (!row || !body || body.querySelector('.r360-guest-note')) return;
    const profile = profileForRow(row);
    if (!profile) return;
    const note = document.createElement('div');
    note.className = 'r360-guest-note';
    const flags = Array.from(profile.flags);
    note.innerHTML = `<strong>Guest Profile 360</strong>${esc(profile.name)} · ${profile.rows.length} loaded booking${profile.rows.length === 1 ? '' : 's'}<br>Preferred stay: ${esc(preferredRoom(profile))}<br>Total loaded value: ${money(profile.total)} · Balance: ${money(profile.balance)}<br>${flags.length ? flags.map(pill).join(' ') : pill('No attention flag')}`;
    body.prepend(note);
  }

  const oldToday = window.renderTodayCommand;
  if (typeof oldToday === 'function') window.renderTodayCommand = function (rows, notifications) { const out = oldToday.apply(this, arguments); renderProfiles(rows || []); return out; };

  const oldRows = window.renderRows;
  if (typeof oldRows === 'function') window.renderRows = function (rows) { const out = oldRows.apply(this, arguments); renderProfiles(rows || []); return out; };

  const oldOpen = window.openReservation360;
  if (typeof oldOpen === 'function') window.openReservation360 = function (index) { const row = rowsCache[index]; const out = oldOpen.apply(this, arguments); setTimeout(() => decorateDrawer(row), 0); return out; };

  ensureShell();
  renderProfiles(rowsCache);
})();
