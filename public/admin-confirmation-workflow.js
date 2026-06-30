(() => {
  let rowsCache = [];
  let savingReference = '';
  const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const field = (row, names) => names.map((name) => row?.[name]).find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
  const norm = (value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const peso = (value) => `₱${Number(value || 0).toLocaleString('en-PH')}`;
  const provider = (row) => norm(field(row, ['provider', 'payment_provider'])) || 'UNKNOWN';
  const booking = (row) => norm(field(row, ['booking_status', 'status'])) || 'MISSING';
  const pay = (row) => norm(field(row, ['payment_status', 'booking_payment_status'])) || 'MISSING';
  const verify = (row) => norm(field(row, ['payment_verification_status', 'verification_status'])) || 'MISSING';
  const exceptionTokens = ['FAILED', 'MISMATCH', 'UNMATCHED', 'ORDER_ID_MISMATCH', 'ORDER_SESSION_MISSING', 'ORDER_ID_MISSING', 'DATABASE_UNCONFIGURED', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'CAPTURE_NOT_COMPLETED'];

  function hasException(row) {
    const text = `${booking(row)} ${pay(row)} ${verify(row)} ${field(row, ['verification_error', 'verification_note', 'verification_notes'])}`;
    return exceptionTokens.some((token) => text.includes(token)) || Boolean(field(row, ['verification_error', 'verification_note', 'verification_notes']));
  }

  function group(row) {
    if (hasException(row)) return 'exceptions';
    if (['CONFIRMED', 'FULLY_PAID', 'CHECKED_IN', 'CHECKED_OUT'].includes(booking(row))) return 'confirmed';
    if (verify(row) === 'VERIFIED' && /READY|REVIEWED|APPROVE|PAID_DEPOSIT/.test(booking(row))) return 'ready';
    if (verify(row) === 'VERIFIED') return 'verified';
    if (field(row, ['provider_session_id', 'provider_payment_id', 'last_webhook_id']) || /PROCESS/.test(`${pay(row)} ${booking(row)}`)) return 'processing';
    return 'awaiting';
  }

  function nextAction(row) {
    const bucket = group(row);
    if (bucket === 'exceptions') return 'Do not confirm. Resolve the payment exception first.';
    if (bucket === 'awaiting') return 'Await deposit startup or contact guest. No final confirmation yet.';
    if (bucket === 'processing') return 'Wait for provider verification or review the payment row.';
    if (bucket === 'verified') return 'Payment verified. Availability and guest details still need staff review.';
    if (bucket === 'ready') return 'Ready for final manual confirmation after availability is checked.';
    if (bucket === 'confirmed') return 'Confirmed/final operational row. Prepare stay service.';
    return 'Review in Reservation 360.';
  }

  function confirmAllowed(row) {
    if (verify(row) !== 'VERIFIED') return 'No — payment is not verified.';
    if (hasException(row)) return 'No — payment exception exists.';
    if (['CONFIRMED', 'FULLY_PAID', 'CHECKED_IN', 'CHECKED_OUT'].includes(booking(row))) return 'Already final.';
    return 'Yes — but only after staff manually reviews availability, guest details, dates, requests, and balance.';
  }

  function pill(value) {
    const text = norm(value || 'MISSING');
    const cls = /VERIFIED|CONFIRMED|SUCCEEDED|PAID/.test(text) ? 'ok' : /FAILED|MISMATCH|UNMATCHED|CANCEL|EXPIRED|MISSING/.test(text) ? 'danger' : 'warn';
    return `<span class="pill ${cls}">${esc(text)}</span>`;
  }

  function actionButtons(row) {
    const ref = field(row, ['booking_reference', 'reference', 'booking_code', 'code']);
    const bucket = group(row);
    const disabled = savingReference === ref ? 'disabled' : '';
    if (!ref) return '';
    if (bucket === 'exceptions') return '<div class="confirmation-actions"><button type="button" disabled>Exception locked</button></div>';
    if (bucket === 'confirmed') return '<div class="confirmation-actions"><button type="button" disabled>Already confirmed</button></div>';
    if (verify(row) !== 'VERIFIED') return `<div class="confirmation-actions"><button type="button" onclick="window.saveConfirmationStatus('${esc(ref)}','PAYMENT_PROCESSING')" ${disabled}>Save processing</button><button type="button" disabled>Confirm locked</button></div>`;
    return `<div class="confirmation-actions"><button type="button" class="primary" onclick="window.saveConfirmationStatus('${esc(ref)}','CONFIRMED')" ${disabled}>Save final confirmation</button></div>`;
  }

  function card(row, index) {
    const ref = field(row, ['booking_reference', 'reference', 'booking_code', 'code']);
    const guest = field(row, ['guest_name', 'name', 'full_name', 'guestName']);
    const stay = `${field(row, ['check_in', 'checkIn', 'arrival_date', 'arrivalDate']) || '—'} → ${field(row, ['check_out', 'checkOut', 'departure_date', 'departureDate']) || '—'}`;
    return `<article class="confirmation-card"><div class="confirmation-card__top"><div><strong>${esc(ref)}</strong><span>${esc(guest)}</span></div><button class="r360-view" type="button" onclick="window.openReservation360(${index})">View 360</button></div><div class="confirmation-card__grid"><div><span>Stay</span>${esc(stay)}</div><div><span>Provider</span>${esc(provider(row))}</div><div><span>Payment</span>${pill(pay(row))}</div><div><span>Verification</span>${pill(verify(row))}</div><div><span>Balance</span>${peso(field(row, ['balance_amount_php']))}</div><div><span>Status</span>${pill(booking(row))}</div></div><p>${esc(nextAction(row))}</p>${actionButtons(row)}</article>`;
  }

  async function saveStatus(reference, nextStatus) {
    if (!reference || !nextStatus) return;
    if (nextStatus === 'CONFIRMED' && !window.confirm(`Save final confirmation for ${reference}? This persists the booking status and may notify the guest if notifications are configured.`)) return;
    savingReference = reference;
    renderWorkflow(rowsCache);
    try {
      const headers = typeof window.headers === 'function' ? window.headers() : {};
      const response = await fetch('/api/admin?action=booking-status', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, nextStatus })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Unable to save admin status action.');
      if (typeof window.setMessage === 'function') window.setMessage(`${reference} saved as ${nextStatus}. Refreshing admin records...`);
      if (typeof window.loadData === 'function') await window.loadData();
    } catch (error) {
      if (typeof window.setMessage === 'function') window.setMessage(error.message, 'error');
    } finally {
      savingReference = '';
      renderWorkflow(rowsCache);
    }
  }

  function ensureShell() {
    if (document.getElementById('confirmation-workflow')) return;
    const style = document.createElement('style');
    style.textContent = '.confirmation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.confirmation-column{border:1px solid rgba(229,224,216,.88);border-radius:22px;background:rgba(255,253,248,.78);box-shadow:var(--shadow);padding:16px;min-width:0}.confirmation-column h3{margin:0 0 6px;font-size:13px;color:var(--teak)}.confirmation-column>p{margin:0 0 12px;color:var(--muted);font-size:12px;line-height:1.5}.confirmation-list{display:grid;gap:10px}.confirmation-card{border:1px solid var(--linen);border-radius:18px;background:rgba(255,253,248,.88);padding:14px;overflow-wrap:anywhere}.confirmation-card__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.confirmation-card__top span{display:block;margin-top:2px;color:var(--muted);font-size:12px}.confirmation-card__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;color:var(--muted);font-size:12px}.confirmation-card__grid span{display:block;color:var(--brass);font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.confirmation-card p,.confirmation-policy{border-radius:12px;background:var(--sand);padding:10px;color:var(--muted);font-size:12px;line-height:1.45}.confirmation-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.confirmation-actions button{min-height:38px}.confirmation-policy{margin-bottom:14px;border:1px dashed rgba(184,151,126,.42)}.r360-workflow-note{margin-bottom:12px;border:1px solid rgba(184,151,126,.35);background:rgba(239,231,218,.58);border-radius:16px;padding:14px;color:#6A645B;line-height:1.5}.r360-workflow-note strong{display:block;color:#17130F;margin-bottom:6px}@media(max-width:760px){.confirmation-grid,.confirmation-card__grid{grid-template-columns:1fr}.confirmation-card__top{display:grid}.confirmation-card__top .r360-view,.confirmation-actions button{width:100%}}';
    document.head.appendChild(style);
    const anchor = document.getElementById('today-lists') || document.getElementById('summary');
    if (!anchor) return;
    const section = document.createElement('section');
    section.id = 'confirmation-workflow';
    section.innerHTML = '<div class="section-head"><div><h2>Payment Review → Confirmation Workflow</h2><p>Review-first workflow with real saved status actions. Final confirmation is locked until payment is VERIFIED and no exception is present.</p></div><div class="section-actions"><button type="button" class="ghost" onclick="setMessage(\'Workflow actions use the reviewed admin booking-status endpoint. They do not touch booking prices, public booking UI, PayPal, Xendit, or webhook logic.\')">Workflow safety</button></div></div><div class="confirmation-policy"><strong>Confirmation policy:</strong> VERIFIED payment can be finally confirmed only after staff review. Exceptions cannot be confirmed. Saved actions persist booking status in the admin backend.</div><div class="confirmation-grid" id="confirmationWorkflowGrid"></div>';
    anchor.insertAdjacentElement('afterend', section);
  }

  function renderWorkflow(rows) {
    ensureShell();
    const grid = document.getElementById('confirmationWorkflowGrid');
    if (!grid) return;
    const labels = { awaiting: ['Awaiting payment', 'No verified deposit yet.'], processing: ['Payment processing', 'Provider or session exists; wait for verification.'], verified: ['Payment verified / availability review', 'Verified payment still needs staff review.'], ready: ['Confirmation ready', 'Ready for manual final confirmation.'], confirmed: ['Confirmed reservations', 'Final or confirmed operational rows.'], exceptions: ['Payment exceptions', 'Do not confirm until resolved.'] };
    const buckets = Object.fromEntries(Object.keys(labels).map((key) => [key, []]));
    (rows || []).forEach((row, index) => buckets[group(row)].push({ row, index }));
    grid.innerHTML = Object.entries(labels).map(([key, [title, help]]) => `<div class="confirmation-column"><h3>${esc(title)} · ${buckets[key].length}</h3><p>${esc(help)}</p><div class="confirmation-list">${buckets[key].length ? buckets[key].map(({ row, index }) => card(row, index)).join('') : '<div class="empty-state">No matching loaded records.</div>'}</div></div>`).join('');
  }

  function decorateDrawer(row) {
    const body = document.getElementById('r360Body');
    if (!row || !body || body.querySelector('.r360-workflow-note')) return;
    const note = document.createElement('div');
    note.className = 'r360-workflow-note';
    note.innerHTML = `<strong>Confirmation workflow guidance</strong>${esc(nextAction(row))}<br><br><strong>Final confirmation:</strong> ${esc(confirmAllowed(row))}`;
    body.prepend(note);
  }

  window.saveConfirmationStatus = saveStatus;
  const oldToday = window.renderTodayCommand;
  if (typeof oldToday === 'function') window.renderTodayCommand = function (rows, notifications) { rowsCache = rows || []; const out = oldToday.apply(this, arguments); renderWorkflow(rowsCache); return out; };
  const oldRows = window.renderRows;
  if (typeof oldRows === 'function') window.renderRows = function (rows) { rowsCache = rows || []; const out = oldRows.apply(this, arguments); renderWorkflow(rowsCache); return out; };
  const oldOpen = window.openReservation360;
  if (typeof oldOpen === 'function') window.openReservation360 = function (index) { const row = rowsCache[index]; const out = oldOpen.apply(this, arguments); setTimeout(() => decorateDrawer(row), 0); return out; };

  ensureShell();
  renderWorkflow(rowsCache);
  if (typeof window.loadData === 'function') window.loadData();
})();
