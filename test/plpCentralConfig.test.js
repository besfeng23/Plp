// PR 4 — Central configuration and multi-owner access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SITE, ownerEmails, ownerDisplayName, isOwnerEmail } from '../lib/site-config.js';
import { CONCIERGE_EMAIL, CONCIERGE_NUMBER, CONCIERGE_NUMBER_DISPLAY } from '../lib/contact.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const A='first.owner@example.test',B='second.owner@example.test';
const base={PLP_OWNER_SESSION_SECRET:'s'.repeat(64),SUPABASE_URL:'https://jcyqixttuebxqqfkjonq.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'};

test('owner allow-list: PLP_OWNER_EMAILS with legacy PLP_OWNER_EMAIL fallback',()=>{
 assert.deepEqual(ownerEmails({PLP_OWNER_EMAIL:'Legacy@Example.test'}),['legacy@example.test']);
 assert.deepEqual(ownerEmails({PLP_OWNER_EMAILS:`${A}, ${B}`,PLP_OWNER_EMAIL:'legacy@example.test'}),[A,B]);
 assert.deepEqual(ownerEmails({PLP_OWNER_EMAILS:'not-an-email, '+A}),[A]);
 assert.deepEqual(ownerEmails({}),[]);
 const env={PLP_OWNER_EMAILS:`${A},${B}`,PLP_OWNER_DISPLAY_NAMES:`${A}=First Owner;${B}=Second Owner`};
 assert.equal(ownerDisplayName(A,env),'First Owner');assert.equal(ownerDisplayName(B,env),'Second Owner');
 assert.equal(ownerDisplayName('x@example.test',env),'Owner');
 assert.equal(ownerDisplayName(A,{PLP_OWNER_DISPLAY_NAMES:`${A}=<script>`}),'script');
 assert.equal(isOwnerEmail(B.toUpperCase(),env),true);assert.equal(isOwnerEmail('x@example.test',env),false);
});

test('both owner accounts are recognized independently with their own identity',async()=>{
 const env={...base,PLP_OWNER_EMAILS:`${A},${B}`,PLP_OWNER_DISPLAY_NAMES:`${A}=First Owner;${B}=Second Owner`};
 const saved={...process.env};Object.assign(process.env,env);delete process.env.PLP_OWNER_EMAIL;
 const { default: handler, resetOwnerThrottles } = await import('../lib/owner-handler.js');
 const { ownerCookie } = await import('../lib/owner-auth.js');
 const ids={[A]:'3c674ce1-7ab5-4823-b9ae-062a47c61f12',[B]:'3c674ce1-7ab5-4823-b9ae-062a47c61f99'};
 const sent=[];const real=globalThis.fetch;
 globalThis.fetch=async(url,opts={})=>{const u=new URL(String(url));
  if(u.pathname.startsWith('/auth/v1/admin/users/')){const id=u.pathname.split('/').pop();const email=Object.keys(ids).find(k=>ids[k]===id);
   return {ok:Boolean(email),status:email?200:404,json:async()=>({id,email,email_confirmed_at:'2026-11-01T00:00:00Z'})};}
  if(u.pathname==='/auth/v1/otp'){sent.push(JSON.parse(opts.body).email);return {ok:true,status:200,json:async()=>({})};}
  return {ok:false,status:500,json:async()=>({})};};
 const origin={host:'plp-boracay.vercel.app',origin:'https://plp-boracay.vercel.app'};
 const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v},end(s){this.body=JSON.parse(s)}});
 try{
  for(const email of [A,B]){
   const r=res();await handler({method:'GET',query:{operation:'me'},headers:{cookie:ownerCookie(ids[email],process.env)}},r);
   assert.equal(r.statusCode,200);assert.equal(r.body.email,email);
   assert.equal(r.body.name,email===A?'First Owner':'Second Owner');
  }
  // Each owner requests their own link; with two owners an email is required.
  resetOwnerThrottles();
  const none=res();await handler({method:'POST',query:{operation:'login'},headers:origin,body:{}},none);
  assert.equal(none.statusCode,400);
  resetOwnerThrottles();
  const second=res();await handler({method:'POST',query:{operation:'login'},headers:origin,body:{email:B}},second);
  assert.equal(second.statusCode,202);assert.deepEqual(sent,[B]);
  resetOwnerThrottles();
  const outsider=res();await handler({method:'POST',query:{operation:'login'},headers:origin,body:{email:'outsider@example.test'}},outsider);
  assert.equal(outsider.statusCode,202);assert.deepEqual(sent,[B]);
  // A removed owner loses access even with a valid signed cookie.
  process.env.PLP_OWNER_EMAILS=A;
  const removed=res();await handler({method:'GET',query:{operation:'me'},headers:{cookie:ownerCookie(ids[B],process.env)}},removed);
  assert.equal(removed.statusCode,401);
 }finally{globalThis.fetch=real;resetOwnerThrottles();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});

test('no hardcoded owner email or display identity in owner and public files',()=>{
 for(const f of ['lib/owner-handler.js','lib/owner-auth.js','src/owner/OwnerApp.jsx','src/owner/PublicPreview.jsx','src/SeniorLivingView.jsx']){
  const s=read(f);
  assert.doesNotMatch(s,/Marichi|Fong Ramos|fongramos@/i,f);
  if(f.startsWith('lib/'))assert.doesNotMatch(s,/['"][A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}['"]/,f+' has no email literal');
 }
 assert.match(read('src/owner/PublicPreview.jsx'),/<strong>Private Office<\/strong>/);
});

test('contact details come from one source and list Argie as the public sales contact',()=>{
 assert.equal(CONCIERGE_EMAIL,'');
 assert.equal(CONCIERGE_NUMBER,'+639604792247');
 assert.equal(CONCIERGE_NUMBER_DISPLAY,'+63 960 479 2247');
 assert.equal(SITE.conciergeEmail,CONCIERGE_EMAIL);
 assert.deepEqual([...SITE.previousConciergeEmails],['mfr@e-mango.com']);
 assert.deepEqual([...SITE.previousConciergePhones],['+639178872980']);
 assert.equal(SITE.social.facebook,'https://www.facebook.com/PuebloLaPerlaBoracay');
 assert.equal(SITE.social.instagram,'https://www.instagram.com/pueblolaperlaboracay/');
 assert.equal(SITE.social.tiktok,'https://www.tiktok.com/@pueblolaperlaboracay','TikTok confirmed by the owners 23 Nov 2026');
 const ld=JSON.parse(read('index.html').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.ok(!ld.email,'JSON-LD has no public email until a PLP-owned address is issued');
 assert.equal(ld.telephone,SITE.conciergePhone);
 assert.doesNotMatch(read('src/main.jsx'),/mailto:mfr@|e-mango/i);
 assert.doesNotMatch([read('src/App.jsx'),read('src/ConciergeView.jsx'),read('src/ClubView.jsx'),read('booking.html')].join('\n'),/mfr@e-mango|639178872980|917 887 2980/);
 assert.match(read('scripts/prepare-plp-static-pages.mjs'),/syncContactDetails\(html\)/);
});

test('handoff documents exist, cover every system and contain no secrets',()=>{
 const handoff=read('docs/HANDOFF.md');
 for(const s of ['GitHub','Vercel','Supabase','PayPal','Resend','Google Analytics','PostHog','Telegram','Domain'])assert.match(handoff,new RegExp(s),s);
 assert.match(handoff,/Nothing has been transferred/);
 for(const f of ['docs/HANDOFF.md','docs/OWNER_GUIDE.md','docs/OPERATIONS_RUNBOOK.md']){
  const s=read(f);
  assert.doesNotMatch(s,/(sk_live|sk_test|eyJ[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|phc_[A-Za-z0-9]{10,}|phx_[A-Za-z0-9]{10,}|re_[A-Za-z0-9]{16,}|-----BEGIN)/,f);
 }
 assert.match(read('docs/OWNER_GUIDE.md'),/USD 1,000 per night/);
});
