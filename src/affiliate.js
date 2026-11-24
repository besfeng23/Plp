const status = document.getElementById('status');
const app = document.getElementById('app');
const loading = document.getElementById('loading');
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
  loading.hidden = true;
}

const icons = {
  overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  referrals:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  commissions:'<path d="M3 3v18h18M7 15l4-4 4 4 6-8"/><path d="M17 7h4v4"/>',
  payouts:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  resources:'<path d="M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l2-2"/>',
  account:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/>',
  logout:'<path d="M10 17l5-5-5-5M15 12H3M15 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5"/>'
};
const icon = name => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
const brand = () => '<div class="brandline"><img class="brandmark" src="/brand/PLP_Editorial_Vector_Logo.svg" alt="PLP"><div><div class="brandname">Pueblo La Perla</div><div class="brandcaption">Partner program</div></div></div>';
const views = {overview:'Overview',referrals:'Referrals',commissions:'Commissions',payouts:'Payouts',resources:'Referral tools',account:'Account'};
const label = value => String(value || 'Unknown').replace(/[_-]/g,' ').toLowerCase().replace(/\b\w/g,ch=>ch.toUpperCase());
const list = data => Array.isArray(data) ? data : [];
const date = value => value ? escape(String(value).slice(0,10)) : '—';
const pill = value => {
  const s = String(value || 'Unknown').toLowerCase();
  return '<span class="pill '+(['active','approved','paid','payable','completed','recorded','paid_deposit','confirmed'].includes(s)?'good':['declined','paused','cancelled','reversed','failed'].includes(s)?'bad':'')+'">'+escape(label(value))+'</span>';
};
const cash = (amount,currency) => {
  try { return new Intl.NumberFormat('en-US',{style:'currency',currency:String(currency || 'USD'),currencyDisplay:'code',maximumFractionDigits:2}).format(Number(amount)||0); }
  catch { return String(currency || '')+' '+(Number(amount)||0).toFixed(2); }
};
function total(rows,key) {
  const sums = {};
  for (const row of rows) { const n=Number(row[key]); if(Number.isFinite(n)) { const curr=String(row.currency||'USD'); sums[curr]=(sums[curr]||0)+n; } }
  const values=Object.entries(sums).map(([currency,amount])=>cash(amount,currency));
  return values.length===0?'—':values.length===1?values[0]:'Multiple currencies';
}
function demoDashboard() {
  demo = true;
  render({
    partner:{name:'Demo Partner',referral_code:'demo-preview',status:'active',tier:'referral',rate:0.10,rate_approval_status:'pending_owner_approval'},
    referrals:[{reference:'DEMO-1003',status:'PENDING',check_in:'2027-01-15',check_out:'2027-01-17',created_at:'2026-11-24'},{reference:'DEMO-1002',status:'COMPLETED',check_in:'2026-11-17',check_out:'2026-11-19',created_at:'2026-11-10'},{reference:'DEMO-1001',status:'COMPLETED',check_in:'2026-11-10',check_out:'2026-11-12',created_at:'2026-11-01'}],
    commissions:[{commission_type:'referral',commission_amount:200,currency:'USD',status:'approved',created_at:'2026-11-20'},{commission_type:'referral',commission_amount:200,currency:'USD',status:'paid',created_at:'2026-11-13'}],
    payouts:[{amount:200,currency:'USD',payout_reference:'DEMO-PAYOUT-001',status:'recorded',created_at:'2026-11-14'}],commissionsActive:false
  });
}
function authShell(content) {
  return '<div class="auth"><section class="auth-brand">'+brand()+'<div><p class="eyebrow">PLP Boracay</p><h1>Exceptional stays.<br>Meaningful partnerships.</h1><p>A dedicated workspace for our travel, creator and referral partners.</p></div><footer>Pueblo La Perla · Partner relations</footer></section><main class="auth-main"><div class="auth-form">'+content+'</div></main></div>';
}
function signup(message = '') {
  demo = false;
  show(message, Boolean(message));
  app.innerHTML = authShell('<p class="eyebrow">Partner access</p><h2>Welcome to PLP.</h2><p class="muted">Create your account or sign in with your email. No invitation required.</p><form id="enroll"><label>Name <input name="name" autocomplete="name" maxlength="120" placeholder="Your name (new partners)"></label><label>Email address <input name="email" type="email" autocomplete="email" maxlength="180" placeholder="you@example.com" required></label><label>Partner type <select name="tier"><option value="referral">Referral partner</option><option value="travel_agent">Travel agent</option><option value="influencer">Creator / influencer</option></select></label><button class="button" type="submit">Send verification code</button></form><div class="auth-divider"><button class="button secondary" type="button" id="demo">Explore test dashboard</button><small>Demo data is illustrative only. Real rates are pending approval and the resort website remains private.</small></div>');
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
  app.innerHTML = authShell('<p class="eyebrow">Secure verification</p><h2>Check your email.</h2><p class="muted">Enter the code sent to '+escape(enrollment.email)+'.</p><form id="verify"><label>Verification code <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" required></label><button class="button" type="submit">Open my dashboard</button></form><button class="button secondary" type="button" id="back">Change email</button>');
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
function empty(title,body,iconName) {return '<div class="empty">'+icon(iconName)+'<strong>'+escape(title)+'</strong><small>'+escape(body)+'</small></div>'}
function table(headers,rows,emptyMarkup) {
  if(!rows.length)return emptyMarkup;
  return '<div class="table-wrap" tabindex="0" role="region" aria-label="Records table"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function referralTable(rows) {
  return table(['Booking reference','Status','Check-in','Check-out','Recorded'],rows.map(r=>['<span class="code">'+escape(r.reference)+'</span>',pill(r.status),date(r.check_in),date(r.check_out),date(r.created_at)]),empty('No referrals yet','Referred bookings will appear here when recorded.','referrals'));
}
function commissionTable(rows) {
  return table(['Type','Amount','Status','Recorded'],rows.map(r=>[escape(label(r.commission_type)),escape(cash(r.commission_amount,r.currency)),pill(r.status),date(r.created_at)]),empty('No commission records','Commission records will appear once posting is enabled and eligible stays are processed.','commissions'));
}
function payoutTable(rows) {
  return table(['Reference','Amount','Status','Recorded'],rows.map(r=>[escape(r.payout_reference||'—'),escape(cash(r.amount,r.currency)),pill(r.status),date(r.created_at)]),empty('No payouts recorded','Recorded settlements will appear here.','payouts'));
}
function panel(title,sub,body,action=''){return '<section class="panel"><div class="panel-head"><div><h2>'+escape(title)+'</h2>'+(sub?'<p class="muted">'+escape(sub)+'</p>':'')+'</div>'+action+'</div>'+body+'</section>'}
function metric(name,value,sub,ic){return '<section class="metric"><div class="metric-label"><span>'+escape(name)+'</span>'+icon(ic)+'</div><div class="metric-value">'+escape(value)+'</div><small>'+escape(sub)+'</small></section>'}
function referralTools(partner,link) {
  return panel('Your referral link','A unique link and code attributed to your account.','<div class="linkrow"><input id="partnerLink" aria-label="Referral link" readonly value="'+escape(link)+'"><button class="button" id="copyLink" '+(demo?'disabled':'')+'>Copy link</button></div><div><small>Referral code</small><p class="code">'+escape(partner.referral_code||'—')+'</p></div><p class="muted">'+(demo?'Example only. Copying is disabled in test mode.':'Share after the resort is cleared for public launch.')+'</p>');
}
function render(data, view = 'overview') {
  if(!Object.hasOwn(views,view))view='overview';
  const partner = data.partner || {};
  const referrals = list(data.referrals), payouts = list(data.payouts), commissions = list(data.commissions);
  const link = new URL('/?ref=' + encodeURIComponent(partner.referral_code || ''), location.origin).href;
  const paid=payouts.filter(r=>r.status==='recorded');
  const due=commissions.filter(r=>['approved','payable'].includes(r.status));
  const completed=referrals.filter(r=>String(r.status).toLowerCase()==='completed').length;
  const statuses={};for(const row of referrals){const k=label(row.status);statuses[k]=(statuses[k]||0)+1}
  const breakdown=Object.entries(statuses).map(([k,n])=>'<div class="progress-row"><span>'+escape(k)+'</span><strong>'+n+'</strong><div class="track"><span style="width:'+Math.round(n/referrals.length*100)+'%"></span></div></div>').join('');
  const notice = demo ? '<aside class="notice">'+icon('info')+'<div><strong>TEST DASHBOARD · Sample data</strong>No live referrals, payments or accounts are created. All figures are simulated and not payable.</div></aside>' : '<aside class="notice">'+icon('info')+'<div><strong>Private pre-launch</strong>'+ (data.commissionsActive?'Commission records are available under approved terms.':'Commission rates are pending owner approval. Earnings are not currently accruing.')+' The resort website remains private.</div></aside>';
  const descriptions={overview:'Your partnership performance and account activity.',referrals:'Monitor the bookings attributed to your referral code.',commissions:'Review eligible commission records and their approval status.',payouts:'Track recorded settlement activity.',resources:'Manage your personal referral link and learn how attribution works.',account:'Your partner profile and program status.'};
  const metrics='<div class="metric-grid">'+metric('Referred stays',String(referrals.length),'Latest records (up to 50)','referrals')+metric('Completed stays',String(completed),'Completed among latest records','overview')+metric('Approved / payable',demo||data.commissionsActive?total(due,'commission_amount'):'—',demo?'Simulated commission':'Latest eligible ledger entries','commissions')+metric('Recorded payouts',total(paid,'amount'),demo?'Simulated settlement':'Latest recorded settlements','payouts')+'</div>';
  let body='';
  if(view==='overview')body=metrics+'<div class="grid-two">'+referralTools(partner,link)+panel('Referral breakdown','Status distribution of latest referrals.',breakdown||empty('No referral activity','Your booking statuses will appear here.','referrals'))+'</div>'+panel('Recent referrals','Latest attributed booking records.',referralTable(referrals.slice(0,5)),'<button type="button" class="text-button" data-view="referrals">View all</button>')+panel('Commission &amp; payout activity','Latest ledger records.','<p class="muted">'+(demo?'Explore the simulated commission and payout records.':'Open the commission or payout ledger for details.')+'</p><div class="filter"><button class="button secondary" type="button" data-view="commissions">Commissions</button><button class="button secondary" type="button" data-view="payouts">Payouts</button></div>');
  if(view==='referrals')body=panel('Referral records','Up to 50 most recent bookings.','<div class="filter"><label for="referralFilter">Status</label><select id="referralFilter"><option value="">All statuses</option>'+[...new Set(referrals.map(r=>String(r.status||'')))].map(s=>'<option value="'+escape(s)+'">'+escape(label(s))+'</option>').join('')+'</select></div><div id="referralRecords">'+referralTable(referrals)+'</div>');
  if(view==='commissions')body='<div class="metric-grid">'+metric('Approved / payable',demo||data.commissionsActive?total(due,'commission_amount'):'—','Latest ledger entries','commissions')+metric('Paid commissions',demo||data.commissionsActive?total(commissions.filter(r=>r.status==='paid'),'commission_amount'):'—','Latest paid entries','payouts')+metric('Program status',demo?'Simulation':data.commissionsActive?'Enabled':'Not active',demo?'Not payable':'Owner-controlled posting','info')+'</div>'+panel('Commission ledger','Latest commission records. No payment is initiated here.',commissionTable(commissions));
  if(view==='payouts')body='<div class="metric-grid">'+metric('Recorded payouts',total(paid,'amount'),'Latest recorded settlements','payouts')+metric('Settlement records',String(payouts.length),'Latest payout records','overview')+'</div>'+panel('Payout history','Manual settlement records. This page does not initiate payments.',payoutTable(payouts));
  if(view==='resources')body=referralTools(partner,link)+panel('How referrals work','Your three-step partner workflow.','<dl class="detail-list"><div><dt>01 · Share</dt><dd>Use your unique link after launch.</dd></div><div><dt>02 · Track</dt><dd>Attributed bookings appear in Referrals.</dd></div><div><dt>03 · Settle</dt><dd>Eligible commissions follow approved terms.</dd></div></dl>');
  if(view==='account')body=panel('Partner profile','Your verified account information.','<dl class="detail-list"><div><dt>Name</dt><dd>'+escape(partner.name)+'</dd></div><div><dt>Partner type</dt><dd>'+escape(label(partner.tier))+'</dd></div><div><dt>Account status</dt><dd>'+pill(partner.status)+'</dd></div><div><dt>Referral code</dt><dd class="code">'+escape(partner.referral_code)+'</dd></div><div><dt>Commission rate</dt><dd>'+(!demo&&partner.rate_approval_status==='approved'&&Number.isFinite(Number(partner.rate))?escape(String(Number(partner.rate)*100)+'%'):'Pending approval')+'</dd></div></dl>');
  show('');
  app.innerHTML='<div class="workspace"><button type="button" class="overlay" aria-label="Close navigation"></button><aside class="sidebar" id="sidebar">'+brand()+'<div><p class="eyebrow navlabel">Workspace</p><nav class="nav" aria-label="Partner navigation">'+Object.entries(views).map(([k,v])=>'<button type="button" data-view="'+k+'" '+(view===k?'aria-current="page"':'')+'>'+icon(k)+escape(v)+'</button>').join('')+'</nav></div><div class="sidebar-foot"><p>'+ (demo?'Test environment · No live records':'Partner workspace · Private pre-launch')+'</p><button class="button secondary" id="logout" type="button">'+(demo?'Exit demo':'Sign out')+'</button></div></aside><div class="content"><header class="topbar"><div class="topbar-left"><button class="mobile-menu" id="menu" type="button" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">'+icon('menu')+'</button><span>Partner workspace</span></div><div class="topbar-actions">'+(demo?'<span class="pill">Demo mode</span>':pill(partner.status))+'<div class="profile"><span class="avatar" aria-hidden="true">'+escape(String(partner.name||'P').slice(0,1).toUpperCase())+'</span><div><strong>'+escape(partner.name||'Partner')+'</strong><small>'+escape(label(partner.tier))+'</small></div></div></div></header><main class="page" id="main-content"><header class="page-head"><div><p class="eyebrow">Partner program</p><h1>'+escape(views[view])+'</h1><p class="muted">'+escape(descriptions[view])+'</p></div></header>'+notice+body+'</main></div></div>';
  const workspace=app.querySelector('.workspace'), menu=app.querySelector('#menu');
  function closeMenu(){workspace.classList.remove('menu-open');menu.setAttribute('aria-expanded','false')}
  menu.addEventListener('click',()=>{const open=workspace.classList.toggle('menu-open');menu.setAttribute('aria-expanded',String(open))});
  app.querySelector('.overlay').addEventListener('click',()=>{closeMenu();menu.focus()});
  workspace.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();menu.focus()}});
  app.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{render(data,button.dataset.view);window.scrollTo(0,0)}));
  app.querySelector('#referralFilter')?.addEventListener('change',e=>{app.querySelector('#referralRecords').innerHTML=referralTable(referrals.filter(r=>!e.target.value||r.status===e.target.value))});
  app.querySelector('#copyLink')?.addEventListener('click',async()=>{if(demo)return;try{await navigator.clipboard.writeText(link);show('Referral link copied.')}catch{document.getElementById('partnerLink').select()}});
  app.querySelector('#logout').addEventListener('click',async()=>{if(demo)return signup();try{await request('logout',{});signup()}catch(error){show(error.message,true)}});
}
// Referrals &amp; Payouts are represented as separate ledger views for better navigation.
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
