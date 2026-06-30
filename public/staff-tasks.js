(() => {
  let rowsCache = [];
  let saved = [];
  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const field = (row, names) => names.map((name) => row?.[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
  const ref = (row) => field(row, ['booking_reference', 'reference', 'booking_code', 'code']);
  const guest = (row) => field(row, ['guest_name', 'name', 'full_name', 'guestName']) || 'Unnamed guest';
  const room = (row) => field(row, ['accommodation_name', 'accommodation', 'room_name', 'villa_name', 'room', 'villa']) || 'Unassigned';
  const adminHeaders = () => ({ ...(typeof window.headers === 'function' ? window.headers() : {}), 'Content-Type': 'application/json' });
  const setMsg = (message, type) => { if (typeof window.setMessage === 'function') window.setMessage(message, type); };

  function bookings() {
    const seen = new Set();
    return rowsCache.map((row) => ({ value: ref(row), label: `${ref(row)} · ${guest(row)} · ${room(row)}` })).filter((item) => item.value && !seen.has(item.value) && seen.add(item.value));
  }

  async function loadSaved() {
    const response = await fetch('/api/admin?action=staff-tasks', { headers: adminHeaders() });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || data?.detail || 'Unable to load saved staff tasks. Apply the Phase 1I migration if needed.');
    saved = data.rows || [];
    renderSaved();
  }

  async function save(kind) {
    const reference = document.getElementById('staffTaskReference')?.value || '';
    const title = document.getElementById('staffTaskTitle')?.value || '';
    const note = document.getElementById('staffTaskNote')?.value || '';
    const category = document.getElementById('staffTaskCategory')?.value || 'admin';
    const priority = document.getElementById('staffTaskPriority')?.value || 'normal';
    if (!reference) return setMsg('Choose a booking first.', 'error');
    if (!title && !note) return setMsg('Add a title or note first.', 'error');
    const response = await fetch('/api/admin?action=staff-task', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ reference, kind, title, note, category, priority }) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || data?.detail || 'Unable to save staff task.');
    document.getElementById('staffTaskTitle').value = '';
    document.getElementById('staffTaskNote').value = '';
    setMsg(kind === 'note' ? 'Internal note saved.' : 'Staff task saved.');
    await loadSaved();
  }

  async function mark(id, status) {
    const response = await fetch('/api/admin?action=staff-task', { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ id, status }) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || data?.detail || 'Unable to update staff task.');
    await loadSaved();
  }

  function ensureShell() {
    if (document.getElementById('staff-tasks-panel')) return;
    const style = document.createElement('style');
    style.textContent = '.staff-task-form,.staff-task-card{border:1px solid rgba(229,224,216,.88);border-radius:20px;background:rgba(255,253,248,.82);box-shadow:var(--shadow);padding:16px}.staff-task-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}.staff-task-form label{display:grid;gap:6px;color:var(--brass);font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.staff-task-form input,.staff-task-form select,.staff-task-form textarea{width:100%;border:1px solid var(--linen);border-radius:12px;background:#FFFDF8;color:var(--teak);padding:10px}.staff-task-form textarea{min-height:42px}.staff-task-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.staff-task-card p,.staff-task-note{border-radius:12px;background:var(--sand);padding:10px;color:var(--muted);font-size:12px;line-height:1.45}.staff-task-note{margin-bottom:14px;border:1px dashed rgba(184,151,126,.42)}.staff-task-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}@media(max-width:900px){.staff-task-form,.staff-task-list{grid-template-columns:1fr}}';
    document.head.appendChild(style);
    const anchor = document.getElementById('housekeeping-readiness') || document.getElementById('availability-board') || document.getElementById('summary');
    if (!anchor) return;
    const section = document.createElement('section');
    section.id = 'staff-tasks-panel';
    section.innerHTML = '<div class="section-head"><div><h2>Internal Notes + Staff Tasks</h2><p>Persisted admin worklog for bookings.</p></div><div class="section-actions"><button type="button" onclick="window.refreshStaffTasks()">Refresh</button></div></div><div class="staff-task-note"><strong>Saved admin layer:</strong> Uses /api/admin?action=staff-task and the plp_staff_tasks table.</div><div class="staff-task-form"><label>Booking<select id="staffTaskReference"></select></label><label>Category<select id="staffTaskCategory"><option value="admin">Admin</option><option value="concierge">Concierge</option><option value="housekeeping">Housekeeping</option><option value="payment">Payment</option><option value="arrival">Arrival</option><option value="availability">Availability</option></select></label><label>Priority<select id="staffTaskPriority"><option value="normal">Normal</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Title<input id="staffTaskTitle"></label><label>Note<textarea id="staffTaskNote"></textarea></label><button type="button" data-save-staff="task">Save task</button><button type="button" data-save-staff="note">Save note</button></div><div class="staff-task-list" id="staffTaskList"></div>';
    anchor.insertAdjacentElement('afterend', section);
  }

  function renderOptions() {
    const select = document.getElementById('staffTaskReference');
    if (!select) return;
    select.innerHTML = bookings().map((item) => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join('') || '<option value="">No loaded bookings</option>';
  }

  function renderSaved() {
    ensureShell();
    renderOptions();
    const list = document.getElementById('staffTaskList');
    if (!list) return;
    list.innerHTML = saved.length ? saved.map((task) => `<article class="staff-task-card"><strong>${esc(task.title)}</strong><p>${esc(task.booking_reference)} · ${esc(task.kind)} · ${esc(task.category)} · ${esc(task.priority)} · ${esc(task.status)}${task.note ? `<br>${esc(task.note)}` : ''}</p>${task.status === 'open' || task.status === 'in_progress' ? `<div class="staff-task-actions"><button data-staff-id="${esc(task.id)}" data-staff-status="in_progress">In progress</button><button data-staff-id="${esc(task.id)}" data-staff-status="done">Done</button><button data-staff-id="${esc(task.id)}" data-staff-status="cancelled">Cancel</button></div>` : ''}</article>`).join('') : '<div class="empty-state">No saved internal notes or staff tasks yet.</div>';
  }

  document.addEventListener('click', async (event) => {
    const saveButton = event.target?.closest?.('[data-save-staff]');
    const statusButton = event.target?.closest?.('[data-staff-status]');
    try {
      if (saveButton) await save(saveButton.dataset.saveStaff);
      if (statusButton) await mark(statusButton.dataset.staffId, statusButton.dataset.staffStatus);
    } catch (error) {
      setMsg(error.message, 'error');
    }
  });

  window.refreshStaffTasks = loadSaved;
  const oldRows = window.renderRows;
  if (typeof oldRows === 'function') window.renderRows = function (rows) { const out = oldRows.apply(this, arguments); rowsCache = rows || []; renderSaved(); return out; };
  const oldToday = window.renderTodayCommand;
  if (typeof oldToday === 'function') window.renderTodayCommand = function (rows, notifications) { const out = oldToday.apply(this, arguments); rowsCache = rows || []; renderSaved(); return out; };
  ensureShell();
  renderSaved();
  loadSaved().catch((error) => setMsg(error.message, 'error'));
})();
