// PR 2 — Security and exposure fixes (Telegram intentionally out of scope).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=new URL('..',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const OWNER='owner@example.test';
Object.assign(process.env,{PLP_OWNER_EMAIL:OWNER,PLP_OWNER_SESSION_SECRET:'s'.repeat(64),
 SUPABASE_URL:'https://jcyqixttuebxqqfkjonq.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service-role-test',
 PLP_STAFF_CODE:'staff-code-test'});
delete process.env.PLP_SUBSCRIPTION_SESSION_SECRET;
const { default: ownerHandler, resetOwnerThrottles, ownerThrottleAllowed } = await import('../lib/owner-handler.js');
const { default: adminHandler } = await import('../api/admin.js');
const { default: plpHandler } = await import('../api/plp.js');
const { default: paypalHealth } = await import('../api/paypal/health.js');
const { createAccessToken } = await import('../api/subscription/_session.js');

function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.statusCode=c;return this},json(b){this.body=b;return this},end(s){this.body=s?JSON.parse(s):undefined}}}
const origin={host:'plp-boracay.vercel.app',origin:'https://plp-boracay.vercel.app'};

function walk(dir){const out=[];for(const n of readdirSync(dir)){const f=join(dir,n);if(statSync(f).isDirectory())out.push(...walk(f));else out.push(f);}return out;}

test('staff credentials are never persisted in browser storage',()=>{
 const files=[...walk(fileURLToPath(new URL('public',root))),...walk(fileURLToPath(new URL('src',root))),...walk(fileURLToPath(new URL('internal-tools',root)))]
  .filter(f=>/\.(html|js|jsx|mjs)$/.test(f));
 for(const f of files){
  const s=readFileSync(f,'utf8');
  assert.doesNotMatch(s,/(localStorage|sessionStorage)\.(setItem|getItem)\(\s*['"]plp_staff_code/,f);
  assert.doesNotMatch(s,/(localStorage|sessionStorage)\.setItem\([^)]*(staff|code)/i,f);
 }
});

test('unauthenticated internal API calls return 401/403',async()=>{
 for(const action of ['health','operations','content','date-blocks','staff-tasks','concierge-inbox','owner-month']){
  for(const method of ['GET','POST','PATCH']){
   const r=res();await adminHandler({method,query:{action},headers:{}},r);
   assert.equal(r.statusCode,401,action+' '+method);
  }
 }
 const wrong=res();await adminHandler({method:'GET',query:{action:'health'},headers:{'x-plp-staff-code':'nope'}},wrong);
 assert.equal(wrong.statusCode,401);
 for(const operation of ['members','attendance','admin-activities']){
  const r=res();await plpHandler({method:'GET',query:{action:'club',operation},headers:{}},r);
  assert.equal(r.statusCode,403,operation);
 }
 const owner=res();await plpHandler({method:'POST',query:{action:'owner',operation:'items'},headers:origin,body:{}},owner);
 assert.equal(owner.statusCode,401);
});

test('public PayPal health requests reveal no environment configuration',()=>{
 const anon=res();paypalHealth({method:'GET',headers:{}},anon);
 assert.equal(anon.statusCode,401);
 assert.deepEqual(Object.keys(anon.body).sort(),['error','ok']);
 assert.doesNotMatch(JSON.stringify(anon.body),/live|sandbox|hasClient|mode/i);
 const staff=res();paypalHealth({method:'GET',headers:{'x-plp-staff-code':'staff-code-test',host:'plp-boracay.vercel.app'}},staff);
 assert.equal(staff.statusCode,200);assert.ok('mode' in staff.body);
});

test('subscription sessions never fall back to the service-role key',()=>{
 assert.throws(()=>createAccessToken('I-TEST123'),/not configured/);
 assert.doesNotMatch(read('api/subscription/_session.js'),/SUPABASE_SERVICE_ROLE_KEY/);
});

test('unauthorized email addresses cannot trigger owner login and OTP is rate limited',async()=>{
 resetOwnerThrottles();
 const sent=[];const realFetch=globalThis.fetch;
 globalThis.fetch=async(url,opts={})=>{sent.push({url:String(url),body:opts.body?JSON.parse(opts.body):null});return {ok:true,status:200,json:async()=>({})};};
 try{
  const attacker=res();await ownerHandler({method:'POST',query:{operation:'login'},headers:origin,body:{email:'attacker@evil.test'}},attacker);
  assert.equal(attacker.statusCode,202,'same reply as a real owner: no enumeration');
  assert.equal(sent.length,0,'a non-owner address never receives a link');
  resetOwnerThrottles();
  const first=res();await ownerHandler({method:'POST',query:{operation:'login'},headers:origin,body:{}},first);
  assert.equal(first.statusCode,202);
  assert.equal(sent.length,1);assert.equal(sent[0].body.email,OWNER);
  const second=res();await ownerHandler({method:'POST',query:{operation:'login'},headers:origin,body:{}},second);
  assert.equal(second.statusCode,429);assert.equal(sent.length,1,'throttled request never reaches Supabase');
  const cross=res();await ownerHandler({method:'POST',query:{operation:'login'},headers:{...origin,origin:'https://evil.test'},body:{}},cross);
  assert.equal(cross.statusCode,403);
 }finally{globalThis.fetch=realFetch;resetOwnerThrottles();}
 // Window behaviour: 60 s gap, at most 5 links per hour.
 const t0=Date.parse('2026-11-23T00:00:00Z');
 for(let i=0;i<5;i++)assert.equal(ownerThrottleAllowed('login',t0+i*61000),true);
 assert.equal(ownerThrottleAllowed('login',t0+6*61000),false);
 assert.equal(ownerThrottleAllowed('login',t0+3600*1000+5*61000),true);
 resetOwnerThrottles();
 for(let i=0;i<10;i++)assert.equal(ownerThrottleAllowed('verify',t0+i),true);
 assert.equal(ownerThrottleAllowed('verify',t0+11),false);
 resetOwnerThrottles();
});

test('internal tools cannot be accessed anonymously',()=>{
 const config=JSON.parse(read('vercel.json'));
 for(const p of ['content-ops','availability-ops','photo-library']){
  assert.equal(existsSync(new URL('public/'+p+'.html',root)),false,p+' must not be published');
  for(const src of ['/'+p,'/'+p+'.html']){
   const r=config.redirects.find(x=>x.source===src);
   assert.ok(r,src);assert.equal(r.destination,'/admin');assert.equal(r.permanent,false);
  }
 }
 for(const src of ['/admin-ops','/admin-ops.html']){
  const r=config.redirects.find(x=>x.source===src);
  assert.ok(r,src);assert.equal(r.destination,'/admin');assert.equal(r.permanent,false);
 }
 const robots=read('public/robots.txt');
 for(const p of ['/owner','/plp-growth-plan.html','/photo-library.html','/subscribe','/admin','/content-ops.html','/availability-ops.html'])assert.match(robots,new RegExp('Disallow: '+p.replace('.','\\.')));
});

test('unapproved /subscribe page is unpublished while the gate is disabled',async(t)=>{
 const dir=await mkdtemp(join(tmpdir(),'plp-sub-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await mkdir(join(dir,'dist','subscribe'),{recursive:true});
 await writeFile(join(dir,'dist','subscribe','index.html'),'<html><body>PHP 10,000 / month</body></html>');
 const script=fileURLToPath(new URL('scripts/inject-plp-subscription-gate.mjs',root));
 const run=flag=>{const r=spawnSync(process.execPath,[script],{cwd:dir,env:{...process.env,PLP_SUBSCRIPTION_GATE_ENABLED:flag},encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
 run('');
 const page=await readFile(join(dir,'dist','subscribe','index.html'),'utf8');
 assert.match(page,/not available/);assert.match(page,/noindex,nofollow/);assert.doesNotMatch(page,/10,000/);
});

test('public owner preview and sign-in screen show neutral Private Office identity',()=>{
 const preview=read('src/owner/PublicPreview.jsx');
 assert.doesNotMatch(preview,/Marichi|Fong Ramos|Doctora|e-mango/i);
 assert.match(preview,/<strong>Private Office<\/strong>/);
 const app=read('src/owner/OwnerApp.jsx');
 const login=app.slice(app.indexOf('function LogIn('),app.indexOf('function Panel('));
 assert.doesNotMatch(login,/Marichi|Fong Ramos|Doctora/);
});

test('telegram webhook is disabled and never processes a request', async () => {
 const { default: webhook } = await import('../api/telegram/webhook.js');
 for (const method of ['GET', 'POST', 'PUT']) {
  const r = res();
  await webhook({ method, headers: {}, body: { message: { chat: { id: 1 }, from: { id: 1 }, text: '/start' } } }, r);
  assert.equal(r.statusCode, 404, method);
  assert.equal(r.body.ok, false);
 }
 assert.doesNotMatch(read('api/telegram/webhook.js'), /routePlpAgent|isAuthorized|verifySecret/);
});
