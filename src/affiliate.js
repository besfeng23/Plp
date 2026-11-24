const status = document.getElementById('status');
const app = document.getElementById('app');

function originLink(code) {
  return new URL('/?ref=' + encodeURIComponent(code), window.location.origin).href;
}

async function request(view, body) {
  const response = await fetch('/api/plp?action=affiliate&view=' + view, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || 'The partner portal is unavailable.');
  return data;
}

function render(data, view = 'overview') {
  const partner = data.partner || {};
  const link = originLink(partner.referral_code || '');
  status.hidden = true;
  app.hidden = false;
  app.innerHTML = `
    <nav class="bar" aria-label="Partner views">
      <button type="button" data-view="overview" ${view === 'overview' ? 'aria-current="page"' : ''}>Overview</button>
      <button type="button" data-view="referrals" ${view === 'referrals' ? 'aria-current="page"' : ''}>Referrals &amp; Payouts</button>
    </nav>
    ${view === 'overview' ? `
      <h2>Your referral link</h2>
      <p>Share this link. Guests can also type or edit the code on the enquiry and booking forms. Rates stay pending owner approval until Doc signs off.</p>
      <div class="bar"><input id="partnerLink" readonly value="${link}" /><button type="button" id="copyLink">Copy link</button></div>
      <p>${partner.name || ''} · ${partner.referral_code || ''} · ${partner.status || ''}</p>
    ` : `
      <h2>Referrals &amp; Payouts</h2>
      <p>${data.commissionsActive ? 'Commission amounts appear after a completed, paid stay.' : 'Commission calculation is off. You can still see referred stays and recorded payouts.'}</p>
      ${(data.referrals || []).length ? data.referrals.map((row) => `<article><h3>${row.reference}</h3><p>${row.status} · ${row.check_in || ''} to ${row.check_out || ''}</p></article>`).join('') : '<p>No referred stays yet.</p>'}
      ${(data.payouts || []).length ? data.payouts.map((row) => `<article><h3>${row.currency} ${row.amount}</h3><p>${row.payout_reference || 'Recorded payout'} · ${String(row.created_at || '').slice(0, 10)}</p></article>`).join('') : '<p>No payouts recorded.</p>'}
    `}
  `;
  app.querySelectorAll('nav button').forEach((button) => button.addEventListener('click', () => render(data, button.dataset.view)));
  app.querySelector('#copyLink')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); } catch { document.getElementById('partnerLink').select(); }
  });
}

async function start() {
  const invite = new URLSearchParams(location.search).get('invite');
  try {
    if (invite) await request('accept', { invite, action: 'accept' });
    const data = await request('me');
    render(data);
  } catch (error) {
    status.className = 'error';
    status.textContent = error.message;
  }
}

start();
