const status = document.getElementById('status');
const app = document.getElementById('app');
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let enrollment = {};
let demo = false;

async function request(view, body) {
  const response = await fetch('/api/plp?action=affiliate&view=' + encodeURIComponent(view), {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || 'The partner portal is unavailable.');
  return data;
}
function show(message = '', error = false) {
  status.hidden = !message;
  status.className = error ? 'error' : '';
  status.textContent = message;
  app.hidden = false;
}
function demoDashboard() {
  demo = true;
  render({partner:{name:'Demo partner',referral_code:'demo-preview',status:'active',tier:'referral'}, referrals:[],payouts:[],commissions:[],commissionsActive:false});
}
function signup(message = '') {
  demo = false;
  show(message, Boolean(message));
  app.innerHTML = `
    <p>Join the PLP partner program or return to your dashboard. Verify your email to activate your account immediately. No invitation or manual approval is required.</p>
    <form id="enroll" class="enroll">
      <label>Name <input name="name" autocomplete="name" maxlength="120" placeholder="Your name (new partners)"></label>
      <label>Email <input name="email" type="email" autocomplete="email" maxlength="180" required></label>
      <label>Partner type <select name="tier"><option value="referral">Referral partner</option><option value="travel_agent">Travel agent</option><option value="influencer">Creator / influencer</option></select></label>
      <button type="submit">Send verification code</button>
    </form>
    <p>Commission rates are pending owner approval. The resort website is still private.</p>
    <button type="button" id="demo">Explore test dashboard</button>
    <p>Test mode uses sample data only and never creates a real affiliate or payable commission.</p>`;
  app.querySelector('#demo').addEventListener('click', demoDashboard);
  app.querySelector('#enroll').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    enrollment = Object.fromEntries(new FormData(form));
    const button = form.querySelector('button');
    button.disabled = true;
    try { await request('enroll-start', enrollment); verifyForm(); }
    catch (error) { show(error.message, true); }
    finally { button.disabled = false; }
  });
}
function verifyForm() {
  show('Check your email for the verification code.');
  app.innerHTML = `<form id="verify" class="enroll"><label>Verification code <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" required></label><button type="submit">Open my dashboard</button></form><button type="button" id="back">Change email</button>`;
  app.querySelector('#back').addEventListener('click', () => signup());
  app.querySelector('#verify').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await request('enroll-verify', {...enrollment, code:new FormData(form).get('code')});
      enrollment = {};
      render(await request('me'));
    } catch (error) { show(error.message, true); }
    finally { button.disabled = false; }
  });
}

function render(data, view = 'overview') {
  const partner = data.partner || {};
  const referrals = Array.isArray(data.referrals) ? data.referrals : [];
  const payouts = Array.isArray(data.payouts) ? data.payouts : [];
  const link = new URL('/?ref=' + encodeURIComponent(partner.referral_code || ''), location.origin).href;
  show(demo ? 'TEST DASHBOARD — sample data only. No live referrals, payments or accounts.' : '');
  app.innerHTML = `
    <div class="bar"><p>${escape(partner.name)} · ${escape(partner.status)}${demo ? ' (demo)' : ''}</p><button type="button" id="logout">${demo ? 'Exit demo' : 'Sign out'}</button></div>
    <nav class="bar" aria-label="Partner views">
      <button type="button" data-view="overview" ${view === 'overview' ? 'aria-current="page"' : ''}>Overview</button>
      <button type="button" data-view="referrals" ${view === 'referrals' ? 'aria-current="page"' : ''}>Referrals &amp; Payouts</button>
    </nav>
    ${view === 'overview' ? `
      <div class="metrics"><article><span>Referred stays</span><h2>${referrals.length}</h2></article><article><span>Recorded payouts</span><h2>${payouts.length}</h2></article><article><span>Commissions</span><h2>${data.commissionsActive ? 'Enabled' : 'Off'}</h2></article></div>
      <h2>Your referral link</h2>
      <p>${demo ? 'Example referral link only; copying is disabled in test mode.' : 'Share this link when PLP is cleared to launch. The resort site remains private. Rates are pending owner approval.'}</p>
      <div class="bar"><input id="partnerLink" aria-label="Referral link" readonly value="${escape(link)}" /><button type="button" id="copyLink" ${demo ? 'disabled' : ''}>Copy link</button></div>
      <p>Referral code: ${escape(partner.referral_code)}</p>
    ` : `
      <h2>Referrals &amp; Payouts</h2>
      <p>${data.commissionsActive ? 'Commission amounts appear after a completed, paid stay.' : 'Commission calculation is off. You can still see referred stays and recorded payouts.'}</p>
      <h3>Referred stays</h3>
      ${referrals.length ? referrals.map(row => `<article><h3>${escape(row.reference)}</h3><p>${escape(row.status)} · ${escape(row.check_in)} to ${escape(row.check_out)}</p></article>`).join('') : '<p>No referred stays yet.</p>'}
      <h3>Recorded payouts</h3>
      ${payouts.length ? payouts.map(row => `<article><h3>${escape(row.currency)} ${escape(row.amount)}</h3><p>${escape(row.payout_reference || 'Recorded payout')} · ${escape(String(row.created_at || '').slice(0,10))}</p></article>`).join('') : '<p>No payouts recorded.</p>'}
    `}`;
  app.querySelectorAll('nav button').forEach(button => button.addEventListener('click', () => render(data, button.dataset.view)));
  app.querySelector('#copyLink')?.addEventListener('click', async () => {
    if (demo) return;
    try { await navigator.clipboard.writeText(link); show('Referral link copied.'); }
    catch { document.getElementById('partnerLink').select(); }
  });
  app.querySelector('#logout').addEventListener('click', async () => {
    if (demo) return signup();
    try { await request('logout', {}); signup(); } catch (error) { show(error.message, true); }
  });
}
async function start() {
  const invite = new URLSearchParams(location.search).get('invite');
  try {
    if (invite) {
      history.replaceState(null, '', location.pathname);
      await request('accept', { invite, action:'accept' });
    }
    render(await request('me'));
  } catch (error) {
    signup(invite ? error.message : '');
  }
}
start();
