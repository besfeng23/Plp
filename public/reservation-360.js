(() => {
  const SECRET_FIELD_PATTERN = /(token|secret|key|password)/i;
  const peso = (value) => `₱${Number(value || 0).toLocaleString('en-PH')}`;
  const field = (row, names) => names.map((name) => row?.[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
  const text = (value) => value === undefined || value === null || value === '' ? '—' : String(value);
  const escapeHtml = (value) => text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function validDate(value) {
    if (!value) return null;
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function nights(row) {
    const start = validDate(field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']));
    const end = validDate(field(row, ['check_out', 'checkOut', 'departure_date', 'departureDate']));
    return start && end && end > start ? Math.round((end - start) / 86400000) : '—';
  }

  function stayBucket(row) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const checkIn = validDate(field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']));
    const checkOut = validDate(field(row, ['check_out', 'checkOut', 'departure_date', 'departureDate']));
    if (checkIn && checkIn > today) return 'Upcoming';
    if (checkIn && checkOut && checkIn <= today && today < checkOut) return 'In-house';
    if (checkOut && checkOut <= today) return 'Past';
    return 'Review booking record';
  }

  function nextAction(row) {
    const status = `${field(row, ['booking_status', 'status'])} ${field(row, ['payment_status', 'booking_payment_status'])} ${field(row, ['payment_verification_status'])}`.toUpperCase();
    const verificationError = field(row, ['verification_error', 'verification_note', 'verification_notes']);
    if (status.includes('CANCEL')) return 'No active stay — cancelled';
    if (verificationError || status.includes('FAILED') || status.includes('MISMATCH') || status.includes('UNMATCHED') || status.includes('REVIEW')) return 'Payment review needed';
    if (status.includes('VERIFIED') || status.includes('CONFIRMED') || status.includes('FULLY_PAID') || status.includes('SUCCEEDED')) return 'Prepare arrival / confirm guest details';
    if (status.includes('PENDING') || status.includes('AWAITING') || status.includes('PROCESSING')) return 'Await or review deposit';
    return 'Review booking record';
  }

  function maskSecrets(value) {
    if (Array.isArray(value)) return value.map(maskSecrets);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, SECRET_FIELD_PATTERN.test(key) ? '[masked]' : maskSecrets(child)]));
    }
    return value;
  }

  let currentRows = [];
  let currentRow = null;
  let currentTab = 'overview';

  function ensureDrawer() {
    if (document.getElementById('reservation360')) return;

    const style = document.createElement('style');
    style.textContent = `
      .r360-backdrop{position:fixed;inset:0;background:rgba(23,19,15,.46);backdrop-filter:blur(5px);z-index:80;display:none}.r360-backdrop.open{display:block}
      .r360{position:fixed;inset:0 0 0 auto;width:min(780px,100%);background:#FFFDF8;z-index:81;transform:translateX(100%);transition:transform .22s ease;box-shadow:-30px 0 80px rgba(23,19,15,.22);display:flex;flex-direction:column;max-width:100vw}.r360.open{transform:translateX(0)}
      .r360-head{position:sticky;top:0;background:#17130F;color:#F7F2EA;padding:22px;z-index:2}.r360-head .eyebrow{color:#B8977E;font-size:10px;letter-spacing:.24em;text-transform:uppercase}.r360-head h3{margin:8px 0 4px;font-size:clamp(24px,5vw,34px);font-weight:300;letter-spacing:-.05em;overflow-wrap:anywhere}.r360-head p{margin:0;color:#A9A096;overflow-wrap:anywhere}.r360-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.r360-close{min-height:42px;border:1px solid rgba(184,151,126,.45);background:#FFFDF8;color:#17130F;border-radius:999px;padding:8px 14px;font-weight:800}
      .r360-tabs{display:flex;gap:8px;padding:12px;overflow-x:auto;border-bottom:1px solid #E5E0D8;background:#F7F2EA;-webkit-overflow-scrolling:touch}.r360-tabs button{border-radius:999px;padding:9px 13px;font-size:12px;white-space:nowrap;border:1px solid #E5E0D8;background:#FFFDF8;color:#17130F}.r360-tabs button.active{background:#17130F;color:#F7F2EA;border-color:#17130F}
      .r360-body{padding:18px;overflow:auto;flex:1;min-width:0}.r360-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.r360-info{background:#F7F2EA;border:1px solid #E5E0D8;border-radius:16px;padding:15px;min-width:0}.r360-info span{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#6A645B}.r360-info strong{display:block;margin-top:8px;font-size:14px;color:#17130F;overflow-wrap:anywhere;word-break:break-word}.r360-note{border:1px dashed #D8CEC0;background:#FBFAF7;border-radius:16px;padding:15px;color:#6A645B;line-height:1.55}.r360-raw{background:#17130F;color:#F7F2EA;border-radius:16px;padding:16px;overflow:auto;font-size:12px;line-height:1.5;white-space:pre-wrap;max-height:58vh;overflow-wrap:anywhere}.r360-view{min-height:42px;border-radius:999px;border:1px solid #B8977E;background:#17130F;color:#F7F2EA;padding:8px 12px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
      @media(max-width:560px){.r360{inset:0;width:100%;border-radius:0}.r360-grid{grid-template-columns:1fr}.r360-head{padding:18px}.r360-body{padding:14px}.r360-tabs{padding-left:14px;padding-right:14px}.r360-close{padding:8px 12px}.r360-view{width:100%}}
    `;
    document.head.appendChild(style);

    const backdrop = document.createElement('div');
    backdrop.id = 'reservation360Backdrop';
    backdrop.className = 'r360-backdrop';
    backdrop.addEventListener('click', closeDrawer);
    document.body.appendChild(backdrop);

    const drawer = document.createElement('aside');
    drawer.id = 'reservation360';
    drawer.className = 'r360';
    drawer.setAttribute('aria-label', 'Reservation 360 detail drawer');
    drawer.innerHTML = `
      <div class="r360-head">
        <div class="r360-top">
          <div><div class="eyebrow">Reservation 360</div><h3 id="r360Ref">Reservation</h3><p id="r360Sub">Guest · Stay</p></div>
          <button id="r360Close" class="r360-close" type="button">Close</button>
        </div>
        <div id="r360Status" style="margin-top:14px"></div>
      </div>
      <div class="r360-tabs" role="tablist"><button data-r360="overview" class="active" type="button">Overview</button><button data-r360="guest" type="button">Guest</button><button data-r360="payment" type="button">Payment</button><button data-r360="stay" type="button">Stay</button><button data-r360="raw" type="button">Raw Record</button></div>
      <div id="r360Body" class="r360-body"></div>
    `;
    document.body.appendChild(drawer);
    drawer.querySelector('#r360Close').addEventListener('click', closeDrawer);
    drawer.querySelectorAll('[data-r360]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.r360, button)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDrawer();
    });
  }

  function pill(value) {
    const label = escapeHtml(value);
    const upper = String(value || '').toUpperCase();
    const cls = upper.includes('VERIFIED') || upper.includes('CONFIRMED') || upper.includes('SUCCEEDED') || upper.includes('PAID') ? 'ok' : upper.includes('FAILED') || upper.includes('MISMATCH') || upper.includes('UNMATCHED') || upper.includes('CANCEL') || upper.includes('EXPIRED') ? 'danger' : 'warn';
    return `<span class="pill ${cls}">${label}</span>`;
  }

  function info(label, value) {
    return `<div class="r360-info"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function grid(items, note = '') {
    return `${note ? `<div class="r360-note">${escapeHtml(note)}</div>` : ''}<div class="r360-grid">${items.map(([label, value]) => info(label, value)).join('')}</div>`;
  }

  function setTab(tab, button) {
    currentTab = tab;
    document.querySelectorAll('[data-r360]').forEach((node) => node.classList.remove('active'));
    button.classList.add('active');
    renderDrawer();
  }

  function openDrawer(index) {
    ensureDrawer();
    currentRow = currentRows[index];
    if (!currentRow) return;
    currentTab = 'overview';
    document.querySelectorAll('[data-r360]').forEach((button) => button.classList.toggle('active', button.dataset.r360 === 'overview'));
    const reference = field(currentRow, ['booking_reference', 'reference', 'booking_code', 'code']);
    const guestName = field(currentRow, ['guest_name', 'name', 'full_name', 'guestName']);
    const accommodation = field(currentRow, ['accommodation_name', 'accommodation', 'room_name', 'villa_name', 'room', 'villa']);
    document.getElementById('r360Ref').textContent = text(reference || 'Reservation');
    document.getElementById('r360Sub').textContent = `${text(guestName)} · ${text(accommodation)}`;
    document.getElementById('r360Status').innerHTML = `${pill(field(currentRow, ['booking_status', 'status']))} ${pill(field(currentRow, ['payment_verification_status']))}`;
    renderDrawer();
    document.getElementById('reservation360Backdrop').classList.add('open');
    document.getElementById('reservation360').classList.add('open');
  }

  function closeDrawer() {
    document.getElementById('reservation360Backdrop')?.classList.remove('open');
    document.getElementById('reservation360')?.classList.remove('open');
  }

  function renderDrawer() {
    if (!currentRow) return;
    const row = currentRow;
    const body = document.getElementById('r360Body');
    const checkIn = field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']);
    const checkOut = field(row, ['check_out', 'checkOut', 'departure_date', 'departureDate']);
    const requests = field(row, ['special_requests', 'notes', 'message', 'guest_notes', 'arrival_notes']);

    if (currentTab === 'raw') {
      body.innerHTML = '';
      const note = document.createElement('div');
      note.className = 'r360-note';
      note.textContent = 'Raw source record with obvious token/secret/key/password fields masked.';
      const pre = document.createElement('pre');
      pre.className = 'r360-raw';
      pre.textContent = JSON.stringify(maskSecrets(row), null, 2);
      body.appendChild(note);
      body.appendChild(pre);
      return;
    }

    const data = {
      overview: [
        ['Reference', field(row, ['booking_reference', 'reference', 'booking_code', 'code'])],
        ['Guest', field(row, ['guest_name', 'name', 'full_name', 'guestName'])],
        ['Booking status', field(row, ['booking_status', 'status'])],
        ['Payment verification', field(row, ['payment_verification_status'])],
        ['Stay', `${text(checkIn)} → ${text(checkOut)}`],
        ['Nights', nights(row)],
        ['Stay bucket', stayBucket(row)],
        ['Next action', nextAction(row)],
        ['Requests / notes', requests || 'No request captured'],
      ],
      guest: [
        ['Name', field(row, ['guest_name', 'name', 'full_name', 'guestName'])],
        ['Email', field(row, ['guest_email', 'email', 'guestEmail'])],
        ['Phone', field(row, ['guest_phone', 'phone', 'phone_number', 'whatsapp', 'guestPhone'])],
        ['Guest count', field(row, ['guest_count', 'guests', 'party_size'])],
      ],
      payment: [
        ['Provider', field(row, ['provider'])],
        ['Provider session ID', field(row, ['provider_session_id'])],
        ['Provider payment ID', field(row, ['provider_payment_id'])],
        ['Provider reference ID', field(row, ['provider_reference_id'])],
        ['Last webhook/event ID', field(row, ['last_webhook_id', 'provider_event_id'])],
        ['Total amount', peso(field(row, ['total_amount_php']))],
        ['Deposit amount', peso(field(row, ['deposit_amount_php']))],
        ['Payment amount', peso(field(row, ['payment_amount_php']))],
        ['Balance amount', peso(field(row, ['balance_amount_php']))],
        ['Payment status', field(row, ['payment_status'])],
        ['Booking payment status', field(row, ['booking_payment_status'])],
        ['Verification status', field(row, ['payment_verification_status'])],
        ['Verification note/error', field(row, ['verification_error', 'verification_note', 'verification_notes'])],
      ],
      stay: [
        ['Accommodation', field(row, ['accommodation_name', 'accommodation', 'room_name', 'villa_name', 'room', 'villa'])],
        ['Check-in', checkIn],
        ['Check-out', checkOut],
        ['Nights', nights(row)],
        ['Stay bucket', stayBucket(row)],
        ['Arrival notes', field(row, ['arrival_notes', 'special_requests', 'guest_notes'])],
      ],
    };
    body.innerHTML = currentTab === 'payment'
      ? grid(data.payment, 'For PayPal, success requires booking reference, stored PayPal order/session, amount, and currency to verify.')
      : grid(data[currentTab] || data.overview);
  }

  function enhanceReservationHeader() {
    const headerRow = document.querySelector('#reservations thead tr');
    if (!headerRow || headerRow.dataset.r360Enhanced) return;
    const th = document.createElement('th');
    th.textContent = '360';
    headerRow.appendChild(th);
    headerRow.dataset.r360Enhanced = 'true';
  }

  window.PLPReservation360 = Object.freeze({ open: openDrawer, close: closeDrawer, maskSecrets });
  window.openReservation360 = openDrawer;

  window.renderRows = function enhancedRows(rows) {
    currentRows = rows || [];
    enhanceReservationHeader();
    const body = document.getElementById('rowsBody');
    if (!body) return;
    if (!currentRows.length) {
      body.innerHTML = '<tr><td colspan="8" class="muted">No reservations yet.</td></tr>';
      return;
    }
    body.innerHTML = currentRows.map((row, index) => {
      const ref = field(row, ['booking_reference', 'reference', 'booking_code', 'code']);
      const guest = field(row, ['guest_name', 'name', 'full_name', 'guestName']);
      const email = field(row, ['guest_email', 'email', 'guestEmail']);
      const accommodation = field(row, ['accommodation_name', 'accommodation', 'room_name', 'villa_name', 'room', 'villa']);
      const checkIn = field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']);
      const checkOut = field(row, ['check_out', 'checkOut', 'departure_date', 'departureDate']);
      return `<tr><td><strong>${escapeHtml(ref)}</strong><br><span class="muted">${escapeHtml(row.provider || 'XENDIT')}</span></td><td>${escapeHtml(guest)}<br><span class="muted">${escapeHtml(email)}</span></td><td>${escapeHtml(accommodation)}<br><span class="muted">${escapeHtml(checkIn)} → ${escapeHtml(checkOut)}</span></td><td>Total: ${escapeHtml(peso(row.total_amount_php))}<br>Deposit: ${escapeHtml(peso(row.deposit_amount_php || row.payment_amount_php))}<br>Balance: ${escapeHtml(peso(row.balance_amount_php))}</td><td>${pill(field(row, ['booking_status', 'status']))}</td><td>${pill(field(row, ['payment_status', 'booking_payment_status']))}<br><span class="muted">${escapeHtml(row.provider_payment_id || row.provider_session_id || 'No provider ID yet')}</span></td><td>${pill(field(row, ['payment_verification_status']))}<br><span class="muted">${escapeHtml(field(row, ['verification_error', 'verification_note', 'verification_notes']))}</span></td><td><button class="r360-view" type="button" onclick="window.openReservation360(${index})">View 360</button></td></tr>`;
    }).join('');
  };

  ensureDrawer();
  enhanceReservationHeader();
  if (window.loadData) window.loadData();
})();
