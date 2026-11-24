import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ownerHandler from '../lib/owner-handler.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('owner office keeps the no-passcode preview for a public site, but not while the site is private',()=>{
 const app=source('src/owner/OwnerApp.jsx');
 const preview=source('src/owner/PublicPreview.jsx');
 assert.match(app,/useState\(\(\)=>window\.location\.hash\.includes\('access_token='\)\?'login':'checking'\)/);
 assert.match(app,/isPrivateSiteBlock\(error\)\?'login':'preview'/);
 assert.match(app,/return <PublicPreview onConnectPrivateData=/);
 assert.match(app,/Opening the private office/);
 assert.match(preview,/Preview mode · No passcode/);
 assert.match(preview,/No live records disclosed/);
 assert.match(preview,/Private data not shown in preview/);
 assert.doesNotMatch(preview,/fetch\(|ownerRequest\(|localStorage|sessionStorage|PLP_STAFF_CODE|SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(preview,/onConnectPrivateData/);
});
test('private owner reports still return 401 without signed session',async()=>{
 const keys=['PLP_OWNER_EMAIL','PLP_OWNER_SESSION_SECRET','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
 const original=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 Object.assign(process.env,{PLP_OWNER_EMAIL:'owner@example.test',PLP_OWNER_SESSION_SECRET:'x'.repeat(64),SUPABASE_URL:'https://jcyqixttuebxqqfkjonq.supabase.co',SUPABASE_ANON_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test'});
 try{
   for(const operation of ['summary','behavior','me']){
     const res={headers:{},setHeader(k,v){this.headers[k]=v},end(json){this.body=JSON.parse(json)}};
     await ownerHandler({method:'GET',headers:{},query:{operation,month:'2026-11'}},res);
     assert.equal(res.statusCode,401,operation);
     assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
     assert.ok(!('metrics' in res.body),operation);
     assert.ok(!('websiteBookings' in res.body),operation);
   }
 }finally{for(const [key,value] of Object.entries(original)){if(value===undefined)delete process.env[key];else process.env[key]=value}}
});
test('preview retains noindex and no live owner source exports',()=>{
 const html=source('owner.html');
 assert.match(html,/noindex,nofollow,noarchive/);
 const preview=source('src/owner/PublicPreview.jsx');
 assert.doesNotMatch(preview,/import.*owner-summary|import.*owner-handler|fetch\(/);
});
