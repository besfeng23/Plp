import { insertRow, selectRows, updateRows } from '../api/_supabase.js';
import { CLUB_PROGRAMS, INQUIRY_TOPICS } from './guest-journey.js';
import { inquiryMailReady, sendInquiryAlert } from './inquiry-alert.js';
import { PLP_ROOMS } from './pricing.js';

const table = 'plp_concierge_enquiries';
const states = new Set(['NEW', 'CONTACTED', 'QUOTED', 'BOOKED', 'LOST']);
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
    const emailDelivered = await maybeAlertEnquiry(requestId, {
      requestId,
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      interest,
      message: body.message.trim(),
    });
    return [200, { ok: true, received: true, receipt, emailDelivered }];
  } catch (error) {
    if (['P4201','23505'].includes(error.code)) return [409, { ok: false, error: 'This submission identity was already used.' }];
    if (error.code === 'P4202') return [429, { ok: false, error: 'Several enquiries have been received. Please call or message the sales team.' }];
    return [503, { ok: false, error: 'The desk could not confirm receipt. Please call or message the sales team.' }];
  }
}

export async function staffEnquiries(method, input = {}) {
  if (method === 'PATCH') {
    if (!uuid(input.id) || !states.has(input.status) || !states.has(input.previous || input.status)) return [400,{ok:false,error:'Choose an enquiry and a valid status.'}];
    const patch = { status: input.status, updated_at: new Date().toISOString() };
    if (Object.hasOwn(input, 'assignee')) {
      const assignee = typeof input.assignee === 'string' ? input.assignee.trim() : '';
      if (assignee && assignee.length > 120) return [400,{ok:false,error:'Choose a shorter assignee name.'}];
      patch.assignee = assignee || null;
    }
    if (Object.hasOwn(input, 'follow_up_on')) {
      const due = input.follow_up_on == null || input.follow_up_on === '' ? null : String(input.follow_up_on);
      if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return [400,{ok:false,error:'Choose a valid follow-up date.'}];
      patch.follow_up_on = due;
    }
    const query = new URLSearchParams({id:'eq.' + input.id,status:'eq.' + (input.previous || input.status),select:'id,status,assignee,follow_up_on'});
    const rows = await updateRows(table,query.toString(),patch);
    if (!rows.length) return [409,{ok:false,error:'This enquiry changed. Refresh the inbox to see its latest status.'}];
    return [200,{ok:true,row:rows[0]}];
  }
  if (method !== 'GET') return [405,{ok:false,error:'Method not allowed'}];
  if (!states.has(input.status || 'NEW')) return [400,{ok:false,error:'Choose a valid inbox filter.'}];
  const query = new URLSearchParams({
    select:'id,topic,interest,name,email,message,status,assignee,follow_up_on,created_at', status:'eq.' + (input.status || 'NEW'),
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

async function maybeAlertEnquiry(id, enquiry) {
  if (!inquiryMailReady()) return false;
  try {
    const rows = await selectRows(table, 'id=eq.' + id + '&select=id,alerted_at&limit=1');
    if (!rows?.[0] || rows[0].alerted_at) return Boolean(rows?.[0]?.alerted_at);
    const sent = await sendInquiryAlert(enquiry);
    if (!sent) return false;
    await updateRows(table, 'id=eq.' + id + '&alerted_at=is.null&select=id', { alerted_at: new Date().toISOString() });
    return true;
  } catch {
    return false;
  }
}
