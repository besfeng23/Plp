import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ownerConfigured, ownerOriginAllowed, signOwnerSession, verifyOwnerSession, readOwnerCookie, ownerCookie, validateOwnerBearer, validateCurrentOwner } from '../lib/owner-auth.js';
import { ownerMonth, ownerSummary } from '../lib/owner-summary.js';
import ownerHandler from '../lib/owner-handler.js';

const uuid='3c674ce1-7ab5-4823-b9ae-062a47c61f12';
const env={PLP_OWNER_EMAIL:'fongramos@yahoo.com',PLP_OWNER_SESSION_SECRET:'a'.repeat(64),SUPABASE_URL:'https://jcyqixttuebxqqfkjonq.supabase.co',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-server-role'};
const good={id:uuid,email:'fongramos@yahoo.com',email_confirmed_at:'2026-11-22T00:00:00Z',is_anonymous:false};
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v},end(s){this.body=JSON.parse(s)}}}
test('owner sessions are signed, bounded, HttpOnly, and cannot be forged from a staff code',()=>{
 assert.equal(ownerConfigured(env),true);
 const now=Date.parse('2026-11-22T00:00:00Z');
 const token=signOwnerSession(uuid,env.PLP_OWNER_SESSION_SECRET,now);
 assert.equal(verifyOwnerSession(token,env.PLP_OWNER_SESSION_SECRET,now)?.uid,uuid);
 assert.equal(verifyOwnerSession(token,env.PLP_OWNER_SESSION_SECRET,now+6*3600*1000+1000),null);
 assert.equal(verifyOwnerSession(token.replace(/.$/,'Z'),env.PLP_OWNER_SESSION_SECRET,now),null);
 assert.equal(verifyOwnerSession(token,'b'.repeat(64),now),null);
 assert.match(ownerCookie(uuid,env),/HttpOnly; Secure; SameSite=Strict/);
 assert.equal(readOwnerCookie({headers:{cookie:'PLP_STAFF_CODE=test'}},env),null);
 assert.equal(ownerConfigured({...env,PLP_OWNER_SESSION_SECRET:'weak'}),false);
});
test('email identity requires confirmed exact owner account, not Supabase metadata or any other email',async()=>{
 const readUser=async (url,options)=>({ok:true,json:async()=>good});
 assert.equal((await validateOwnerBearer('t'.repeat(50),env,readUser))?.id,uuid);
 assert.equal((await validateCurrentOwner(uuid,env,readUser))?.id,uuid);
 assert.equal(await validateOwnerBearer('t'.repeat(50),env,async()=>({ok:true,json:async()=>({...good,email:'another@example.test'})})),null);
 assert.equal(await validateOwnerBearer('t'.repeat(50),env,async()=>({ok:true,json:async()=>({...good,email_confirmed_at:null})})),null);
 assert.equal(await validateOwnerBearer('t'.repeat(50),env,async()=>({ok:false,status:403,json:async()=>({})})),null);
});
test('cross-site owner POSTs are forbidden',()=>{
 assert.equal(ownerOriginAllowed({headers:{host:'plp-boracay.vercel.app',origin:'https://plp-boracay.vercel.app'}}),true);
 assert.equal(ownerOriginAllowed({headers:{host:'plp-boracay.vercel.app',origin:'https://evil.test'}}),false);
 assert.equal(ownerOriginAllowed({headers:{host:'plp-boracay.vercel.app',origin:'null'}}),false);
 assert.equal(ownerOriginAllowed({headers:{host:'some-preview.vercel.app',origin:'https://some-preview.vercel.app'}}),false);
});
test('unconfigured or unauthenticated owner endpoints reveal no business data',async()=>{
 const old=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
 try {
   Object.assign(process.env,env);
   const res=response();
   await ownerHandler({method:'GET',headers:{},query:{action:'summary',month:'2026-11'}},res);
   assert.equal(res.statusCode,401);assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
   assert.ok(!('club' in res.body));
   const cross=response();
   await ownerHandler({method:'POST',headers:{host:'plp-boracay.vercel.app',origin:'https://attacker.test'},query:{action:'login'},body:{}},cross);
   assert.equal(cross.statusCode,403);
 } finally{for(const[k,v]of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('owner reports use verified existing booking, club and task data only',async()=>{
 const summary=await ownerSummary('2026-11',{
  selectRows:async(table)=>table==='plp_staff_tasks'?[{status:'open'},{status:'done'}]:[],
  clubRows:async(table)=>table==='plp_club_members'?[{status:'PENDING'},{status:'ACTIVE'}]:[{status:'PUBLISHED',starts_at:'2099-01-01T00:00:00Z'}],
  now:new Date('2026-11-22T00:00:00Z'),
 });
 assert.equal(summary.websiteBookings.requests,0);
 assert.equal(summary.club.pending,1);assert.equal(summary.club.active,1);assert.equal(summary.club.upcoming,1);
 assert.equal(summary.tasks.open,1);
 assert.equal(summary.accountingConnected,false);
 assert.equal(ownerMonth(new Date('2026-11-21T18:00:00Z')),'2026-11');
});
test('office is distinct from staff and excludes public indexing',()=>{
 const html=read('owner.html'),src=read('src/owner/OwnerApp.jsx'),api=read('api/owner.js');
 const config=JSON.parse(read('vercel.json'));
 assert.match(html,/noindex,nofollow/);
 assert.equal(config.rewrites.find(x=>x.source==='/owner')?.destination,'/owner.html');
 assert.match(read('vite.config.js'),/owner: resolve/);
 assert.match(src,/Website Analytics/);
 assert.doesNotMatch(src,/PLP_STAFF_CODE|X-PLP-Staff-Code|localStorage|sessionStorage|SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(api,/validateCurrentOwner\(ticket.uid,env\)/);
 assert.doesNotMatch(api,/action === 'staff'|PLP_STAFF_CODE/);
});
