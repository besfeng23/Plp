import { insertRow, selectRows, updateRows } from '../api/_supabase.js';

export const OWNER_CHAPTERS = Object.freeze(['boracay','singapore','malaysia','global']);
export const OWNER_KINDS = Object.freeze(['decision','document','note','partner','milestone']);
export const OWNER_STATUSES = Object.freeze(['needs_decision','needs_verification','reviewed','archived']);
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
