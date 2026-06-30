(() => {
  const CHANNELS = [
    ['', 'All channels'], ['agoda', 'Agoda'], ['airbnb', 'Airbnb'], ['expedia', 'Expedia'], ['booking_com', 'Booking.com'], ['direct_website', 'Direct Website'], ['google_hotel_ads', 'Google Hotel Ads'], ['trip_com', 'Trip.com']
  ];
  const ROOMS = ['', 'Grand Ocean Villa', 'Sunset Suite', 'Smart Room Premium'];
  const esc = (v) => String(v ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const staffCode = () => window.PLP_STAFF_CODE || localStorage.getItem('plpStaffCode') || localStorage.getItem('plp_staff_code') || '';

  function ensureStyles() {
    if (document.getElementById('otaDryRunStyle')) return;
    const style = document.createElement('style');
    style.id = 'otaDryRunStyle';
    style.textContent = '.ota-dry-alert{border:1px solid rgba(156,79,48,.35);background:rgba(156,79,48,.08);color:#6f331f;border-radius:14px;padding:12px 14px;font-weight:900;margin-bottom:14px}.ota-dry-form{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;align-items:end}.ota-dry-form label{display:grid;gap:5px;color:var(--muted);font-size:12px;font-weight:800}.ota-dry-form select,.ota-dry-form input{min-height:38px;border:1px solid rgba(184,151,126,.45);border-radius:12px;background:#fffdf8;padding:7px}.ota-dry-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.ota-dry-card,.ota-dry-channel,.ota-dry-conflict{border:1px solid rgba(229,224,216,.88);border-radius:16px;background:rgba(255,253,248,.86);padding:12px}.ota-dry-card strong{display:block;font-size:22px;color:var(--teak)}.ota-dry-day{display:inline-flex;margin:3px;padding:4px 7px;border-radius:999px;background:var(--sand);font-size:11px}.ota-dry-table{width:100%;border-collapse:collapse}.ota-dry-table th,.ota-dry-table td{padding:8px;border-bottom:1px solid rgba(229,224,216,.72);text-align:left}@media(max-width:900px){.ota-dry-form,.ota-dry-summary{grid-template-columns:1fr 1fr}}@media(max-width:620px){.ota-dry-form,.ota-dry-summary{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }

  function api(action, options = {}) {
    return fetch(`/api/admin?action=${action}`, { ...options, headers: { 'Content-Type': 'application/json', 'x-plp-staff-code': staffCode(), ...(options.headers || {}) } }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || data.detail || 'Admin API request failed');
      return data;
    });
  }

  function section() {
    ensureStyles();
    let node = document.getElementById('ota-sync-dry-run');
    if (node) return node;
    const anchor = document.getElementById('ota-channel-readiness') || document.getElementById('admin-qa-polish') || document.getElementById('availability-block-actions') || document.getElementById('summary');
    if (!anchor) return null;
    node = document.createElement('section');
    node.id = 'ota-sync-dry-run';
    anchor.insertAdjacentElement('afterend', node);
    return node;
  }

  function renderShell(message = '') {
    const node = section();
    if (!node) return;
    node.innerHTML = `<div class="section-head"><div><h2>OTA Inventory Dry Run</h2><p>Preview what Resort Command would push to OTA inventory if live sync existed.</p></div><div class="section-actions"><button type="button" class="ghost" id="otaRefreshConflicts">Refresh conflicts</button></div></div><div class="ota-dry-alert">Dry run only. No OTA inventory will be changed. No live OTA sync is enabled.</div><div class="ota-dry-form"><label>Channel<select id="otaDryChannel">${CHANNELS.map(([v,l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label><label>Accommodation<select id="otaDryRoom">${ROOMS.map((r,i) => `<option value="${esc(r)}">${esc(i ? r : 'All accommodations')}</option>`).join('')}</select></label><label>Start date<input id="otaDryStart" type="date"></label><label>End date<input id="otaDryEnd" type="date"></label><button type="button" id="otaRunDryRun">Run dry run</button></div><div id="otaDryRunStatus">${esc(message || 'OTA foundation tables are not ready yet if this panel cannot load data. Apply the Phase 1N migration.')}</div><div id="otaDryRunResults"></div><div id="otaDryRunConflicts"></div>`;
    document.getElementById('otaRunDryRun')?.addEventListener('click', window.runOtaInventoryDryRun);
    document.getElementById('otaRefreshConflicts')?.addEventListener('click', window.refreshOtaDryRun);
  }

  function renderResults(data) {
    const target = document.getElementById('otaDryRunResults');
    if (!target) return;
    const s = data.summary || {};
    const cards = [['Channels checked', s.channelsChecked], ['Mappings checked', s.mappingsChecked], ['Days checked', s.daysChecked], ['Available days', s.availableDays], ['Blocked days', s.blockedDays], ['Direct hold days', s.directHoldDays], ['Conflict days', s.conflictDays], ['Skipped days', s.skippedDays]];
    target.innerHTML = `<div class="ota-dry-summary">${cards.map(([k,v]) => `<div class="ota-dry-card"><span>${esc(k)}</span><strong>${esc(v ?? 0)}</strong></div>`).join('')}</div>${(data.channels || []).map((c) => `<article class="ota-dry-channel"><h3>${esc(c.channelName)} <small>${esc(c.connectionState)}</small></h3>${(c.mappings || []).map((m) => `<h4>${esc(m.internalAccommodationName)} — ${esc(m.mappingStatus)}</h4><div>${(m.days || []).slice(0, 31).map((d) => `<span class="ota-dry-day" title="${esc(d.reason)}">${esc(d.date)}: ${esc(d.proposedAction)}</span>`).join('')}</div>`).join('')}</article>`).join('')}`;
  }

  async function renderConflicts() {
    const target = document.getElementById('otaDryRunConflicts');
    if (!target) return;
    try {
      const data = await api('ota-conflicts');
      const rows = data.conflicts || [];
      target.innerHTML = `<h3>Open conflicts</h3>${rows.length ? `<table class="ota-dry-table"><thead><tr><th>Severity</th><th>Type</th><th>Channel</th><th>Accommodation</th><th>Date range</th><th>Status</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.severity)}</td><td>${esc(r.conflict_type)}</td><td>${esc(r.channel_key)}</td><td>${esc(r.accommodation_name)}</td><td>${esc(r.start_date)} → ${esc(r.end_date)}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table>` : '<p>No open OTA conflicts found.</p>'}`;
    } catch (error) { target.innerHTML = `<p>Dry run failed before any OTA changes were made. ${esc(error.message)}</p>`; }
  }

  window.runOtaInventoryDryRun = async function runOtaInventoryDryRun() {
    const status = document.getElementById('otaDryRunStatus');
    try {
      status.textContent = 'Running dry run. No OTA changes will be made.';
      const body = { channelKey: document.getElementById('otaDryChannel')?.value || undefined, accommodationName: document.getElementById('otaDryRoom')?.value || undefined, startDate: document.getElementById('otaDryStart')?.value, endDate: document.getElementById('otaDryEnd')?.value, mode: 'dry_run' };
      const data = await api('ota-sync-dry-run', { method: 'POST', body: JSON.stringify(body) });
      status.textContent = (data.warnings || []).length ? data.warnings.join(' ') : 'Dry run completed. No OTA inventory was changed.';
      renderResults(data);
      await renderConflicts();
    } catch (error) { status.textContent = `Dry run failed before any OTA changes were made. ${error.message}`; }
  };

  window.refreshOtaDryRun = async function refreshOtaDryRun() { renderShell('Loading OTA dry-run foundation…'); await renderConflicts(); };
  setTimeout(() => { renderShell('No live OTA sync is enabled.'); renderConflicts(); }, 700);
})();
