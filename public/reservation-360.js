(() => {
  const peso = (value) => `₱${Number(value || 0).toLocaleString('en-PH')}`;
  const safe = (value) => value === undefined || value === null || value === '' ? '—' : String(value);
  const nights = (row) => {
    const start = new Date(`${row.check_in}T00:00:00Z`).getTime();
    const end = new Date(`${row.check_out}T00:00:00Z`).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.round((end - start) / 86400000) : '—';
  };

  let currentRows = [];
  let currentRow = null;
  let currentTab = 'overview';

  function ensureDrawer() {
    if (document.getElementById('reservation360')) return;
    const style = document.createElement('style');
    style.textContent = `
      .r360-backdrop{position:fixed;inset:0;background:rgba(23,19,15,.46);backdrop-filter:blur(5px);z-index:40;display:none}.r360-backdrop.open{display:block}
      .r360{position:fixed;inset:0 0 0 auto;width:min(760px,100%);background:#FFFDF8;z-index:41;transform:translateX(100%);transition:transform .22s ease;box-shadow:-30px 0 80px rgba(23,19,15,.22);display:flex;flex-direction:column}.r360.open{transform:translateX(0)}
      .r360-head{background:#17130F;color:#F7F2EA;padding:24px}.r360-head .eyebrow{color:#B8977E;font-size:10px;letter-spacing:.24em;text-transform:uppercase}.r360-head h3{margin:8px 0 4px;font-size:32px;font-weight:300;letter-spacing:-.05em}.r360-head p{margin:0;color:#A9A096}.r360-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
      .r360-tabs{display:flex;gap:8px;padding:12px;overflow-x:auto;border-bottom:1px solid #E5E0D8;background:#F7F2EA}.r360-tabs button{border-radius:999px;padding:8px 12px;font-size:12px;white-space:nowrap}.r360-tabs button.active{background:#17130F;color:#F7F2EA;border-color:#17130F}
      .r360-body{padding:20px;overflow:auto;flex:1}.r360-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.r360-info{background:#F7F2EA;border:1px solid #E5E0D8;border-radius:16px;padding:16px}.r360-info span{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#6A645B}.r360-info strong{display:block;margin-top:8px;font-size:14px;color:#17130F;overflow-wrap:anywhere}.r360-raw{background:#17130F;color:#F7F2EA;border-radius:16px;padding:16px;overflow:auto;font-size:12px;line-height:1.5;white-space:pre-wrap}
      @media(max-width:560px){.r360-grid{grid-template-columns:1fr}}
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
    drawer.innerHTML = `
      <div class="r360-head"><div class="r360-top"><div><div class="eyebrow">Reservation 360</div><h3 id="r360Ref">Reservation</h3><p id="r360Sub">Guest · Stay</p></div><button id="r360Close">Close</button></div><div id="r360Status" style="margin-top:14px"></div></div>
      <div class="r360-tabs"><button data-r360="overview" class="active">Overview</button><button data-r360="guest">Guest</button><button data-r360="payment">Payment</button><button data-r360="stay">Stay</button><button data-r360="raw">Raw Record</button></div>
      <div id="r360Body" class="r360-body"></div>
    `;
    document.body.appendChild(drawer);
    drawer.querySelector('#r360Close').addEventListener('click', closeDrawer);
    drawer.querySelectorAll('[data-r360]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.r360, button)));
  }

  function info(label, value) {
    return `<div class="r360-info"><span>${safe(label)}</span><strong>${safe(value)}</strong></div>`;
  }

  function grid(items) {
    return `<div class="r360-grid">${items.map(([label, value]) => info(label, value)).join('')}</div>`;
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
    currentTab = 'overview';
    document.querySelectorAll('[data-r360]').forEach((button) => button.classList.toggle('active', button.dataset.r360 === 'overview'));
    document.getElementById('r360Ref').textContent = safe(currentRow.booking_reference);
    document.getElementById('r360Sub').textContent = `${safe(currentRow.guest_name)} · ${safe(currentRow.accommodation_name)}`;
    document.getElementById('r360Status').innerHTML = `${window.pill ? window.pill(currentRow.booking_status) : safe(currentRow.booking_status)} ${window.pill ? window.pill(currentRow.payment_status || currentRow.booking_payment_status) : safe(currentRow.payment_status || currentRow.booking_payment_status)} ${window.pill ? window.pill(currentRow.payment_verification_status) : safe(currentRow.payment_verification_status)}`;
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
    if (currentTab === 'raw') {
      body.innerHTML = '';
      const pre = document.createElement('pre');
      pre.className = 'r360-raw';
      pre.textContent = JSON.stringify(row, null, 2);
      body.appendChild(pre);
      return;
    }
    const data = {
      overview: [['Reference', row.booking_reference], ['Status', row.booking_status], ['Villa', row.accommodation_name], ['Dates', `${safe(row.check_in)} → ${safe(row.check_out)}`], ['Nights', nights(row)], ['Source', row.source || row.provider || 'website'], ['Special requests', row.special_requests || row.message || 'No note']],
      guest: [['Name', row.guest_name], ['Email', row.guest_email], ['Phone', row.guest_phone || row.phone], ['Guest count', row.guest_count], ['High-touch', Number(row.total_amount_php || 0) >= 120000 || Number(nights(row)) >= 7 ? 'Yes' : 'No']],
      payment: [['Total', peso(row.total_amount_php)], ['Deposit', peso(row.deposit_amount_php || row.payment_amount_php)], ['Balance', peso(row.balance_amount_php)], ['Payment status', row.payment_status || row.booking_payment_status], ['Verification', row.payment_verification_status], ['Provider session', row.provider_session_id], ['Provider payment ID', row.provider_payment_id]],
      stay: [['Villa', row.accommodation_name], ['Check-in', row.check_in], ['Check-out', row.check_out], ['Nights', nights(row)], ['Booking status', row.booking_status], ['Arrival prep', 'Villa readiness, guest welcome, and payment review']],
    };
    body.innerHTML = grid(data[currentTab] || data.overview);
  }

  const originalRenderRows = window.renderRows;
  window.renderRows = function enhancedRows(rows) {
    currentRows = rows || [];
    const body = document.getElementById('rowsBody');
    if (!currentRows.length) {
      body.innerHTML = '<tr><td colspan="8" class="muted">No reservations yet.</td></tr>';
      return;
    }
    body.innerHTML = currentRows.map((row, index) => `<tr><td><strong>${safe(row.booking_reference)}</strong><br><span class="muted">${safe(row.provider || 'XENDIT')}</span></td><td>${safe(row.guest_name)}<br><span class="muted">${safe(row.guest_email || '')}</span></td><td>${safe(row.accommodation_name)}<br><span class="muted">${safe(row.check_in)} → ${safe(row.check_out)}</span></td><td>Total: ${peso(row.total_amount_php)}<br>Deposit: ${peso(row.deposit_amount_php || row.payment_amount_php)}<br>Balance: ${peso(row.balance_amount_php)}</td><td>${window.pill ? window.pill(row.booking_status) : safe(row.booking_status)}</td><td>${window.pill ? window.pill(row.payment_status || row.booking_payment_status) : safe(row.payment_status || row.booking_payment_status)}<br><span class="muted">${safe(row.provider_payment_id || row.provider_session_id || 'No provider ID yet')}</span></td><td>${window.pill ? window.pill(row.payment_verification_status) : safe(row.payment_verification_status)}<br><span class="muted">${safe(row.verification_error || '')}</span></td><td><button onclick="window.openReservation360(${index})">Open 360</button></td></tr>`).join('');
  };
  window.openReservation360 = openDrawer;
  ensureDrawer();
  if (window.loadData) window.loadData();
})();
