import { insertRow, selectRows, updateRows, callRpc } from '../api/_supabase.js';

export const OWNER_CHAPTERS = Object.freeze(['boracay','singapore','malaysia','global']);
export const OWNER_KINDS = Object.freeze(['decision','document','note','partner','milestone']);
export const OWNER_STATUSES = Object.freeze(['needs_decision','needs_verification','reviewed','approved','declined','archived']);
const OWNER_PRIORITIES = ['normal','high'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanText(value, max, required = false) {
  if (typeof value !== 'string') throw new TypeError('Expected text');
  const text = value.trim();
  if ((required && !text) || text.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new TypeError('Invalid text');
  return text;
}
function choice(value, options) {
  if (typeof value !== 'string' || !options.includes(value)) throw new TypeError('Invalid choice');
  return value;
}
export function validateOwnerItem(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid item');
  const fields = {};
  const known = new Set(['title','details','chapter','kind','status','priority','due_on','reference_url']);
  if (Object.keys(input).some(key => !known.has(key) && key !== 'id' && key !== 'updated_at')) throw new TypeError('Unrecognized field');
  if (!partial || input.title !== undefined) fields.title = cleanText(input.title,160,true);
  if (!partial || input.details !== undefined) fields.details = cleanText(input.details ?? '',2000);
  if (!partial || input.chapter !== undefined) fields.chapter = choice(input.chapter ?? 'boracay',OWNER_CHAPTERS);
  if (!partial || input.kind !== undefined) fields.kind = choice(input.kind ?? 'decision',OWNER_KINDS);
  if (!partial || input.status !== undefined) fields.status = choice(input.status ?? 'needs_decision',OWNER_STATUSES);
  if (!partial || input.priority !== undefined) fields.priority = choice(input.priority ?? 'normal',OWNER_PRIORITIES);
  if (!partial || input.due_on !== undefined) {
    const value = input.due_on || null;
    if (value !== null && (typeof value !== 'string' || !/^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) throw new TypeError('Invalid due date');
    fields.due_on = value;
  }
  if (!partial || input.reference_url !== undefined) {
    const value = input.reference_url || null;
    if (value !== null) {
      if (typeof value !== 'string' || value.length > 1000 || /[\s<>]/.test(value)) throw new TypeError('Invalid URL');
      try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password) throw new TypeError('Invalid URL');
      } catch { throw new TypeError('Invalid URL'); }
    }
    fields.reference_url = value;
  }
  if (partial && Object.keys(fields).length === 0) throw new TypeError('No changes');
  return fields;
}
export async function listOwnerItems(uid, io = { selectRows }) {
  if (!UUID.test(uid)) throw new TypeError('Invalid owner');
  const q = new URLSearchParams({
    owner_id:'eq.'+uid,
    select:'id,chapter,kind,title,details,status,priority,due_on,reference_url,updated_at,created_at',
    order:'updated_at.desc,id.asc',
    limit:'201',
  });
  const rows = await io.selectRows('plp_owner_items',q.toString());
  if (!Array.isArray(rows) || rows.length > 200) throw new Error('Owner register reading limit');
  return rows;
}
export async function createOwnerItem(uid, payload, io = { insertRow }) {
  if (!UUID.test(uid)) throw new TypeError('Invalid owner');
  const fields = validateOwnerItem(payload);
  return io.insertRow('plp_owner_items',{...fields,owner_id:uid,updated_by:uid});
}
export async function updateOwnerItem(uid, payload, io = { updateRows }) {
  if (!UUID.test(uid) || !UUID.test(payload?.id)) throw new TypeError('Invalid ID');
  const fields = validateOwnerItem(payload,{partial:true});
  const query = new URLSearchParams({id:'eq.'+payload.id,owner_id:'eq.'+uid});
  // Optimistic concurrency prevents silently overwriting another owner edit.
  if (typeof payload.updated_at !== 'string' || !Number.isFinite(Date.parse(payload.updated_at))) throw new TypeError('Missing version');
  query.set('updated_at','eq.'+payload.updated_at);
  const rows = await io.updateRows('plp_owner_items',query.toString(),{
    ...fields,updated_at:new Date().toISOString(),updated_by:uid,
  });
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  return rows[0];
}
export async function ownerItemHistory(uid, id, io = { selectRows }) {
  if (!UUID.test(uid) || !UUID.test(id)) throw new TypeError('Invalid ID');
  // Check ownership before reading audit events.
  const own = await io.selectRows('plp_owner_items',new URLSearchParams({id:'eq.'+id,owner_id:'eq.'+uid,select:'id',limit:'1'}).toString());
  if (!Array.isArray(own) || own.length !== 1) return null;
  const rows = await io.selectRows('plp_owner_item_events',new URLSearchParams({item_id:'eq.'+id,owner_id:'eq.'+uid,select:'action,previous_status,new_status,created_at',order:'created_at.desc',limit:'50'}).toString());
  if (!Array.isArray(rows)) throw new Error('History unavailable');
  return rows;
}

function validDate(value) {
  return typeof value === 'string' && /^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function validateOwnerDecision(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid decision');
  const allowed = new Set(['id','decision','assigned_to_label','assigned_to_identity','due_on','notes']);
  if (Object.keys(input).some(key=>!allowed.has(key))) throw new TypeError('Unrecognized decision field');
  if (!UUID.test(input.id || '')) throw new TypeError('Invalid decision ID');
  const decision = choice(input.decision,['approved','declined']);
  const assignee = cleanText(input.assigned_to_label,120,true);
  const identity = input.assigned_to_identity || null;
  if (identity !== null && !UUID.test(identity)) throw new TypeError('Invalid staff identity');
  if (!validDate(input.due_on)) throw new TypeError('A valid task due date is required');
  const notes = cleanText(input.notes || '',1200);
  return { id:input.id,decision,assigned_to_label:assignee,assigned_to_identity:identity,due_on:input.due_on,notes };
}
export async function decideOwnerItem(uid,input,io={callRpc}) {
  if (!UUID.test(uid)) throw new TypeError('Invalid owner');
  const v = validateOwnerDecision(input);
  return io.callRpc('plp_owner_decide_and_assign',{
    p_owner_id:uid,p_item_id:v.id,p_decision:v.decision,
    p_assigned_to_label:v.assigned_to_label,p_assigned_to_identity:v.assigned_to_identity,
    p_due_on:v.due_on,p_notes:v.notes,
  });
}
export async function listActiveOwnerStaff(io={selectRows}) {
  const rows = await io.selectRows('plp_staff_identities',
    new URLSearchParams({active:'eq.true',select:'id,display_name,role',order:'display_name.asc',limit:'100'}).toString());
  if (!Array.isArray(rows) || rows.length>100) throw new Error('Staff directory unavailable');
  return rows.filter(row=>UUID.test(row.id||'') && typeof row.display_name==='string')
    .map(row=>({id:row.id,display_name:row.display_name.slice(0,120),role:String(row.role||'').slice(0,80)}));
}
export async function listOwnerApprovals(uid,io={selectRows}) {
  if (!UUID.test(uid)) throw new TypeError('Invalid owner');
  const q = new URLSearchParams({owner_id:'eq.'+uid,
    select:'id,item_id,decision,notes,assigned_to_label,assigned_to_identity,due_on,task_id,created_at',
    order:'created_at.desc',limit:'101'});
  const approvals = await io.selectRows('plp_owner_decision_approvals',q.toString());
  if (!Array.isArray(approvals) || approvals.length>100) throw new Error('Approval history limit');
  if (!approvals.length) return [];
  const taskIds = approvals.map(x=>x.task_id).filter(x=>UUID.test(x||''));
  const taskRows = taskIds.length ? await io.selectRows('plp_staff_tasks',new URLSearchParams({
    id:'in.('+taskIds.join(',')+')',
    select:'id,title,status,due_on,assigned_to_label,assigned_to_identity,updated_at,completed_at',
    limit:'100',
  }).toString()) : [];
  const events = await io.selectRows('plp_staff_task_events',new URLSearchParams({
    owner_id:'eq.'+uid,
    select:'task_id,action,previous_status,new_status,previous_assignee,new_assignee,previous_due_on,new_due_on,actor,created_at',
    order:'created_at.desc',limit:'300',
  }).toString());
  if (!Array.isArray(taskRows) || !Array.isArray(events) || events.length>300) throw new Error('Approval task history unavailable');
  return approvals.map(approval=>({
    ...approval,
    task:taskRows.find(task=>task.id===approval.task_id)||null,
    history:events.filter(event=>event.task_id===approval.task_id),
  }));
}
