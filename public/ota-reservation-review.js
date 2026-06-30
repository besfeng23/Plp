(() => {
  const CHANNELS = ['agoda', 'airbnb', 'expedia', 'booking_com', 'direct_website', 'google_hotel_ads', 'trip_com', 'unknown'];
  const ACCOMMODATIONS = ['Grand Ocean Villa', 'Sunset Suite', 'Smart Room Premium'];
  const PAYMENT_STATES = ['unknown', 'unpaid', 'paid_to_ota', 'collect_at_property', 'partially_paid', 'cancelled', 'refunded'];
  const REVIEW_STATUSES = ['needs_review', 'in_review', 'rejected', 'approved_for_manual_entry', 'archived'];
  const SEVERITIES = ['low', 'medium', 'high', 'critical'];
  const state = { rows: [], summary: null, filters: {}, message: '', error: '' };
  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const staffCode = () => window.PLP_STAFF_CODE || window.localStorage?.getItem('plpStaffCode') || window.localStorage?.getItem('plp_staff_code') || '';
  const headers = () => ({ 'Content-Type': 'application/json', 'x-plp-staff-code': staffCode(), 'x-plp-staff-name': window.localStorage?.getItem('plpStaffName') || 'staff' });
  const label = (value) => String(value || '—').replace(/_/g, ' ');

  function ensureStyles() {
    if (document.getElementById('otaReservationReviewStyle')) return;
    const style = document.createElement('style');
    style.id = 'otaReservationReviewStyle';
    style.textContent = '.ota-res-review{margin-top:18px}.ota-res-warning{border:1px solid rgba(156,79,48,.36);background:rgba(156,79,48,.08);color:#6f331f;border-radius:16px;padding:13px 15px;font-weight:900;margin-bottom:14px}.ota-res-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:14px}.ota-res-card{border:1px solid rgba(229,224,216,.88);border-radius:17px;background:rgba(255,253,248,.86);padding:13px;box-shadow:var(--shadow)}.ota-res-card span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.ota-res-card strong{display:block;margin-top:7px;font-size:24px;color:var(--ink)}.ota-res-form,.ota-res-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ota-res-form label,.ota-res-filters label{display:grid;gap:5px;color:var(--muted);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.07em}.ota-res-form input,.ota-res-form select,.ota-res-form textarea,.ota-res-filters select{width:100%;border:1px solid rgba(184,151,126,.38);border-radius:12px;background:#fffdf8;color:var(--ink);padding:9px 10px;font:inherit}.ota-res-form textarea{min-height:112px;grid-column:1/-1;font-family:ui-monospace,Menlo,monospace;font-size:12px}.ota-res-wide{grid-column:span 2}.ota-res-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.ota-res-actions button,.ota-res-panel button{border:1px solid rgba(184,151,126,.55);border-radius:999px;background:#fffdf8;color:var(--teak);padding:9px 12px;font-weight:900;cursor:pointer}.ota-res-actions .primary{background:var(--teak);color:#fffdf8}.ota-res-panel{border:1px solid rgba(229,224,216,.88);border-radius:22px;background:rgba(255,253,248,.78);padding:16px;margin-top:14px;box-shadow:var(--shadow)}.ota-res-table-wrap{overflow:auto;border:1px solid rgba(229,224,216,.88);border-radius:18px;margin-top:12px}.ota-res-table{width:100%;border-collapse:collapse;min-width:1180px;background:#fffdf8}.ota-res-table th,.ota-res-table td{padding:10px;border-bottom:1px solid rgba(229,224,216,.72);text-align:left;vertical-align:top}.ota-res-table th{background:var(--sand);color:var(--teak);font-size:11px;text-transform:uppercase;letter-spacing:.08em}.ota-pill{display:inline-flex;border-radius:999px;padding:3px 8px;background:rgba(184,151,126,.14);color:var(--teak);font-size:11px;font-weight:900}.ota-pill.critical,.ota-pill.high{background:rgba(156,79,48,.12);color:#8a341d}.ota-res-note{font-size:12px;color:var(--muted);line-height:1.45}.ota-res-message{margin-top:10px;border-radius:14px;padding:10px 12px;font-weight:800}.ota-res-message.ok{background:rgba(82,117,84,.1);color:#385d3a}.ota-res-message.err{background:rgba(156,79,48,.1);color:#7b321c}@media(max-width:1100px){.ota-res-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.ota-res-form,.ota-res-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.ota-res-grid,.ota-res-form,.ota-res-filters{grid-template-columns:1fr}.ota-res-wide{grid-column:auto}}';
    document.head.appendChild(style);
  }

  async function api(action, options = {}) {
    const response = await fetch(`/api/admin?action=${action}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || data.detail || 'Admin request failed');
    return data;
  }

  function value(id) { return document.getElementById(id)?.value?.trim() || ''; }
  function rawPayload() {
    const raw = value('otaResRawPayload');
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return { pastedText: raw }; }
  }

  async function stage(event) {
    event?.preventDefault();
    state.error = ''; state.message = '';
    try {
      const payload = {
        channelKey: value('otaResChannel'), otaReservationReference: value('otaResReference'), guestName: value('otaResGuestName'), guestEmail: value('otaResGuestEmail'), guestPhone: value('otaResGuestPhone'), accommodationName: value('otaResAccommodation'), otaRoomId: value('otaResRoomId'), otaRoomName: value('otaResRoomName'), otaRatePlanId: value('otaResRatePlanId'), checkIn: value('otaResCheckIn'), checkOut: value('otaResCheckOut'), guests: value('otaResGuests'), currency: value('otaResCurrency'), totalAmount: value('otaResTotal'), paymentState: value('otaResPaymentState'), rawPayload: rawPayload()
      };
      await api('ota-reservation-stage', { method: 'POST', body: JSON.stringify(payload) });
      state.message = 'OTA reservation staged for review. No booking was created.';
      event?.target?.reset();
      await refresh();
    } catch (error) { state.error = error.message; render(); }
  }

  async function review(id, reviewStatus) {
    const reviewNote = window.prompt(`Review note for ${label(reviewStatus)} (optional):`, '') || '';
    try {
      await api('ota-reservation-review', { method: 'PATCH', body: JSON.stringify({ id, reviewStatus, reviewNote }) });
      state.message = 'Review status updated. No booking was created.';
      await refresh();
    } catch (error) { state.error = error.message; render(); }
  }

  function summaryValue(key) {
    const byReview = state.summary?.byReviewStatus || {};
    const byConflict = state.summary?.byConflictStatus || {};
    const bySeverity = state.summary?.bySeverity || {};
    if (key === 'conflicts') return byConflict.conflict_detected || 0;
    if (key === 'critical') return bySeverity.critical || 0;
    return byReview[key] || 0;
  }

  function renderSummary() {
    return `<div class="ota-res-grid">${[
      ['Needs review', summaryValue('needs_review')], ['In review', summaryValue('in_review')], ['Conflicts', summaryValue('conflicts')], ['Critical', summaryValue('critical')], ['Approved for manual entry', summaryValue('approved_for_manual_entry')], ['Rejected', summaryValue('rejected')]
    ].map(([name, count]) => `<div class="ota-res-card"><span>${esc(name)}</span><strong>${esc(count)}</strong></div>`).join('')}</div>`;
  }

  function renderForm() {
    const options = (items) => items.map((item) => `<option value="${esc(item)}">${esc(label(item))}</option>`).join('');
    return `<section class="ota-res-panel"><h3>Stage OTA reservation payload</h3><p class="ota-res-note">Paste or enter OTA details for staff review. This does not create a booking, change payment status, or message the guest.</p><form id="otaResForm" class="ota-res-form"><label>Channel<select id="otaResChannel">${options(CHANNELS)}</select></label><label>OTA reservation reference<input id="otaResReference" required></label><label>Guest name<input id="otaResGuestName"></label><label>Guest email<input id="otaResGuestEmail" type="email"></label><label>Guest phone<input id="otaResGuestPhone"></label><label>Accommodation<select id="otaResAccommodation"><option value="">Select accommodation</option>${ACCOMMODATIONS.map((item) => `<option>${esc(item)}</option>`).join('')}</select></label><label>OTA room ID<input id="otaResRoomId"></label><label>OTA room name<input id="otaResRoomName"></label><label>OTA rate plan ID<input id="otaResRatePlanId"></label><label>Check-in<input id="otaResCheckIn" type="date"></label><label>Check-out<input id="otaResCheckOut" type="date"></label><label>Guests<input id="otaResGuests" type="number" min="1"></label><label>Currency<input id="otaResCurrency" value="PHP"></label><label>OTA total amount<input id="otaResTotal" inputmode="decimal"></label><label class="ota-res-wide">OTA payment state<select id="otaResPaymentState">${options(PAYMENT_STATES)}</select></label><textarea id="otaResRawPayload" placeholder='Optional raw JSON payload'></textarea><div class="ota-res-actions"><button class="primary" type="submit">Stage for review</button><span class="ota-res-note">No booking was created.</span></div></form></section>`;
  }

  function renderFilters() {
    const opt = (items, current) => `<option value="">All</option>${items.map((item) => `<option value="${esc(item)}" ${current === item ? 'selected' : ''}>${esc(label(item))}</option>`).join('')}`;
    return `<section class="ota-res-panel"><h3>Filters</h3><div class="ota-res-filters"><label>Channel<select data-filter="channelKey">${opt(CHANNELS, state.filters.channelKey)}</select></label><label>Review status<select data-filter="reviewStatus">${opt(REVIEW_STATUSES, state.filters.reviewStatus)}</select></label><label>Severity<select data-filter="severity">${opt(SEVERITIES, state.filters.severity)}</select></label><label>Accommodation<select data-filter="accommodationName"><option value="">All</option>${ACCOMMODATIONS.map((item) => `<option ${state.filters.accommodationName === item ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label></div></section>`;
  }

  function rowHtml(row) {
    const conflicts = row.conflict_summary?.items || [];
    return `<tr><td>${esc(label(row.channel_key))}</td><td><strong>${esc(row.ota_reservation_reference)}</strong></td><td>${esc(row.ota_guest_name)}<br><span class="ota-res-note">${esc(row.ota_guest_email || row.ota_guest_phone)}</span></td><td>${esc(row.accommodation_name)}</td><td>${esc(row.check_in)} → ${esc(row.check_out)}</td><td>${esc(row.guests)}</td><td>${esc(label(row.ota_payment_state))}</td><td><span class="ota-pill">${esc(label(row.review_status))}</span></td><td><span class="ota-pill">${esc(label(row.conflict_status))}</span></td><td><span class="ota-pill ${esc(row.severity)}">${esc(label(row.severity))}</span></td><td>${conflicts.length ? conflicts.map((item) => `<div class="ota-res-note"><strong>${esc(label(item.type))}:</strong> ${esc(item.message)}</div>`).join('') : '<span class="ota-res-note">No conflict summary</span>'}<div class="ota-res-note">${esc(row.review_note || '')}</div></td><td><div class="ota-res-actions"><button type="button" data-review="in_review" data-id="${esc(row.id)}">Mark in review</button><button type="button" data-review="approved_for_manual_entry" data-id="${esc(row.id)}">Approve for manual entry</button><button type="button" data-review="rejected" data-id="${esc(row.id)}">Reject staged import</button><button type="button" data-review="archived" data-id="${esc(row.id)}">Archive staged import</button></div></td></tr>`;
  }

  function renderQueue() {
    const body = state.rows.length ? state.rows.map(rowHtml).join('') : '<tr><td colspan="12">No staged OTA imports yet. If the table is unavailable, apply the Phase 2B migration and confirm the Supabase admin environment is ready.</td></tr>';
    return `<section class="ota-res-panel"><div class="section-head"><div><h3>Review queue</h3><p>Review staged imports only. Approval means approved for future manual entry, not confirmation.</p></div><button type="button" id="otaResRefresh">Refresh queue</button></div><div class="ota-res-table-wrap"><table class="ota-res-table"><thead><tr><th>Channel</th><th>Reference</th><th>Guest</th><th>Accommodation</th><th>Dates</th><th>Guests</th><th>Payment state</th><th>Review status</th><th>Conflict status</th><th>Severity</th><th>Conflict summary / note</th><th>Actions</th></tr></thead><tbody>${body}</tbody></table></div></section>`;
  }

  function render() {
    ensureStyles();
    let section = document.getElementById('ota-reservation-review');
    if (!section) {
      const anchor = document.getElementById('ota-sync-dry-run') || document.getElementById('ota-channel-readiness') || document.getElementById('admin-qa-polish') || document.body;
      section = document.createElement('section'); section.id = 'ota-reservation-review'; section.className = 'ota-res-review';
      anchor.insertAdjacentElement(anchor === document.body ? 'beforeend' : 'afterend', section);
    }
    section.innerHTML = `<div class="section-head"><div><h2>OTA Reservation Review Queue</h2><p>Admin-only Phase 2B staging for OTA reservations.</p></div></div><div class="ota-res-warning">Review-first only. Staging an OTA reservation will not create a booking, change payment status, or message the guest.</div>${renderSummary()}${state.message ? `<div class="ota-res-message ok">${esc(state.message)}</div>` : ''}${state.error ? `<div class="ota-res-message err">${esc(state.error)} — OTA reservation review table not ready; apply Phase 2B migration or confirm Supabase admin environment.</div>` : ''}${renderForm()}${renderFilters()}${renderQueue()}`;
    document.getElementById('otaResForm')?.addEventListener('submit', stage);
    document.getElementById('otaResRefresh')?.addEventListener('click', refresh);
    section.querySelectorAll('[data-filter]').forEach((el) => el.addEventListener('change', async () => { state.filters[el.dataset.filter] = el.value; await refresh(); }));
    section.querySelectorAll('[data-review]').forEach((el) => el.addEventListener('click', () => review(el.dataset.id, el.dataset.review)));
  }

  async function refresh() {
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(state.filters).filter(([, value]) => value)));
      const [summary, imports] = await Promise.all([api('ota-reservation-summary'), api(`ota-reservation-imports&${params.toString()}`)]);
      state.summary = summary.summary; state.rows = imports.rows || []; state.error = '';
    } catch (error) { state.error = error.message; state.rows = []; }
    render();
  }

  window.refreshOtaReservationReview = refresh;
  window.stageOtaReservationForReview = stage;
  ensureStyles(); render(); setTimeout(refresh, 700); setTimeout(refresh, 1800);
})();
