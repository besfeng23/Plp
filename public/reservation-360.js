(() => {
  const FIELD_GROUPS = {
    reference: ['booking_reference', 'reference', 'booking_code', 'code'],
    guestName: ['guest_name', 'name', 'full_name', 'guestName'],
    guestEmail: ['guest_email', 'email', 'guestEmail'],
    guestPhone: ['guest_phone', 'phone', 'phone_number', 'whatsapp', 'guestPhone'],
    guestCount: ['guest_count', 'guests', 'party_size'],
    accommodation: ['accommodation_name', 'accommodation', 'room_name', 'villa_name', 'room', 'villa'],
    checkIn: ['check_in', 'checkIn', 'arrival_date', 'arrivalDate'],
    checkOut: ['check_out', 'checkOut', 'departure_date', 'departureDate'],
    requests: ['special_requests', 'notes', 'message', 'guest_notes', 'arrival_notes'],
  };
  const SECRET_RE = /(token|secret|key|password)/i;
  const safe = (value) => value === undefined || value === null || value === '' ? '—' : String(value);
  const escapeHtml = (value) => safe(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH')}`;
  const first = (row, fields) => fields.map((field) => row?.[field]).find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
  const statusText = (value) => String(value || '').toUpperCase();
  const pill = (value) => {
    const label = safe(value);
    const text = statusText(label);
    const cls = text.includes('SENT') || text.includes('VERIFIED') || text.includes('CONFIRMED') || text.includes('SUCCEEDED') || text.includes('CAPTURED') || text.includes('SYNCED') ? 'ok' : text.includes('FAILED') || text.includes('MISMATCH') || text.includes('UNMATCHED') || text.includes('CANCELLED') || text.includes('EXPIRED') || text.includes('CONFLICT') ? 'danger' : 'warn';
    return `<span class="pill ${cls}">${escapeHtml(label)}</span>`;
  };
  const dateOnly = (value) => {
    if (!value) return null;
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const nights = (row) => {
    const start = dateOnly(first(row, FIELD_GROUPS.checkIn));
    const end = dateOnly(first(row, FIELD_GROUPS.checkOut));
    return start && end && end > start ? Math.round((end - start) / 86400000) : '';
  };
  const stayBucket = (row) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = dateOnly(first(row, FIELD_GROUPS.checkIn));
    const end = dateOnly(first(row, FIELD_GROUPS.checkOut));
    if (start && start > today) return 'Upcoming';
    if (start && end && start <= today && today <= end) return 'In-house';
    if (end && end < today) return 'Past';
    return 'Unknown';
  };
  const nextAction = (row) => {
    const booking = statusText(row.booking_status || row.status);
    const payment = statusText(row.payment_status || row.booking_payment_status);
    const verification = statusText(row.payment_verification_status);
    if (booking.includes('CANCEL')) return 'No active stay — cancelled';
    if (row.verification_error || statusText(row.verification_note || row.verification_notes).includes('ERROR') || verification.includes('MISMATCH') || verification.includes('UNMATCHED') || verification.includes('FAILED')) return 'Payment review needed';
    if (verification.includes('VERIFIED') || booking.includes('CONFIRMED') || payment.includes('PAID')) return 'Prepare arrival / confirm guest details';
    if (!verification || verification === '—' || verification.includes('PENDING') || payment.includes('PENDING') || payment.includes('AWAIT')) return 'Await or review deposit';
    return 'Review booking record';
  };
  const maskSecrets = (value) => {
    if (Array.isArray(value)) return value.map(maskSecrets);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, SECRET_RE.test(key) ? '•••• MASKED ••••' : maskSecrets(val)]));
    return value;
  };

  let rows = [];
  let selected = null;

  function ensureDrawer() {
    if (document.getElementById('reservation360')) return;
    const style = document.createElement('style');
    style.textContent = `
      .r360-backdrop{position:fixed;inset:0;background:rgba(23,19,15,.5);backdrop-filter:blur(4px);z-index:9998;display:none}.r360-backdrop.open{display:block}
      .r360{position:fixed;inset:0 0 0 auto;width:min(760px,100vw);max-width:100vw;background:#FFFDF8;z-index:9999;transform:translateX(102%);transition:transform .22s ease;box-shadow:-30px 0 80px rgba(23,19,15,.24);display:flex;flex-direction:column;overflow:hidden}.r360.open{transform:translateX(0)}
      .r360-head{position:sticky;top:0;z-index:1;background:#17130F;color:#F7F2EA;padding:20px}.r360-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.r360-eyebrow{color:#B8977E;font-size:10px;letter-spacing:.24em;text-transform:uppercase}.r360-title{margin:6px 0 4px;font-size:clamp(24px,5vw,34px);font-weight:300;letter-spacing:-.05em;overflow-wrap:anywhere}.r360-sub{margin:0;color:#A9A096;overflow-wrap:anywhere}.r360-close{min-height:44px;min-width:44px;background:#FFFDF8;color:#17130F;border-color:#FFFDF8}.r360-status{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.r360-body{padding:18px;overflow:auto;flex:1;min-width:0}.r360-section{margin:0 0 16px}.r360-section h4{margin:0 0 10px;color:#B8977E;font-size:11px;letter-spacing:.18em;text-transform:uppercase}.r360-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.r360-info{min-width:0;background:#F7F2EA;border:1px solid #E5E0D8;border-radius:14px;padding:13px}.r360-info span{display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#6A645B}.r360-info strong{display:block;margin-top:7px;color:#17130F;overflow-wrap:anywhere;word-break:break-word}.r360-next{border-radius:16px;border:1px solid #D8CEC0;background:#FBFAF7;padding:14px;color:#17130F}.r360-note{font-size:12px;color:#6A645B}.r360-raw{background:#17130F;color:#F7F2EA;border-radius:14px;padding:14px;overflow:auto;max-height:42vh;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word}.r360-row{cursor:pointer}.r360-action{min-height:44px;white-space:nowrap}.r360-actions-cell{min-width:118px}
      @media(max-width:640px){.r360{inset:0;width:100vw}.r360-head{padding:16px}.r360-body{padding:14px}.r360-grid{grid-template-columns:1fr}.r360-top{align-items:center}.r360-status .pill{white-space:normal}.r360-action{width:100%;padding:12px 14px}.r360-actions-cell{min-width:130px}}
    `;
    document.head.appendChild(style);
    const backdrop = document.createElement('div');
    backdrop.id = 'reservation360Backdrop';
    backdrop.className = 'r360-backdrop';
    backdrop.addEventListener('click', closeReservation360);
    document.body.appendChild(backdrop);
    const drawer = document.createElement('aside');
    drawer.id = 'reservation360';
    drawer.className = 'r360';
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('role', 'dialog');
    document.body.appendChild(drawer);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeReservation360(); });
  }
  const info = (label, value) => `<div class="r360-info"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  const section = (title, items) => `<section class="r360-section"><h4>${escapeHtml(title)}</h4><div class="r360-grid">${items.map(([l, v]) => info(l, v)).join('')}</div></section>`;
  function renderDrawer() {
    if (!selected) return;
    const ref = first(selected, FIELD_GROUPS.reference);
    const guestName = first(selected, FIELD_GROUPS.guestName);
    const raw = JSON.stringify(maskSecrets(selected), null, 2);
    document.getElementById('reservation360').innerHTML = `<div class="r360-head"><div class="r360-top"><div><div class="r360-eyebrow">Reservation 360</div><h3 class="r360-title">${escapeHtml(ref || 'Reservation')}</h3><p class="r360-sub">${escapeHtml(guestName || 'Guest')} · ${escapeHtml(first(selected, FIELD_GROUPS.accommodation) || 'Stay details')}</p></div><button class="r360-close" type="button" aria-label="Close Reservation 360">Close</button></div><div class="r360-status">${pill(selected.booking_status || selected.status)}${pill(selected.payment_verification_status)}${pill(selected.payment_status || selected.booking_payment_status)}</div></div><div class="r360-body"><div class="r360-next"><strong>Next action:</strong> ${escapeHtml(nextAction(selected))}<p class="r360-note">Derived from existing booking and payment fields only. Internal notes persistence is not enabled yet.</p></div>${section('Guest', [['Name', guestName], ['Email', first(selected, FIELD_GROUPS.guestEmail)], ['Phone / WhatsApp', first(selected, FIELD_GROUPS.guestPhone)], ['Guest count', first(selected, FIELD_GROUPS.guestCount)]])}${section('Stay', [['Accommodation', first(selected, FIELD_GROUPS.accommodation)], ['Check-in', first(selected, FIELD_GROUPS.checkIn)], ['Check-out', first(selected, FIELD_GROUPS.checkOut)], ['Nights', nights(selected)], ['Stay bucket', stayBucket(selected)]])}${section('Payment', [['Total amount PHP', money(selected.total_amount_php)], ['Deposit amount PHP', money(selected.deposit_amount_php)], ['Payment amount PHP', money(selected.payment_amount_php)], ['Balance amount PHP', money(selected.balance_amount_php)], ['Payment status', selected.payment_status], ['Booking payment status', selected.booking_payment_status], ['Verification status', selected.payment_verification_status], ['Verification error', selected.verification_error], ['Verification note(s)', selected.verification_note || selected.verification_notes], ['Provider', selected.provider], ['Provider payment ID', selected.provider_payment_id], ['Provider session ID', selected.provider_session_id], ['Provider event ID', selected.provider_event_id], ['Provider reference ID', selected.provider_reference_id]])}${section('Guest requests / notes', [['Special requests', selected.special_requests], ['Notes', selected.notes], ['Message', selected.message], ['Guest notes', selected.guest_notes], ['Arrival notes', selected.arrival_notes], ['Detected note', first(selected, FIELD_GROUPS.requests)]])}<section class="r360-section"><details open><summary><strong>Raw record</strong></summary><pre class="r360-raw">${escapeHtml(raw)}</pre></details></section></div>`;
    document.querySelector('#reservation360 .r360-close').addEventListener('click', closeReservation360);
  }
  function openReservation360(rowOrIndex) {
    ensureDrawer();
    selected = typeof rowOrIndex === 'number' ? rows[rowOrIndex] : rowOrIndex;
    if (!selected) return;
    renderDrawer();
    document.getElementById('reservation360Backdrop').classList.add('open');
    document.getElementById('reservation360').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeReservation360() {
    document.getElementById('reservation360Backdrop')?.classList.remove('open');
    document.getElementById('reservation360')?.classList.remove('open');
    document.body.style.overflow = '';
  }
  function renderRows(nextRows) {
    rows = nextRows || [];
    const body = document.getElementById('rowsBody');
    if (!body) return;
    if (!rows.length) { body.innerHTML = '<tr><td colspan="8" class="muted">No reservations yet.</td></tr>'; return; }
    body.innerHTML = rows.map((row, index) => `<tr class="r360-row" data-r360-index="${index}" tabindex="0"><td><strong>${escapeHtml(first(row, FIELD_GROUPS.reference))}</strong><br><span class="muted">${escapeHtml(row.provider || 'XENDIT')}</span></td><td>${escapeHtml(first(row, FIELD_GROUPS.guestName))}<br><span class="muted">${escapeHtml(first(row, FIELD_GROUPS.guestEmail))}</span></td><td>${escapeHtml(first(row, FIELD_GROUPS.accommodation))}<br><span class="muted">${escapeHtml(first(row, FIELD_GROUPS.checkIn))} → ${escapeHtml(first(row, FIELD_GROUPS.checkOut))}</span></td><td>Total: ${escapeHtml(money(row.total_amount_php))}<br>Deposit: ${escapeHtml(money(row.deposit_amount_php || row.payment_amount_php))}<br>Balance: ${escapeHtml(money(row.balance_amount_php))}</td><td>${pill(row.booking_status || row.status)}</td><td>${pill(row.payment_status || row.booking_payment_status)}<br><span class="muted">${escapeHtml(row.provider_payment_id || row.provider_session_id || 'No provider ID yet')}</span></td><td>${pill(row.payment_verification_status)}<br><span class="muted">${escapeHtml(row.verification_error || row.verification_note || '')}</span></td><td class="r360-actions-cell"><button type="button" class="r360-action" data-r360-action="${index}">View 360</button></td></tr>`).join('');
    body.querySelectorAll('[data-r360-action]').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); openReservation360(Number(button.dataset.r360Action)); }));
    body.querySelectorAll('[data-r360-index]').forEach((row) => {
      row.addEventListener('click', () => openReservation360(Number(row.dataset.r360Index)));
      row.addEventListener('keydown', (event) => { if (event.key === 'Enter') openReservation360(Number(row.dataset.r360Index)); });
    });
  }
  window.PLPReservation360 = { openReservation360, closeReservation360, renderRows, maskSecrets };
  window.openReservation360 = openReservation360;
  window.closeReservation360 = closeReservation360;
  window.renderRows = renderRows;
  ensureDrawer();
  if (window.loadData) window.loadData();
})();
