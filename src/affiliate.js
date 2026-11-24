const status = document.getElementById('status');
const app = document.getElementById('app');
const loading = document.getElementById('loading');
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let enrollment = {};
let demo = false;
let period = 30;

async function request(view, body) {
  const response = await fetch('/api/plp?action=affiliate&view=' + encodeURIComponent(view), {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw Object.assign(new Error(data.error || 'The partner portal is unavailable.'), { status: response.status });
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
  period = 30;
  render({
    partner:{name:'Demo Partner',referral_code:'demo-preview',status:'active',tier:'referral',rate:0.10,rate_approval_status:'pending_owner_approval'},
    referrals:[{reference:'DEMO-1003',status:'PENDING',check_in:'2027-01-15',check_out:'2027-01-17',created_at:'2026-11-24'},{reference:'DEMO-1002',status:'COMPLETED',check_in:'2026-11-17',check_out:'2026-11-19',created_at:'2026-11-10'},{reference:'DEMO-1001',status:'COMPLETED',check_in:'2026-11-10',check_out:'2026-11-12',created_at:'2026-11-01'}],
    enquiries:[{status:'NEW',created_at:'2026-11-24'},{status:'CONTACTED',created_at:'2026-11-22'},{status:'QUOTED',created_at:'2026-11-19'},{status:'BOOKED',created_at:'2026-11-10'},{status:'BOOKED',created_at:'2026-11-01'},{status:'LOST',created_at:'2026-11-04'}],
    commissions:[{commission_type:'referral',commission_amount:200,currency:'USD',status:'approved',created_at:'2026-11-20'},{commission_type:'referral',commission_amount:200,currency:'USD',status:'paid',created_at:'2026-11-13'}],
    payouts:[{amount:200,currency:'USD',payout_reference:'DEMO-PAYOUT-001',status:'recorded',created_at:'2026-11-14'}],commissionsActive:false
  });
}
function authShell(content) {
  return '<div class="auth"><section class="auth-brand">'+brand()+'<div><p class="eyebrow">PLP Boracay</p><h1>Exceptional stays.<br>Meaningful partnerships.</h1><p>A dedicated workspace for our travel, creator and referral partners.</p></div><footer>Pueblo La Perla · Partner relations</footer></section><main class="auth-main"><div class="auth-form">'+content+'</div></main></div>';
}
function signup(message = '') {
  demo = false;
  period = 30;
  show(message, Boolean(message));
  app.innerHTML = authShell('<p class="eyebrow">Partner access</p><h2>Welcome to PLP.</h2><p class="muted">Create your account or sign in with your email. No invitation required.</p><form id="enroll"><label>Name <input name="name" autocomplete="name" maxlength="120" placeholder="Your name (new partners)"></label><label>Email address <input name="email" type="email" autocomplete="email" maxlength="180" placeholder="you@example.com" required></label><label>Partner type <select name="tier"><option value="referral">Referral partner</option><option value="travel_agent">Travel agent</option><option value="influencer">Creator / influencer</option></select></label><button class="button" type="submit">Send sign-in email</button></form><div class="auth-divider"><button class="button secondary" type="button" id="demo">Explore test dashboard</button><small>Demo data is illustrative only. Real rates are pending approval and the resort website remains private.</small></div>');
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
  show('Check your email for the secure sign-in link or verification code.');
  app.innerHTML = authShell('<p class="eyebrow">Secure verification</p><h2>Check your email.</h2><p class="muted">We sent a sign-in email to '+escape(enrollment.email)+'. Copy its secure confirmation link into the field below, or enter your verification code if the email includes one. Keep this page open.</p><form id="verify"><label>Verification link or code <input name="code" autocomplete="one-time-code" spellcheck="false" autocapitalize="off" maxlength="2048" placeholder="Paste the email link or code" required></label><button class="button" type="submit">Open my dashboard</button></form><button class="button secondary" type="button" id="back">Change email</button>');
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
  return '<div class="table-wrap" tabindex="0" role="region" aria-label="Records table"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((cell,index)=>'<td data-label="'+escape(headers[index])+'">'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
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
function panel(title,sub,body,action='',extraClass=''){return '<section class="panel '+extraClass+'"><div class="panel-head"><div><h2>'+escape(title)+'</h2>'+(sub?'<p class="muted">'+escape(sub)+'</p>':'')+'</div>'+action+'</div>'+body+'</section>'}
function metric(name,value,sub,ic){return '<section class="metric"><div class="metric-label"><span>'+escape(name)+'</span>'+icon(ic)+'</div><div class="metric-value">'+escape(value)+'</div><small>'+escape(sub)+'</small></section>'}
function referralTools(partner,link) {
  return panel('Your referral link','A unique link and code attributed to your account.','<div class="linkrow"><input id="partnerLink" aria-label="Referral link" readonly value="'+escape(link)+'"><button class="button" id="copyLink" '+(demo?'disabled':'')+'>Copy link</button></div><div><small>Referral code</small><p class="code">'+escape(partner.referral_code||'—')+'</p></div><p class="muted">'+(demo?'Example only. Copying is disabled in test mode.':'Share after the resort is cleared for public launch.')+'</p>','','referral-feature');
}
function ledgerFilters(rows, kind) {
  const statuses=[...new Set(rows.map(r=>String(r.status||'')))];
  return '<div class="filter"><label for="recordStatus">Status</label><select id="recordStatus"><option value="">All statuses</option>'+statuses.map(s=>'<option value="'+escape(s)+'">'+escape(label(s))+'</option>').join('')+'</select><button type="button" id="exportRecords" class="button secondary">Export CSV</button><small id="recordCount">'+rows.length+' '+(rows.length===1?'record':'records')+'</small></div><div id="ledgerRecords">'+({referrals:referralTable,commissions:commissionTable,payouts:payoutTable}[kind])(rows)+'</div>';
}
function csvCell(value) {
  let s=String(value??'');
  if (/^[\s]*[=+@-]|^[\t\r\n]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
function downloadRecords(rows,kind){
  const columns={referrals:['reference','status','check_in','check_out','created_at'],commissions:['commission_type','commission_amount','currency','status','created_at'],payouts:['payout_reference','amount','currency','status','created_at']}[kind];
  const content=[columns.map(csvCell).join(','),...rows.map(r=>columns.map(k=>csvCell(r[k])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='plp-'+(demo?'DEMO-':'')+kind+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function reportWindow(rows, days, now) {
  const end = new Date(now); end.setUTCHours(0,0,0,0); end.setUTCDate(end.getUTCDate()+1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate()-days);
  return rows.filter(row=>{const t=Date.parse(row.created_at);return Number.isFinite(t)&&t>=start.getTime()&&t<end.getTime()});
}
function reportBounds(days, now) {
  const end=new Date(now);end.setUTCHours(0,0,0,0);
  const start=new Date(end);start.setUTCDate(start.getUTCDate()-days+1);
  const fmt=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(d);
  return fmt(start)+' – '+fmt(end)+' · UTC';
}
function activitySeries(referrals,enquiries,days,now) {
  const end=new Date(now);end.setUTCHours(0,0,0,0);end.setUTCDate(end.getUTCDate()+1);
  const start=end.getTime()-days*86400000;
  const bucketCount=Math.min(6,days);
  const buckets=Array.from({length:bucketCount},(_,i)=>{
    const a=start+Math.floor(i*days/bucketCount)*86400000;
    const b=start+Math.floor((i+1)*days/bucketCount)*86400000;
    const count=rows=>rows.filter(r=>{const t=Date.parse(r.created_at);return t>=a&&t<b}).length;
    const fmt=t=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(t);
    return {label:fmt(a),range:fmt(a)+' – '+fmt(b-86400000),bookings:count(referrals),enquiries:enquiries===null?null:count(enquiries)};
  });
  return buckets;
}
function activityChart(referrals,enquiries,days,now) {
  const buckets=activitySeries(referrals,enquiries,days,now);
  const peak=Math.max(1,...buckets.flatMap(b=>[b.bookings,b.enquiries||0]));
  const ceiling=Math.max(4,Math.ceil(peak/4)*4);
  const columns=buckets.map(b=>'<div class="activity-column" aria-label="'+escape(b.range+': '+b.bookings+' bookings'+(b.enquiries===null?'':', '+b.enquiries+' enquiries'))+'"><div class="activity-bars"><span class="activity-bar enquiries" title="'+escape(b.range+': '+(b.enquiries??'Unavailable')+' enquiries')+'" style="height:'+((b.enquiries||0)/ceiling*100)+'%"></span><span class="activity-bar bookings" title="'+escape(b.range+': '+b.bookings+' bookings')+'" style="height:'+(b.bookings/ceiling*100)+'%"></span></div><span class="axis-label">'+escape(b.label)+'</span></div>').join('');
  const ticks=[ceiling,ceiling*3/4,ceiling/2,ceiling/4,0].map(v=>'<span>'+v+'</span>').join('');
  const details='<details class="chart-data"><summary>View chart data</summary>'+table(['Period','Enquiries','Bookings'],buckets.map(b=>[escape(b.range),escape(b.enquiries??'Unavailable'),escape(b.bookings)]),'')+'</details>';
  return '<div class="chart-legend"><span><i class="legend-swatch enquiries"></i>Enquiries'+(enquiries===null?' (unavailable)':'')+'</span><span><i class="legend-swatch bookings"></i>Bookings</span></div><div class="activity-plot"><div class="chart-axis" aria-hidden="true">'+ticks+'</div><div class="activity-grid">'+columns+'</div></div><p class="chart-foot">Counts by creation date. Enquiries and bookings are separate records.</p>'+details;
}
function enquirySummary(enquiries) {
  if(enquiries===null)return empty('Enquiry activity unavailable','Booking records are still available. Try refreshing later.','referrals');
  const statuses=['NEW','CONTACTED','QUOTED','BOOKED','LOST'];
  return '<div class="pipeline">'+statuses.map(s=>{const n=enquiries.filter(r=>String(r.status).toUpperCase()===s).length;const pct=enquiries.length?Math.round(n/enquiries.length*100):0;return '<div><span>'+escape(label(s))+'</span><strong>'+n+'</strong><div class="pipeline-track '+(s==='BOOKED'?'booked':'')+'" aria-hidden="true"><i style="width:'+pct+'%"></i></div></div>'}).join('')+'</div><small>Guest details remain private.</small>';
}
function rateLabel(partner) {
  return partner.rate_approval_status==='approved'&&Number.isFinite(Number(partner.rate))?String(Number(partner.rate)*100)+'% approved':'Pending approval';
}
function render(data, view = 'overview') {
  if(!Object.hasOwn(views,view))view='overview';
  const partner = data.partner || {};
  const referrals = list(data.referrals), payouts = list(data.payouts), commissions = list(data.commissions);
  const enquiries = Array.isArray(data.enquiries) ? data.enquiries : null;
  const now = demo ? new Date('2026-11-25T12:00:00Z') : new Date();
  const periodReferrals=reportWindow(referrals,period,now), periodEnquiries=enquiries===null?null:reportWindow(enquiries,period,now);
  const link = new URL('/?ref=' + encodeURIComponent(partner.referral_code || ''), location.origin).href;
  const paid=payouts.filter(r=>r.status==='recorded');
  const due=commissions.filter(r=>['approved','payable'].includes(r.status));
  const notice = demo ? '<aside class="notice">'+icon('info')+'<div><strong>TEST DASHBOARD · Sample data</strong>No live referrals, payments or accounts are created. Figures are illustrative and not payable.</div></aside>' : '<aside class="notice">'+icon('info')+'<div><strong>Private pre-launch</strong>'+ (data.commissionsActive?'Commission records are available under approved terms.':'Commission rates are pending owner approval. Earnings are not currently accruing.')+' The resort website remains private.</div></aside>';
  const descriptions={overview:'Partnership activity and financial position.',referrals:'Monitor the bookings attributed to your referral code.',commissions:'Review eligible commission records and their approval status.',payouts:'Track recorded settlement activity.',resources:'Manage your personal referral link and learn how attribution works.',account:'Your partner profile and program status.'};
  let body='';
  if(view==='overview') {
    const available = demo||data.commissionsActive;
    const earnings = available?total(due,'commission_amount'):'—';
    const windowComplete=periodReferrals.filter(r=>String(r.status).toLowerCase()==='completed').length;
    const filter='<div class="report-control"><label for="reportPeriod">Reporting period</label><select id="reportPeriod">'+[7,30,90].map(n=>'<option value="'+n+'" '+(period===n?'selected':'')+'>Last '+n+' days</option>').join('')+'</select></div>';
    const capNote=[referrals,enquiries||[],commissions,payouts].some(rows=>rows.length>=50)?'Results may be incomplete: latest 50 records per ledger.':'Based on latest available records (up to 50 per ledger).';
    body='<section class="partner-brief" aria-label="Financial position and partner details"><div class="brief-financial"><p class="eyebrow">Approved / payable</p><strong class="brief-amount">'+escape(earnings)+'</strong><p>'+escape(demo?'Illustrative · Not payable':available?'Latest approved and payable entries':'Commission posting not active')+'</p><button class="text-button" type="button" data-view="commissions">Commission ledger</button></div><div class="brief-financial"><p class="eyebrow">Recorded payouts</p><strong class="brief-amount">'+escape(total(paid,'amount'))+'</strong><p>'+escape(demo?'Illustrative settlements':'Latest recorded settlements')+'</p><button class="text-button" type="button" data-view="payouts">Payout history</button></div><div class="brief-account"><p class="eyebrow">Partner account</p><strong>'+escape(partner.name||'Partner')+'</strong><small>'+escape(label(partner.tier))+' · '+escape(demo?'Demo account':label(partner.status))+'</small><div class="brief-details"><span>Referral code <strong class="code">'+escape(partner.referral_code||'—')+'</strong></span><span>Rate <strong>'+escape(demo?'Simulation only':rateLabel(partner))+'</strong></span></div></div></section>'
      +'<div class="report-heading"><div><h2>Partner performance</h2><p class="muted">'+escape(reportBounds(period,now))+'</p></div>'+filter+'</div>'
      +'<div class="metric-grid performance-metrics">'+metric('Referred enquiries',periodEnquiries===null?'—':String(periodEnquiries.length),'Enquiries created in period','referrals')+metric('Referred bookings',String(periodReferrals.length),'Bookings created in period','overview')+metric('Completed bookings',String(windowComplete),'Current status of period bookings','commissions')+metric('Recorded payouts',total(reportWindow(paid,period,now),'amount'),'Settlements recorded in period','payouts')+'</div>'
      +'<div class="grid-two performance-grid">'+panel('Referral activity','Enquiries and bookings by date.',activityChart(periodReferrals,periodEnquiries,period,now))+panel('Enquiry status','Current status of enquiries in this period.',enquirySummary(periodEnquiries),'<button class="text-button" type="button" data-view="referrals">Referral records</button>')+'</div>'
      +'<p class="report-caveat">'+escape(capNote)+' Financial position above covers the latest ledger entries, independent of the selected period.</p>'
      +'<div class="grid-two overview-bottom">'+panel('Recent bookings','Latest bookings within this period.',referralTable(periodReferrals.slice(0,5)),'<button class="text-button" type="button" data-view="referrals">View all</button>')+referralTools(partner,link)+'</div>';
  }
  if(view==='referrals')body=panel('Enquiry activity','Latest referred enquiries (up to 50).',enquirySummary(enquiries))+panel('Referral records','Up to 50 most recent bookings.',ledgerFilters(referrals,'referrals'));
  if(view==='commissions')body='<div class="metric-grid">'+metric('Approved / payable',demo||data.commissionsActive?total(due,'commission_amount'):'—','Latest ledger entries','commissions')+metric('Paid commissions',demo||data.commissionsActive?total(commissions.filter(r=>r.status==='paid'),'commission_amount'):'—','Latest paid entries','payouts')+metric('Program status',demo?'Simulation':data.commissionsActive?'Enabled':'Not active',demo?'Not payable':'Owner-controlled posting','info')+'</div>'+panel('Commission ledger','Latest commission records. No payment is initiated here.',ledgerFilters(commissions,'commissions'));
  if(view==='payouts')body='<div class="metric-grid">'+metric('Recorded payouts',total(paid,'amount'),'Latest recorded settlements','payouts')+metric('Settlement records',String(payouts.length),'Latest payout records','overview')+'</div>'+panel('Payout history','Manual settlement records. This page does not initiate payments.',ledgerFilters(payouts,'payouts'));
  if(view==='resources')body=referralTools(partner,link)+panel('How referrals work','Your three-step partner workflow.','<dl class="detail-list"><div><dt>01 · Share</dt><dd>Use your unique link after launch.</dd></div><div><dt>02 · Track</dt><dd>Attributed bookings appear in Referrals.</dd></div><div><dt>03 · Settle</dt><dd>Eligible commissions follow approved terms.</dd></div></dl>');
  if(view==='account')body=panel('Partner profile','Your verified account information.','<dl class="detail-list"><div><dt>Name</dt><dd>'+escape(partner.name)+'</dd></div><div><dt>Partner type</dt><dd>'+escape(label(partner.tier))+'</dd></div><div><dt>Account status</dt><dd>'+pill(partner.status)+'</dd></div><div><dt>Referral code</dt><dd class="code">'+escape(partner.referral_code)+'</dd></div><div><dt>Commission rate</dt><dd>'+(!demo&&partner.rate_approval_status==='approved'&&Number.isFinite(Number(partner.rate))?escape(String(Number(partner.rate)*100)+'%'):'Pending approval')+'</dd></div></dl>');
  show('');
  app.innerHTML='<div class="workspace"><button type="button" class="overlay" aria-label="Close navigation"></button><aside class="sidebar" id="sidebar">'+brand()+'<div><p class="eyebrow navlabel">Workspace</p><nav class="nav" aria-label="Partner navigation">'+Object.entries(views).map(([k,v])=>'<button type="button" data-view="'+k+'" '+(view===k?'aria-current="page"':'')+'>'+icon(k)+escape(v)+'</button>').join('')+'</nav></div><div class="sidebar-foot"><p>'+ (demo?'Test environment · No live records':'Partner workspace · Private pre-launch')+'</p><button class="button secondary" id="logout" type="button">'+icon('logout')+(demo?'Exit demo':'Sign out')+'</button></div></aside><div class="content"><header class="topbar"><div class="topbar-left"><button class="mobile-menu" id="menu" type="button" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">'+icon('menu')+'</button><span>Partner workspace</span></div><div class="topbar-actions">'+(demo?'<span class="pill">Demo mode</span>':pill(partner.status))+'<div class="profile"><span class="avatar" aria-hidden="true">'+escape(String(partner.name||'P').slice(0,1).toUpperCase())+'</span><div><strong>'+escape(partner.name||'Partner')+'</strong><small>'+escape(label(partner.tier))+'</small></div></div></div></header><main class="page" id="main-content" tabindex="-1"><header class="page-head"><div><h1>'+escape(views[view])+'</h1><p class="muted">'+escape(descriptions[view])+'</p></div>'+(view==='overview'?'<button class="button secondary" type="button" data-view="resources">Referral tools</button>':'')+'</header>'+notice+body+'</main></div></div>';
  const workspace=app.querySelector('.workspace'), menu=app.querySelector('#menu');
  function closeMenu(){workspace.classList.remove('menu-open');menu.setAttribute('aria-expanded','false')}
  menu.addEventListener('click',()=>{const open=workspace.classList.toggle('menu-open');menu.setAttribute('aria-expanded',String(open));if(open)app.querySelector('.nav button[aria-current]')?.focus();else menu.focus()});
  app.querySelector('.overlay').addEventListener('click',()=>{closeMenu();menu.focus()});
  workspace.addEventListener('keydown',e=>{if(e.key==='Escape'&&workspace.classList.contains('menu-open')){closeMenu();menu.focus()}if(e.key==='Tab'&&workspace.classList.contains('menu-open')){const buttons=[...app.querySelectorAll('.sidebar button:not(:disabled)')];const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
  app.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{render(data,button.dataset.view);window.scrollTo(0,0);app.querySelector('#main-content').focus({preventScroll:true})}));
  app.querySelector('#reportPeriod')?.addEventListener('change',e=>{const days=Number(e.target.value);if([7,30,90].includes(days)){period=days;render(data,'overview');app.querySelector('#reportPeriod')?.focus({preventScroll:true})}});
  const ledgerRows={referrals,commissions,payouts}[view];
  if(ledgerRows){
    const filtered=()=>{const value=app.querySelector('#recordStatus').value;return ledgerRows.filter(r=>!value||r.status===value)};
    app.querySelector('#recordStatus').addEventListener('change',()=>{const rows=filtered();app.querySelector('#ledgerRecords').innerHTML=({referrals:referralTable,commissions:commissionTable,payouts:payoutTable}[view])(rows);app.querySelector('#recordCount').textContent=rows.length+' '+(rows.length===1?'record':'records')});
    app.querySelector('#exportRecords').addEventListener('click',()=>downloadRecords(filtered(),view));
  }
  app.querySelector('#copyLink')?.addEventListener('click',async()=>{if(demo)return;try{await navigator.clipboard.writeText(link);show('Referral link copied.')}catch{document.getElementById('partnerLink').select()}});
  app.querySelector('#logout').addEventListener('click',async()=>{if(demo)return signup();try{await request('logout',{});signup()}catch(error){show(error.message,true)}});
}
// Referrals &amp; Payouts are represented as separate ledger views for better navigation.
async function start() {
  // A provider email link may return a one-time authenticated browser session.
  // Remove credentials from the address bar before doing anything else.
  const fragment = new URLSearchParams(location.hash.slice(1));
  const accessToken = fragment.get('access_token');
  if (accessToken || fragment.has('refresh_token') || fragment.has('error_description')) {
    history.replaceState(null, '', location.pathname);
    if (!accessToken) return signup('That sign-in link expired. Request another email.');
    try {
      await request('enroll-link', {accessToken});
      render(await request('me'));
    } catch (error) {
      signup(error.message);
    }
    return;
  }
  const invite = new URLSearchParams(location.search).get('invite');
  try {
    if (invite) {
      history.replaceState(null, '', location.pathname);
      await request('accept', { invite, action:'accept' });
    }
    render(await request('me'));
  } catch (error) {
    signup(invite || error.status !== 401 ? error.message : '');
  }
}
start();
