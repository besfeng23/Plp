(() => {
  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const field = (row, names) => names.map((name) => row?.[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
  const ref = (row) => field(row, ['booking_reference', 'reference', 'booking_code', 'code']);
  const guest = (row) => field(row, ['guest_name', 'name', 'full_name', 'guestName']) || 'Unnamed guest';
  const room = (row) => field(row, ['accommodation_name', 'accommodation', 'room_name', 'villa_name', 'room', 'villa']) || 'Unassigned';
  const arrive = (row) => field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']) || '—';
  const depart = (row) => field(row, ['check_out', 'checkOut', 'departure_date', 'departureDate']) || '—';
  const headers = () => ({ ...(typeof window.headers === 'function' ? window.headers() : {}), 'Content-Type': 'application/json' });

  function items() {
    return Array.isArray(window.plpHousekeepingReadiness) ? window.plpHousekeepingReadiness : [];
  }

  function itemTitle(item, status) {
    const label = item?.info?.label || 'Housekeeping readiness';
    return `${label}: ${status.replace(/_/g, ' ')}`;
  }

  function itemNote(item, status) {
    const row = item.row;
    return `Housekeeping status: ${status.replace(/_/g, ' ')}\nRoom: ${room(row)}\nGuest: ${guest(row)}\nStay: ${arrive(row)} to ${depart(row)}\nDerived readiness: ${item.info?.label || 'Readiness review'}`;
  }

  function ensureShell() {
    if (document.getElementById('housekeeping-status-actions')) return;
    const style = document.createElement('style');
    style.textContent = '.hk-status-panel{border:1px solid rgba(229,224,216,.88);border-radius:20px;background:rgba(255,253,248,.82);box-shadow:var(--shadow);padding:16px}.hk-status-panel label{display:grid;gap:6px;color:var(--brass);font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.hk-status-panel select{width:100%;border:1px solid var(--linen);border-radius:12px;background:#FFFDF8;color:var(--teak);padding:10px;margin-bottom:10px}.hk-status-panel p{border-radius:12px;background:var(--sand);padding:10px;color:var(--muted);font-size:12px;line-height:1.45}.hk-status-actions{display:flex;gap:8px;flex-wrap:wrap}.hk-status-actions button{min-height:36px}@media(max-width:720px){.hk-status-actions button{width:100%}}';
    document.head.appendChild(style);
    const anchor = document.getElementById('staff-tasks-panel') || document.getElementById('housekeeping-readiness');
    if (!anchor) return;
    const section = document.createElement('section');
    section.id = 'housekeeping-status-actions';
    section.innerHTML = '<div class="section-head"><div><h2>Housekeeping Status Actions</h2><p>Save housekeeping readiness as real staff-task status worklog entries.</p></div><div class="section-actions"><button type="button" onclick="window.refreshHousekeepingStatusActions()">Refresh choices</button></div></div><div class="hk-status-panel"><label>Housekeeping item<select id="housekeepingStatusChoice"></select></label><p id="housekeepingStatusPreview">No housekeeping readiness item selected.</p><div class="hk-status-actions"><button type="button" data-hk-status="dirty">Mark dirty</button><button type="button" data-hk-status="inspecting">Mark inspecting</button><button type="button" data-hk-status="ready">Mark ready</button><button type="button" data-hk-status="blocked">Mark blocked</button></div></div>';
    anchor.insertAdjacentElement('afterend', section);
  }

  function renderChoices() {
    ensureShell();
    const select = document.getElementById('housekeepingStatusChoice');
    const preview = document.getElementById('housekeepingStatusPreview');
    if (!select || !preview) return;
    const list = items();
    select.innerHTML = list.length ? list.map((item, index) => `<option value="${index}">${esc(item.info?.label || 'Readiness')} · ${esc(room(item.row))} · ${esc(ref(item.row))}</option>`).join('') : '<option value="">No housekeeping readiness items</option>';
    const item = list[Number(select.value || 0)];
    preview.innerHTML = item ? `${esc(item.info?.label || 'Readiness')}<br>${esc(guest(item.row))} · ${esc(room(item.row))} · ${esc(arrive(item.row))} → ${esc(depart(item.row))}` : 'No housekeeping readiness item selected.';
  }

  async function saveStatus(status) {
    const list = items();
    const select = document.getElementById('housekeepingStatusChoice');
    const item = list[Number(select?.value || 0)];
    if (!item || !ref(item.row)) return;
    const response = await fetch('/api/admin?action=staff-task', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        reference: ref(item.row),
        kind: 'task',
        category: 'housekeeping',
        priority: status === 'ready' ? 'normal' : 'high',
        title: itemTitle(item, status),
        note: itemNote(item, status)
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || data?.detail || 'Unable to save housekeeping status task.');
    if (typeof window.setMessage === 'function') window.setMessage(`Housekeeping ${status.replace(/_/g, ' ')} saved to staff tasks.`);
    if (typeof window.refreshStaffTasks === 'function') await window.refreshStaffTasks();
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'housekeepingStatusChoice') renderChoices();
  });
  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('[data-hk-status]');
    if (!button) return;
    try { await saveStatus(button.dataset.hkStatus); } catch (error) { if (typeof window.setMessage === 'function') window.setMessage(error.message, 'error'); }
  });

  window.refreshHousekeepingStatusActions = renderChoices;
  ensureShell();
  renderChoices();
})();
