import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOwnerDecision, decideOwnerItem, listActiveOwnerStaff, listOwnerApprovals } from '../lib/owner-workflow.js';
import { readFileSync } from 'node:fs';
const uid='3c674ce1-7ab5-4823-b9ae-062a47c61f12',item='3c674ce1-7ab5-4823-b9ae-062a47c61f13';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const valid={id:item,decision:'approved',assigned_to_label:'Resort Operations',assigned_to_identity:null,due_on:'2026-11-30',notes:'Proceed with approved implementation.'};
test('approval payload requires outcome, assignee and valid due date',()=>{
 const v=validateOwnerDecision(valid);assert.equal(v.decision,'approved');assert.equal(v.assigned_to_label,'Resort Operations');
 assert.throws(()=>validateOwnerDecision({...valid,decision:'maybe'}),TypeError);
 assert.throws(()=>validateOwnerDecision({...valid,assigned_to_label:' '}),TypeError);
 assert.throws(()=>validateOwnerDecision({...valid,due_on:'2026-02-30'}),TypeError);
 assert.throws(()=>validateOwnerDecision({...valid,assigned_to_identity:'not-a-uuid'}),TypeError);
 assert.throws(()=>validateOwnerDecision({...valid,unexpected:true}),TypeError);
});
test('decision RPC always uses verified owner ID and allowlisted arguments',async()=>{
 let seen;const result=await decideOwnerItem(uid,valid,{callRpc:async(name,args)=>{seen={name,args};return {task_id:'task'}}});
 assert.equal(seen.name,'plp_owner_decide_and_assign');assert.equal(seen.args.p_owner_id,uid);
 assert.equal(seen.args.p_item_id,item);assert.equal(seen.args.p_decision,'approved');
 assert.equal(seen.args.p_assigned_to_label,'Resort Operations');assert.equal(result.task_id,'task');
});
test('active staff directory exposes only non-sensitive active identity fields',async()=>{
 let query;const rows=await listActiveOwnerStaff({selectRows:async(table,q)=>{
   query={table,params:new URLSearchParams(q)};return [{id:uid,display_name:'Operations Lead',role:'manager',email_hint:'hidden'}];
 }});
 assert.equal(query.table,'plp_staff_identities');assert.equal(query.params.get('active'),'eq.true');
 assert.deepEqual(rows,[{id:uid,display_name:'Operations Lead',role:'manager'}]);
});
test('approval history is scoped to the verified owner and joined to task audit events',async()=>{
 const seen=[];const rows=await listOwnerApprovals(uid,{selectRows:async(table,q)=>{
   seen.push({table,params:new URLSearchParams(q)});
   if(table==='plp_owner_decision_approvals')return [{id:item,owner_id:uid,task_id:'3c674ce1-7ab5-4823-b9ae-062a47c61f14',decision:'approved'}];
   if(table==='plp_staff_tasks')return [{id:'3c674ce1-7ab5-4823-b9ae-062a47c61f14',status:'open'}];
   return [{task_id:'3c674ce1-7ab5-4823-b9ae-062a47c61f14',action:'created'}];
 }});
 assert.equal(seen[0].params.get('owner_id'),'eq.'+uid);assert.equal(rows[0].task.status,'open');
 assert.equal(rows[0].history[0].action,'created');assert.equal(seen[2].params.get('owner_id'),'eq.'+uid);
});
test('owner approval UI and SQL include due date, assignee and audit trail',()=>{
 const ui=read('src/owner/OwnerWorkItems.jsx'),app=read('src/owner/OwnerApp.jsx'),staff=read('public/staff-tasks.js');
 const sql=read('supabase/migrations/20261122020000_plp_owner_decision_approval_workflow.sql');
 assert.match(ui,/Approve \/ decline & assign task/);assert.match(ui,/type="date"/);
 assert.match(app,/ApprovalHistory/);assert.match(app,/ownerRequest\('decide'/);
 assert.match(staff,/Assigned to/);assert.match(staff,/task\.due_on/);
 assert.match(sql,/enable row level security/g);assert.match(sql,/plp_owner_decide_and_assign/);
 assert.match(sql,/after insert or update on plp_runtime\.plp_staff_tasks/);
 assert.match(sql,/security invoker/);assert.doesNotMatch(sql,/security definer/i);
});
