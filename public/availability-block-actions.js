(() => {
  let blocked = [];
  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const headers = () => ({ ...(typeof window.headers === 'function' ? window.headers() : {}), 'Content-Type': 'application/json' });
  const setMsg = (message, type) => { if (typeof window.setMessage === 'function') window.setMessage(message, type); };

  function blockReference(block) {
    return `BLOCK-${String(block?.start_date || block?.startDate || 'date').slice(0, 10)}`.slice(0, 80);
  }

  async function writeWorklog(action, block) {
    try {
      await fetch('/api/admin?action=staff-task', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          reference: blockReference(block),
          kind: 'task',
          category: 'availability',
          priority: action === 'cancelled' ? 'medium' : 'high',
          title: `Availability block ${action}`,
          note: `${action}: ${block.accommodation_name || block.accommodation || 'Accommodation'} from ${block.start_date || block.startDate} to ${block.end_date || block.endDate}. Reason: ${block.reason || 'Manual staff block'}`
        })
      });
      if (typeof window.refreshStaffTasks === 'function') await window.refreshStaffTasks();
    } catch {}
  }

  async function loadBlocks() {
    const response = await fetch('/api/admin?action=date-blocks', { headers: headers() });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || data?.detail || data?.warning || 'Unable to load date blocks.');
    blocked = data.blockedDates || [];
    renderBlocks();
  }

  async function createBlock() {
    const accommodation = document.getElementById('blockAccommodation')?.value || '';
    const startDate = document.getElementById('blockStartDate')?.value || '';
    const endDate = document.getElementById('blockEndDate')?.value || '';
    const reason = document.getElementById('blockReason')?.value || 'Manual staff block';
    if (!accommodation || !startDate || !endDate) return setMsg('Choose accommodation, start date, and end date first.', 'error');
    const response = await fetch('/api/admin?action=date-blocks', { method: 'POST', headers: headers(), body: JSON.stringify({ accommodation, startDate, endDate, reason }) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || data?.detail || 'Unable to create date block.');
    setMsg('Availability block created.');
    await writeWorklog('created', { ...data.row, accommodation, startDate, endDate, reason });
    await loadBlocks();
  }

  async function cancelBlock(id) {
    if (!id) return;
    const row = blocked.find((item) => String(item.id) === String(id)) || { id };
    const response = await fetch('/api/admin?action=date-blocks', { method: 'PATCH', headers: headers(), body: JSON.stringify({ id }) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || data?.detail || 'Unable to cancel date block.');
    setMsg('Availability block cancelled.');
    await writeWorklog('cancelled', row);
    await loadBlocks();
  }

  function ensureShell() {
    if (document.getElementById('availability-block-actions')) return;
    const style = document.createElement('style');
    style.textContent = '.block-actions-panel,.block-card{border:1px solid rgba(229,224,216,.88);border-radius:20px;background:rgba(255,253,248,.82);box-shadow:var(--shadow);padding:16px}.block-actions-panel{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}.block-actions-panel label{display:grid;gap:6px;color:var(--brass);font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.block-actions-panel input,.block-actions-panel select{width:100%;border:1px solid var(--linen);border-radius:12px;background:#FFFDF8;color:var(--teak);padding:10px}.block-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.block-card p,.block-note{border-radius:12px;background:var(--sand);padding:10px;color:var(--muted);font-size:12px;line-height:1.45}.block-note{margin-bottom:14px;border:1px dashed rgba(184,151,126,.42)}@media(max-width:1000px){.block-actions-panel,.block-list{grid-template-columns:1fr 1fr}}@media(max-width:720px){.block-actions-panel,.block-list{grid-template-columns:1fr}}';
    document.head.appendChild(style);
    const anchor = document.getElementById('availability-board') || document.getElementById('housekeeping-status-actions') || document.getElementById('summary');
    if (!anchor) return;
    const section = document.createElement('section');
    section.id = 'availability-block-actions';
    section.innerHTML = '<div class="section-head"><div><h2>Availability Block Controls</h2><p>Create or cancel manual date blocks without touching public booking or payment flows.</p></div><div class="section-actions"><button type="button" onclick="window.refreshAvailabilityBlocks()">Refresh blocks</button></div></div><div class="block-note"><strong>Admin write control:</strong> These actions use /api/admin?action=date-blocks. Manual blocks are separate from booking occupancy.</div><div class="block-actions-panel"><label>Accommodation<select id="blockAccommodation"><option>Grand Ocean Villa</option><option>Sunset Suite</option><option>Smart Room Premium</option></select></label><label>Start date<input type="date" id="blockStartDate"></label><label>End date<input type="date" id="blockEndDate"></label><label>Reason<input id="blockReason" placeholder="Maintenance, owner hold, private event"></label><button type="button" id="createAvailabilityBlock">Create block</button></div><div class="block-list" id="availabilityBlockList"></div>';
    anchor.insertAdjacentElement('afterend', section);
  }

  function renderBlocks() {
    ensureShell();
    const list = document.getElementById('availabilityBlockList');
    if (!list) return;
    list.innerHTML = blocked.length ? blocked.map((block) => `<article class="block-card"><strong>${esc(block.accommodation_name || block.name || 'Accommodation')}</strong><p>${esc(block.start_date)} → ${esc(block.end_date)}<br>${esc(block.reason || 'Manual staff block')}</p><button type="button" data-cancel-block="${esc(block.id)}">Cancel block</button></article>`).join('') : '<div class="empty-state">No active manual blocks returned by admin API.</div>';
  }

  document.addEventListener('click', async (event) => {
    const createButton = event.target?.closest?.('#createAvailabilityBlock');
    const cancelButton = event.target?.closest?.('[data-cancel-block]');
    try {
      if (createButton) await createBlock();
      if (cancelButton) await cancelBlock(cancelButton.dataset.cancelBlock);
    } catch (error) {
      setMsg(error.message, 'error');
    }
  });

  window.refreshAvailabilityBlocks = loadBlocks;
  ensureShell();
  loadBlocks().catch((error) => setMsg(error.message, 'error'));
})();
