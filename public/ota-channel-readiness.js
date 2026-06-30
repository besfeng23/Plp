(() => {
  const CHANNELS = [
    { name: 'Agoda', risk: 'High', next: 'Confirm partner access, credential storage owner, room IDs, and review-first import workflow.' },
    { name: 'Airbnb', risk: 'High', next: 'Define listing mapping, calendar source of truth, and manual-block conflict review process.' },
    { name: 'Expedia', risk: 'High', next: 'Confirm Expedia connectivity path, rate plan IDs, and dry-run validation scope.' },
    { name: 'Booking.com', risk: 'High', next: 'Confirm connectivity method, reservation import review queue, and operator approval gate.' },
    { name: 'Direct Website', risk: 'Medium', next: 'Keep direct bookings as protected source records before any OTA availability push.' },
    { name: 'Google Hotel Ads', risk: 'Medium', next: 'Define whether this is ads/metasearch only or future rates-and-availability distribution.' },
    { name: 'Trip.com', risk: 'High', next: 'Confirm partner access, mapping fields, and conflict escalation owner.' }
  ];

  const ROOMS = ['Grand Ocean Villa', 'Sunset Suite', 'Smart Room Premium'];
  const CHECKS = [
    'Credentials not configured',
    'Room mapping incomplete',
    'Rate plan mapping incomplete',
    'Availability source of truth pending',
    'Manual block behavior defined',
    'Conflict queue required before live sync',
    'OTA reservation import must be review-first',
    'Staff task audit required',
    'No live push until operator approval'
  ];
  const ENDPOINTS = [
    'GET /api/admin?action=ota-readiness',
    'GET /api/admin?action=ota-mappings',
    'POST /api/admin?action=ota-sync-dry-run',
    'POST /api/admin?action=ota-sync-approve'
  ];

  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));

  function ensureStyles() {
    if (document.getElementById('otaChannelReadinessStyle')) return;
    const style = document.createElement('style');
    style.id = 'otaChannelReadinessStyle';
    style.textContent = '.ota-readiness-alert{border:1px solid rgba(156,79,48,.35);background:rgba(156,79,48,.08);color:#6f331f;border-radius:14px;padding:12px 14px;font-weight:800;margin-bottom:14px}.ota-channel-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ota-channel-card{border:1px solid rgba(229,224,216,.88);border-radius:18px;background:rgba(255,253,248,.84);padding:14px;box-shadow:var(--shadow)}.ota-channel-card h3{margin:0 0 10px}.ota-meta{display:grid;grid-template-columns:1fr;gap:7px;color:var(--muted);font-size:12px}.ota-meta strong{color:var(--ink)}.ota-risk{display:inline-flex;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800;background:var(--sand);color:var(--teak)}.ota-table-wrap{overflow:auto;border:1px solid rgba(229,224,216,.88);border-radius:18px;background:rgba(255,253,248,.84);margin-top:14px}.ota-table{width:100%;border-collapse:collapse;min-width:980px}.ota-table th,.ota-table td{padding:10px;border-bottom:1px solid rgba(229,224,216,.72);text-align:left;vertical-align:top}.ota-table th{background:var(--sand);color:var(--teak);font-size:11px;text-transform:uppercase;letter-spacing:.08em}.ota-checklist{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.ota-check{border:1px dashed rgba(184,151,126,.45);border-radius:14px;background:rgba(255,253,248,.74);padding:10px;color:var(--muted);font-size:12px}.ota-check span{display:inline-grid;place-items:center;width:18px;height:18px;border:1px solid rgba(184,151,126,.55);border-radius:5px;margin-right:7px;color:transparent}.ota-preview{border:1px solid rgba(229,224,216,.88);border-radius:18px;background:rgba(255,253,248,.84);padding:14px;margin-top:14px}.ota-preview code{display:block;margin-top:8px;color:var(--teak);font-size:12px}.ota-rule-list{margin:14px 0 0;padding-left:18px;color:var(--muted);line-height:1.55}@media(max-width:1100px){.ota-channel-grid,.ota-checklist{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.ota-channel-grid,.ota-checklist{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }

  function channelCard(channel) {
    return `<article class="ota-channel-card"><h3>${esc(channel.name)}</h3><div class="ota-meta"><span><strong>Current status:</strong> Planning only</span><span><strong>Connection state:</strong> Not connected</span><span><strong>Credential state:</strong> Missing / not configured</span><span><strong>Inventory sync state:</strong> Disabled</span><span><strong>Reservation import state:</strong> Disabled</span><span><strong>Rate sync state:</strong> Disabled</span><span><strong>Risk level:</strong> <em class="ota-risk">${esc(channel.risk)}</em></span><span><strong>Next required step:</strong> ${esc(channel.next)}</span></div></article>`;
  }

  function mappingRow(room) {
    return `<tr><td><strong>${esc(room)}</strong></td><td>Placeholder — OTA room name not mapped</td><td>Placeholder — max guests not confirmed</td><td>Placeholder — rate plan not mapped</td><td>Not eligible until reviewed and enabled</td><td>Manual admin blocks override OTA availability</td><td>Queue for staff review; never auto-cancel a direct booking</td></tr>`;
  }

  function render() {
    ensureStyles();
    let section = document.getElementById('ota-channel-readiness');
    if (!section) {
      const anchor = document.getElementById('admin-qa-polish') || document.getElementById('availability-block-actions') || document.getElementById('availability-board') || document.getElementById('summary');
      if (!anchor) return;
      section = document.createElement('section');
      section.id = 'ota-channel-readiness';
      anchor.insertAdjacentElement('afterend', section);
    }
    section.innerHTML = `<div class="section-head"><div><h2>OTA Channel Readiness</h2><p>Planning matrix for future OTA inventory sync. No live OTA connection is active.</p></div><div class="section-actions"><button type="button" class="ghost" onclick="window.refreshOtaChannelReadiness()">Refresh planning view</button></div></div><div class="ota-readiness-alert">Planning only. No live OTA API sync is enabled.</div><div class="ota-channel-grid">${CHANNELS.map(channelCard).join('')}</div><div class="ota-table-wrap"><table class="ota-table"><thead><tr><th>Internal accommodation name</th><th>OTA room name placeholder</th><th>Max guests placeholder</th><th>Rate plan placeholder</th><th>Inventory sync eligibility</th><th>Manual block behavior</th><th>Conflict behavior</th></tr></thead><tbody>${ROOMS.map(mappingRow).join('')}</tbody></table></div><ul class="ota-rule-list"><li>Confirmed direct bookings must override OTA availability.</li><li>Payment-pending direct bookings must not be pushed as confirmed OTA holds.</li><li>OTA sync must never modify PayPal/Xendit/payment status.</li><li>OTA reservation imports must enter a review queue first.</li><li>OTA conflicts must never auto-cancel a direct booking.</li></ul><div class="ota-checklist">${CHECKS.map((item) => `<div class="ota-check"><span aria-hidden="true">□</span>${esc(item)}</div>`).join('')}</div><div class="ota-preview"><h3>Phase 2A: OTA Inventory Sync Foundation</h3><p><strong>Planned only. Not live in Phase 1N.</strong></p>${ENDPOINTS.map((endpoint) => `<code>${esc(endpoint)}</code>`).join('')}</div>`;
  }

  window.refreshOtaChannelReadiness = render;
  ensureStyles();
  setTimeout(render, 500);
  setTimeout(render, 1500);
})();
