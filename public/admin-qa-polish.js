(() => {
  const MODULES = [
    ['Reservation 360', 'openReservation360'],
    ['Confirmation Workflow', 'saveConfirmationStatus'],
    ['Guest Profile 360', 'plpGuestProfiles'],
    ['Concierge Queue', 'plpConciergeQueue'],
    ['Availability Board', 'plpAvailabilityBoard'],
    ['Housekeeping Readiness', 'plpHousekeepingReadiness'],
    ['Staff Tasks', 'refreshStaffTasks'],
    ['Concierge Actions', 'refreshConciergeTaskActions'],
    ['Housekeeping Actions', 'refreshHousekeepingStatusActions'],
    ['Availability Blocks', 'refreshAvailabilityBlocks']
  ];
  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));

  function friendly(error) {
    const text = String(error?.message || error || 'Admin module warning');
    if (/plp_staff_tasks|staff tasks|Phase 1I migration/i.test(text)) return 'Staff task storage is not ready yet. Apply the Phase 1I Supabase migration, then refresh admin.';
    if (/blocked|date-block|availability/i.test(text)) return 'Availability block storage is not ready or returned a warning. Check Supabase availability tables and refresh admin.';
    if (/Supabase|environment/i.test(text)) return 'Supabase admin environment is not ready. Check Vercel environment variables.';
    return text.slice(0, 220);
  }

  function ensureStyles() {
    if (document.getElementById('adminQaPolishStyle')) return;
    const style = document.createElement('style');
    style.id = 'adminQaPolishStyle';
    style.textContent = '.admin-qa-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.admin-qa-card{border:1px solid rgba(229,224,216,.88);border-radius:16px;background:rgba(255,253,248,.82);padding:12px}.admin-qa-card strong{display:block}.admin-qa-card span{display:block;color:var(--muted);font-size:12px;margin-top:4px}.admin-qa-note{border:1px dashed rgba(184,151,126,.42);border-radius:12px;background:var(--sand);padding:10px;color:var(--muted);font-size:12px;line-height:1.45;margin-bottom:12px}.empty-state{border:1px dashed rgba(184,151,126,.35);border-radius:16px;background:rgba(255,253,248,.7);padding:16px;color:var(--muted)}button:disabled{opacity:.55;cursor:not-allowed}@media(max-width:1100px){.admin-qa-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.admin-qa-grid{grid-template-columns:1fr}.section-head{align-items:flex-start}.section-actions{width:100%}.section-actions button{width:100%}section button,section input,section select,section textarea{font-size:16px}}';
    document.head.appendChild(style);
  }

  function statusCard([name, key]) {
    const ok = window[key] !== undefined;
    return `<article class="admin-qa-card"><strong>${esc(name)}</strong><span>${ok ? 'Loaded' : 'Waiting / unavailable'}</span></article>`;
  }

  function render() {
    ensureStyles();
    let section = document.getElementById('admin-qa-polish');
    if (!section) {
      const anchor = document.getElementById('availability-block-actions') || document.getElementById('housekeeping-status-actions') || document.getElementById('staff-tasks-panel') || document.getElementById('summary');
      if (!anchor) return;
      section = document.createElement('section');
      section.id = 'admin-qa-polish';
      anchor.insertAdjacentElement('afterend', section);
    }
    section.innerHTML = `<div class="section-head"><div><h2>Admin QA + Mobile Polish</h2><p>Load-chain, readiness, and mobile-safe admin checks.</p></div><div class="section-actions"><button type="button" onclick="window.refreshAdminQaPolish()">Refresh QA</button></div></div><div class="admin-qa-note"><strong>Deploy note:</strong> If saved tasks fail, apply the Phase 1I Supabase migration. If this is not live yet, clear Vercel build-rate-limit and redeploy latest main.</div><div class="admin-qa-grid">${MODULES.map(statusCard).join('')}</div>`;
  }

  window.addEventListener('error', (event) => {
    if (typeof window.setMessage === 'function') window.setMessage(friendly(event.error || event.message), 'error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (typeof window.setMessage === 'function') window.setMessage(friendly(event.reason), 'error');
  });

  window.refreshAdminQaPolish = render;
  ensureStyles();
  setTimeout(render, 400);
  setTimeout(render, 1400);
})();
