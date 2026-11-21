import { insertRow, selectRows, updateRows } from '../api/_supabase.js';
import { CLUB_PROGRAMS, INQUIRY_TOPICS } from './guest-journey.js';
import { PLP_ROOMS } from './pricing.js';

const table = 'plp_concierge_enquiries';
const states = new Set(['NEW', 'IN_PROGRESS', 'CLOSED']);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const field = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const pageSize = 30;

export async function deskAvailable() {
  try { return Array.isArray(await selectRows(table, 'select=id&limit=0')); }
  catch { return false; }
}

export async function receiveEnquiry(body) {
  if (!uuid(body.requestId) || !Object.hasOwn(INQUIRY_TOPICS, body.topic) || !field(body.name,120) ||
      !field(body.message,1200) || !field(body.email,180) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return [400, { ok: false, error: 'Please check your name, email, topic and message.' }];
  }
  const requestId = body.requestId.toLowerCase();
  const room = ['group', 'stay'].includes(body.topic) && PLP_ROOMS.find(item => item.slug === body.room);
  const program = body.topic.startsWith('club') && Object.hasOwn(CLUB_PROGRAMS, body.program) && CLUB_PROGRAMS[body.program];
  const residential = body.topic === 'club' && body.purpose === 'residential-interest';
  const interest = [INQUIRY_TOPICS[body.topic], room?.name || program, residential ? 'Senior living concept interest' : null].filter(Boolean).join(' · ');
  try {
    const receipt = await insertRow('rpc/receive_concierge_enquiry', {
      p_id: requestId, p_topic: body.topic, p_interest: interest, p_name: body.name.trim(),
      p_email: body.email.trim().toLowerCase(), p_message: body.message.trim(),
    });
    if (receipt !== requestId) throw new Error('Missing receipt');
    return [200, { ok: true, received: true, receipt }];
  } catch (error) {
    if (['P4201','23505'].includes(error.code)) return [409, { ok: false, error: 'This submission identity was already used.' }];
    if (error.code === 'P4202') return [429, { ok: false, error: 'Several enquiries have been received. Please contact concierge directly.' }];
    return [503, { ok: false, error: 'The desk could not confirm receipt. You can email or call the team.' }];
  }
}

export async function staffEnquiries(method, input = {}) {
  if (method === 'PATCH') {
    if (!uuid(input.id) || !states.has(input.status) || !states.has(input.previous)) return [400,{ok:false,error:'Choose an enquiry and a valid status.'}];
    const query = new URLSearchParams({id:'eq.' + input.id,status:'eq.' + input.previous,select:'id,status'});
    const rows = await updateRows(table,query.toString(),{status:input.status,updated_at:new Date().toISOString()});
    if (!rows.length) return [409,{ok:false,error:'This enquiry changed. Refresh the inbox to see its latest status.'}];
    return [200,{ok:true}];
  }
  if (method !== 'GET') return [405,{ok:false,error:'Method not allowed'}];
  if (!states.has(input.status || 'NEW')) return [400,{ok:false,error:'Choose a valid inbox filter.'}];
  const query = new URLSearchParams({
    select:'id,topic,interest,name,email,message,status,created_at', status:'eq.' + (input.status || 'NEW'),
    order:'created_at.desc,id.desc',limit:String(pageSize + 1),
  });
  if (input.scope === 'club') query.set('topic','in.(club,club-activity)');
  if (input.scope === 'residential') { query.set('topic','eq.club'); query.set('interest','ilike.*Senior living concept interest*'); }
  if (input.before || input.beforeId) {
    if (!uuid(input.beforeId) || typeof input.before !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(input.before)) return [400,{ok:false,error:'Invalid inbox page.'}];
    query.set('or','(created_at.lt.' + input.before + ',and(created_at.eq.' + input.before + ',id.lt.' + input.beforeId + '))');
  }
  const rows = await selectRows(table,query.toString());
  if (!Array.isArray(rows)) throw new Error('Inbox unavailable');
  return [200,{ok:true,rows:rows.slice(0,pageSize),hasMore:rows.length > pageSize}];
}
