(() => {
  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const field = (row, names) => names.map((name) => row?.[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
  const ref = (row) => field(row, ['booking_reference', 'reference', 'booking_code', 'code']);
  const guest = (row) => field(row, ['guest_name', 'name', 'full_name', 'guestName']) || 'Unnamed guest';
  const room = (row) => field(row, ['accommodation_name', 'accommodation', 'room_name', 'villa_name', 'room', 'villa']) || 'Unassigned';
  const arrive = (row) => field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']) || '—';
  const depart = (row) => field(row, ['check_out', 'checkOut', 'departure_date', 'departureDate']) || '—';
  const headers = () => ({ ...(typeof window.headers === 'function' ? window.headers() : {}), 'Content-Type': 'application/json' });

  function mappedCategory(task) {
    if (task.category === 'Arriving Soon') return 'arrival';
    if (task.category === 'Follow-up') return 'payment';
    return 'concierge';
  }

  function mappedPriority(task) {
    return String(task.priority || 'normal').toLowerCase();
  }

  function tasks() {
    return Array.isArray(window.plpConciergeQueue) ? window.plpConciergeQueue : [];
  }

  function ensureShell() {
    if (document.getElementById('concierge-task-actions')) return;
    const style = document.createElement('style');
    style.textContent = '.concierge-save-panel{border:1px solid rgba(229,224,216,.88);border-radius:20px;background:rgba(255,253,248,.82);box-shadow:var(--shadow);padding:16px}.concierge-save-panel label{display:grid;gap:6px;color:var(--brass);font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.concierge-save-panel select{width:100%;border:1px solid var(--linen);border-radius:12px;background:#FFFDF8;color:var(--teak);padding:10px;margin-bottom:10px}.concierge-save-panel p{border-radius:12px;background:var(--sand);padding:10px;color:var(--muted);font-size:12px;line-height:1.45}';
    document.head.appendChild(style);
    const anchor = document.getElementById('staff-tasks-panel') || document.getElementById('concierge-queue');
    if (!anchor) return;
    const section = document.createElement('section');
    section.id = 'concierge-task-actions';
    section.innerHTML = '<div class="section-head"><div><h2>Concierge Task Actions</h2><p>Save a derived concierge queue item into the persisted staff task worklog.</p></div><div class="section-actions"><button type="button" onclick="window.refreshConciergeTaskActions()">Refresh queue choices</button></div></div><div class="concierge-save-panel"><label>Queue item<select id="conciergeTaskChoice"></select></label><p id="conciergeTaskPreview">No concierge queue item selected.</p><button type="button" id="saveConciergeTaskButton">Save selected as staff task</button></div>';
    anchor.insertAdjacentElement('afterend', section);
  }

  function renderChoices() {
    ensureShell();
    const select = document.getElementById('conciergeTaskChoice');
    const preview = document.getElementById('conciergeTaskPreview');
    if (!select || !preview) return;
    const list = tasks();
    select.innerHTML = list.length ? list.map((task, index) => `<option value="${index}">${esc(task.category)} · ${esc(task.source)} · ${esc(ref(task.row))}</option>`).join('') : '<option value="">No derived concierge queue items</option>';
    const task = list[Number(select.value || 0)];
    preview.innerHTML = task ? `${esc(task.title)}<br>${esc(guest(task.row))} · ${esc(room(task.row))} · ${esc(arrive(task.row))} → ${esc(depart(task.row))}` : 'No concierge queue item selected.';
  }

  async function saveSelected() {
    const list = tasks();
    const select = document.getElementById('conciergeTaskChoice');
    const task = list[Number(select?.value || 0)];
    if (!task || !ref(task.row)) return;
    const response = await fetch('/api/admin?action=staff-task', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        reference: ref(task.row),
        kind: 'task',
        category: mappedCategory(task),
        priority: mappedPriority(task),
        title: `${task.category}: ${task.source}`,
        note: `${task.title}\nGuest: ${guest(task.row)}\nStay: ${arrive(task.row)} to ${depart(task.row)}\nRoom: ${room(task.row)}`
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || data?.detail || 'Unable to save concierge task.');
    if (typeof window.setMessage === 'function') window.setMessage('Concierge item saved as staff task.');
    if (typeof window.refreshStaffTasks === 'function') await window.refreshStaffTasks();
  }

  function loadHousekeepingStatusActions() {
    if (document.querySelector('script[data-housekeeping-status-actions]')) return;
    const script = document.createElement('script');
    script.src = '/housekeeping-status-actions.js';
    script.defer = true;
    script.setAttribute('data-housekeeping-status-actions', 'true');
    document.body.appendChild(script);
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'conciergeTaskChoice') renderChoices();
  });
  document.addEventListener('click', async (event) => {
    if (event.target?.id !== 'saveConciergeTaskButton') return;
    try { await saveSelected(); } catch (error) { if (typeof window.setMessage === 'function') window.setMessage(error.message, 'error'); }
  });

  window.refreshConciergeTaskActions = renderChoices;
  ensureShell();
  renderChoices();
  loadHousekeepingStatusActions();
})();
