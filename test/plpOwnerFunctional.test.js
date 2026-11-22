import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateOwnerItem, createOwnerItem, updateOwnerItem, listOwnerItems, ownerItemHistory } from '../lib/owner-workflow.js';
import handler from '../lib/owner-handler.js';
const uid='3c674ce1-7ab5-4823-b9ae-062a47c61f12';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const good={title:'Verify Pearl Club pricing',details:'Owner review pending.',chapter:'boracay',kind:'decision',status:'needs_decision',priority:'high'};
test('owner work item validates allowlisted fields and safe document URLs',()=>{
 const result=validateOwnerItem(good);
 assert.equal(result.title,good.title);assert.equal(result.due_on,null);assert.equal(result.reference_url,null);
 assert.throws(()=>validateOwnerItem({...good,kind:'administrator'}),TypeError);
 assert.throws(()=>validateOwnerItem({...good,foo:'bar'}),TypeError);
 assert.throws(()=>validateOwnerItem({...good,title:'  '}),TypeError);
 assert.throws(()=>validateOwnerItem({...good,reference_url:'javascript:alert(1)'}),TypeError);
 assert.throws(()=>validateOwnerItem({...good,reference_url:'https://user:password@example.com'}),TypeError);
 assert.throws(()=>validateOwnerItem({...good,chapter:'unapproved'}),TypeError);
 assert.throws(()=>validateOwnerItem({...good,due_on:'2026-02-30'}),TypeError);
});
test('private record creation derives owner ID from signed server-side identity',async()=>{
 let seen;const item=await createOwnerItem(uid,{...good},{insertRow:async(table,row)=>{seen={table,row};return {id:'test-item',...row}}});
 assert.equal(seen.table,'plp_owner_items');assert.equal(seen.row.owner_id,uid);assert.equal(seen.row.updated_by,uid);
 assert.equal(item.title,good.title);
});
test('owner update requires the current row version and owner id',async()=>{
 const id='3c674ce1-7ab5-4823-b9ae-062a47c61f13',updated_at='2026-11-22T01:00:00.000Z';
 let observed;const result=await updateOwnerItem(uid,{id,updated_at,status:'reviewed'},{updateRows:async(table,query,patch)=>{
   observed={table,query:new URLSearchParams(query),patch};return [{id,status:patch.status}];
 }});
 assert.equal(observed.table,'plp_owner_items');assert.equal(observed.query.get('id'),'eq.'+id);
 assert.equal(observed.query.get('owner_id'),'eq.'+uid);assert.equal(observed.query.get('updated_at'),'eq.'+updated_at);
 assert.equal(observed.patch.updated_by,uid);assert.equal(result.status,'reviewed');
 await assert.rejects(()=>updateOwnerItem(uid,{id,status:'reviewed'},{updateRows:async()=>[]}),TypeError);
});
test('owner list and audit history always filter on authorized identity',async()=>{
 const rows=await listOwnerItems(uid,{selectRows:async(table,query)=>{
   assert.equal(table,'plp_owner_items');assert.equal(new URLSearchParams(query).get('owner_id'),'eq.'+uid);return [];
 }});
 assert.deepEqual(rows,[]);
 const history=await ownerItemHistory(uid,'3c674ce1-7ab5-4823-b9ae-062a47c61f13',{selectRows:async(table)=>{
   if(table==='plp_owner_items')return [{id:'3c674ce1-7ab5-4823-b9ae-062a47c61f13'}];
   return [{action:'created',new_status:'needs_decision'}];
 }});
 assert.equal(history[0].action,'created');
});
test('private CRUD stays unauthorized on the passcode-free public office',async()=>{
 const keys=['PLP_OWNER_EMAIL','PLP_OWNER_SESSION_SECRET','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
 const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{PLP_OWNER_EMAIL:'owner@example.test',PLP_OWNER_SESSION_SECRET:'x'.repeat(64),SUPABASE_URL:'https://jcyqixttuebxqqfkjonq.supabase.co',SUPABASE_ANON_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test'});
 try{
   const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=JSON.parse(v)}});
   const unauth=res();
   await handler({method:'GET',query:{operation:'items'},headers:{}},unauth);
   assert.equal(unauth.statusCode,401);
   const forged=res();
   await handler({method:'PATCH',query:{operation:'items'},headers:{host:'plp-boracay.vercel.app',origin:'https://evil.example'},body:{}},forged);
   assert.equal(forged.statusCode,403);
 }finally{for(const[k,v]of Object.entries(original)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
});
test('owner office has functional actions and safe public links',()=>{
 const app=read('src/owner/OwnerApp.jsx');
 assert.match(app,/onCreate=\{createItem\}/);
 assert.match(app,/OwnerReports month=\{month\}/);
 assert.match(app,/ownerRequest\('items',\{method:'POST'/);
 assert.match(app,/ownerRequest\('me'\)\.then/);
 const pub=read('src/owner/PublicOfficeActions.jsx');
 assert.match(pub,/\/api\/plp\?action=club&operation=activities/);
 assert.doesNotMatch(pub,/SUPABASE_SERVICE_ROLE_KEY|PLP_OWNER_SESSION_SECRET|ownerRequest\('summary'/);
 const report=read('src/owner/OwnerReports.jsx');
 assert.match(report,/Prevent spreadsheet formula execution/);
 assert.match(report,/Monthly booking report/);
 const schema=read('supabase/migrations/20261122004907_plp_owner_private_work_items_v1.sql');
 assert.match(schema,/enable row level security/g);
 assert.match(schema,/revoke all on plp_runtime\.plp_owner_items from public, anon, authenticated/);
});
