// Growth Plan (plan PR 7): the owners' marketing tracker, served only to a
// verified owner, with task progress shared through plp_runtime.plp_growth_tasks.
// Until that table exists (migration pending owner approval) the API answers
// storage:"device" and the page keeps progress in the browser, clearly labelled.
import fs from 'node:fs';
import path from 'node:path';
import { ownerConfigured, ownerOriginAllowed, readOwnerCookie, validateCurrentOwner } from './owner-auth.js';
import { resolveStaffActor } from './access-control.js';
import { socialLinksHtml } from './social.js';

export const TASK_KEYS = Array.from({ length: 26 }, (_, i) => String(i + 1).padStart(2, '0'));
export const POST_KEYS = Array.from({ length: 14 }, (_, i) => 'post-' + i);
export const TASK_STATUSES = ['Planned', 'Needs info', 'In progress', 'Blocked', 'Done'];
export const POST_STATUSES = ['Proposed', 'Needs footage', 'Draft', 'Approved', 'Scheduled', 'Published', 'Paused'];
const PAGE_FILE = () => path.join(process.cwd(), 'private', 'plp-growth-plan.html');

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Vary', 'Cookie');
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

// Owners only: the Owner Office session, or an individual owner account (PLP_AUTH_V2_ENABLED).
export async function growthActor(req, env = process.env, fetcher = fetch) {
  if (ownerConfigured(env)) {
    const ticket = readOwnerCookie(req, env);
    if (ticket) {
      const owner = await validateCurrentOwner(ticket.uid, env, fetcher);
      if (owner) return { id: owner.id, email: String(owner.email).toLowerCase() };
    }
  }
  const staff = await resolveStaffActor(req, env, fetcher).catch(() => null);
  return staff && staff.role === 'owner' ? { id: staff.id, email: staff.email } : null;
}

async function rest(pathname, env, fetcher, { method = 'GET', body, prefer = 'return=representation' } = {}) {
  const r = await fetcher(String(env.SUPABASE_URL).replace(/\/$/, '') + '/rest/v1/' + pathname, { method, body, cache: 'no-store', headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json', 'Accept-Profile': 'plp_runtime', 'Content-Profile': 'plp_runtime', Prefer: prefer } });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error('Growth register unavailable'), { status: r.status, code: data?.code });
  return data;
}
// Table not created yet (migration pending): PostgREST answers 404 / PGRST205 or Postgres 42P01.
export const tableMissing = error => error?.status === 404 || ['PGRST205', 'PGRST106', '42P01'].includes(error?.code);

const lockedPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Growth Plan · PLP</title><link rel="icon" href="/favicon.svg"></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#faf8f3;color:#20211e;font:15px/1.6 system-ui,sans-serif;padding:24px">
<main style="max-width:420px;text-align:center"><img src="/brand/PLP_Editorial_Vector_Logo.svg" alt="" width="44" height="62"><h1 style="font:400 18px Georgia,serif;letter-spacing:.18em;text-transform:uppercase;margin:18px 0 14px">Growth Plan</h1>
<p style="border:1px solid #e6dccb;padding:14px 16px;color:#615f57;margin:0 0 20px">For the owners. Sign in to the Owner Office, then open the plan again.</p>
<a href="/owner" style="display:inline-block;padding:12px 18px;background:#20211e;color:#fffdf8;text-decoration:none;font-weight:700">Owner sign-in</a></main></body></html>`;

function clean(value, max) { return String(value ?? '').replace(/[\x00-\x1f]/g, ' ').trim().slice(0, max); }
const validProof = url => { try { const u = new URL(url); return u.protocol === 'https:' && u.hostname.includes('.'); } catch { return false; } };

export default async function growthHandler(req, res, env = process.env, fetcher = fetch) {
  const operation = String(req.query?.operation || 'tasks');
  const actor = await growthActor(req, env, fetcher);
  if (operation === 'page') {
    if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });
    if (!actor) return send(res, 401, lockedPage, 'text/html; charset=utf-8');
    return send(res, 200, fs.readFileSync(PAGE_FILE(), 'utf8').replace('<!--PLP_SOCIAL-->', socialLinksHtml()), 'text/html; charset=utf-8');
  }
  if (!actor) return send(res, 401, { ok: false, error: 'Owner sign-in required' });
  try {
    if (operation === 'tasks' && req.method === 'GET') {
      const rows = await rest('plp_growth_tasks?select=item_key,status,note,proof_url,owner_label,due_on,completed_at,updated_by_email,updated_at&limit=200', env, fetcher);
      const items = {};
      for (const row of rows || []) items[row.item_key] = { status: row.status, note: row.note || '', proof: row.proof_url || '', owner: row.owner_label || '', due: row.due_on || '', completedAt: row.completed_at, by: row.updated_by_email, at: row.updated_at };
      return send(res, 200, { ok: true, storage: 'central', items });
    }
    if (operation === 'history' && req.method === 'GET') {
      const rows = await rest('plp_growth_task_events?select=item_key,previous_status,new_status,actor_email,created_at&order=created_at.desc&limit=100', env, fetcher);
      return send(res, 200, { ok: true, storage: 'central', history: rows || [] });
    }
    if (operation === 'tasks' && req.method === 'PATCH') {
      if (!ownerOriginAllowed(req)) return send(res, 403, { ok: false, error: 'Request origin not allowed' });
      let body = {};
      try { body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}'); } catch {}
      const key = String(body.item || '');
      const isTask = TASK_KEYS.includes(key), isPost = POST_KEYS.includes(key);
      if (!isTask && !isPost) return send(res, 400, { ok: false, error: 'Unknown plan item' });
      const status = String(body.status || '');
      if (!(isTask ? TASK_STATUSES : POST_STATUSES).includes(status)) return send(res, 400, { ok: false, error: 'Unknown status' });
      const note = clean(body.note, 500), proof = clean(body.proof, 1000), owner = clean(body.owner, 80), due = clean(body.due, 10);
      if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return send(res, 400, { ok: false, error: 'Due date must be YYYY-MM-DD' });
      if (status === 'Done' && note.length < 8) return send(res, 400, { ok: false, error: 'Add a short evidence note before marking Done.' });
      if (status === 'Published' && !validProof(proof)) return send(res, 400, { ok: false, error: 'Add the published post link before marking Published.' });
      if (proof && !validProof(proof)) return send(res, 400, { ok: false, error: 'The proof link must be an https address.' });
      const previous = (await rest('plp_growth_tasks?' + new URLSearchParams({ item_key: 'eq.' + key, select: 'status', limit: '1' }), env, fetcher))?.[0]?.status || null;
      const done = status === 'Done' || status === 'Published';
      const rows = await rest('plp_growth_tasks?on_conflict=item_key', env, fetcher, { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation',
        body: JSON.stringify({ item_key: key, status, note: note || null, proof_url: proof || null, owner_label: owner || null, due_on: due || null,
          completed_at: done ? new Date().toISOString() : null, updated_by: actor.id, updated_by_email: actor.email, updated_at: new Date().toISOString() }) });
      await rest('plp_growth_task_events', env, fetcher, { method: 'POST', prefer: 'return=minimal',
        body: JSON.stringify({ item_key: key, previous_status: previous, new_status: status, actor_id: actor.id, actor_email: actor.email }) });
      return send(res, 200, { ok: true, storage: 'central', item: rows?.[0] ? { status: rows[0].status, by: rows[0].updated_by_email, at: rows[0].updated_at } : null });
    }
    return send(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    if (tableMissing(error)) return send(res, req.method === 'GET' ? 200 : 503, { ok: req.method === 'GET', storage: 'device', error: req.method === 'GET' ? undefined : 'Shared tracking is not switched on yet.' });
    return send(res, 503, { ok: false, error: 'The growth plan register is unavailable.' });
  }
}
