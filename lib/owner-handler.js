import { ownerConfigured, ownerOriginAllowed, readOwnerCookie, ownerCookie, clearOwnerCookie,
  validateOwnerBearer, validateCurrentOwner, validateGodOwner, requestOwnerEmail, verifyOwnerOtp, resolveOwnerEmail } from '../lib/owner-auth.js';
import { ownerDisplayName, ownerEmails } from '../lib/site-config.js';
import { ownerMonth, ownerSummary, ownerWebsiteBehavior } from '../lib/owner-summary.js';
import { monthBounds } from '../lib/owner-month.js';
import { listOwnerItems, createOwnerItem, updateOwnerItem, ownerItemHistory, decideOwnerItem, listOwnerApprovals, listActiveOwnerStaff } from './owner-workflow.js';
import { posthogOwnerAnalytics } from './posthog-owner-analytics.js';
import { listOwnerDocuments, requestOwnerDocumentUpload, completeOwnerDocumentUpload, failOwnerDocumentUpload, getOwnerDocumentDownload, archiveOwnerDocument } from './owner-documents.js';
import { siteIsPrivate } from './preview-gate.js';

function respond(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function bodyOf(req) {
  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch { return {}; }
}
const canonical = 'https://plp-boracay.vercel.app';
// Defence-in-depth throttle for owner sign-in (Supabase Auth also enforces its
// own per-email OTP limit). Per warm instance; only the configured owner email
// can ever receive a link because the request body's email is never used.
const throttles = { login: { windowMs: 60*60*1000, max: 5, gapMs: 60*1000, hits: [] },
  verify: { windowMs: 15*60*1000, max: 10, gapMs: 0, hits: [] } };
export function ownerThrottleAllowed(kind, now = Date.now()) {
  const t = throttles[kind];
  t.hits = t.hits.filter(at => now - at < t.windowMs);
  if (t.hits.length >= t.max || (t.gapMs && t.hits.length && now - t.hits[t.hits.length-1] < t.gapMs)) return false;
  t.hits.push(now);
  return true;
}
export function resetOwnerThrottles() { for (const t of Object.values(throttles)) t.hits = []; }
export default async function handler(req, res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Cookie');
  const env = process.env;
  const action = String(req.query?.operation || 'me');
  if (!ownerConfigured(env)) return respond(res,503,{ok:false,error:'The owner sign-in has not been configured.'});
  if (!['GET','POST','PATCH'].includes(req.method)) return respond(res,405,{ok:false,error:'Method not allowed'});
  if (req.method !== 'GET' && !ownerOriginAllowed(req)) return respond(res,403,{ok:false,error:'Request origin not allowed'});
  if (req.method === 'POST' && ['login','session','verify'].includes(action)) {
    if (req.method !== 'POST') return respond(res,405,{ok:false,error:'Method not allowed'});
    const input = bodyOf(req);
    if (JSON.stringify(input).length > 10000) return respond(res,413,{ok:false,error:'Request too large'});
    if (action !== 'session' && !ownerThrottleAllowed(action)) return respond(res,429,{ok:false,error:'Please retry sign-in later.'});
    try {
      if (action === 'login') {
        const target = resolveOwnerEmail(input.email, env);
        if (!input.email && !target && ownerEmails(env).length > 1) return respond(res,400,{ok:false,error:'Enter your owner email address.'});
        // Same reply whether or not the address is an owner: no account enumeration,
        // and a non-owner address never receives a sign-in link.
        if (target) await requestOwnerEmail(env, fetch, target, input.next);
        return respond(res,202,{ok:true,message:'If this is a registered PLP owner email, a sign-in link has been sent.'});
      }
      const owner = action === 'verify'
        ? await verifyOwnerOtp(input.code, env, fetch, resolveOwnerEmail(input.email, env))
        : await validateOwnerBearer(input.accessToken, env);
      if (!owner) return respond(res,401,{ok:false,error:'Owner identity could not be verified'});
      res.setHeader('Set-Cookie',ownerCookie(owner.id,env));
      return respond(res,200,{ok:true,role:'owner',name:ownerDisplayName(owner.email,env)});
    } catch (error) {
      return respond(res,error.status===429?429:503,{ok:false,error:error.status===429?'Please retry sign-in later.':'Owner sign-in is temporarily unavailable.'});
    }
  }
  if (action === 'logout') {
    if (req.method !== 'POST') return respond(res,405,{ok:false,error:'Method not allowed'});
    res.setHeader('Set-Cookie',clearOwnerCookie());
    return respond(res,200,{ok:true});
  }
  // Every protected operation (reads and writes) must first present a valid
  // signed owner cookie that is re-verified against Supabase Auth. Writes have
  // already passed the same-origin check above. Method allowlists are enforced
  // per operation below so authorised writes reach their handlers.
  const ticket = readOwnerCookie(req,env);
  if (!ticket) return respond(res,401,{ok:false,error:'Owner sign-in required',sitePrivate:siteIsPrivate(env)});
  // Reverify the Supabase Auth user on every protected read: revoked or
  // reassigned identities cannot keep using a signed but stale cookie.
  const owner = ticket.authMethod === 'god-code' ? await validateGodOwner(ticket.uid,env) : await validateCurrentOwner(ticket.uid,env);
  if (!owner) {
    res.setHeader('Set-Cookie',clearOwnerCookie());
    return respond(res,401,{ok:false,error:'Owner session expired or access withdrawn',sitePrivate:siteIsPrivate(env)});
  }
  const WRITE_OPERATIONS = { items:['GET','POST','PATCH'], decide:['POST'], documents:['GET','POST','PATCH'] };
  if (req.method !== 'GET' && !(WRITE_OPERATIONS[action] || []).includes(req.method)) return respond(res,405,{ok:false,error:'Method not allowed'});
  if (action === 'me') return respond(res,200,{ok:true,role:'owner',email:owner.email,name:ownerDisplayName(owner.email,env)});

  if (action === 'items') {
    try {
      if (req.method === 'GET') return respond(res,200,{ok:true,items:await listOwnerItems(owner.id)});
      const input = bodyOf(req);
      if (JSON.stringify(input).length > 4200) return respond(res,413,{ok:false,error:'Item exceeds limit'});
      if (req.method === 'POST') {
        const item = await createOwnerItem(owner.id,input);
        return respond(res,201,{ok:true,item});
      }
      if (req.method === 'PATCH') {
        const item = await updateOwnerItem(owner.id,input);
        return item ? respond(res,200,{ok:true,item})
          : respond(res,409,{ok:false,error:'Item has changed or is not available. Refresh and retry.'});
      }
      return respond(res,405,{ok:false,error:'Method not allowed'});
    } catch(e) {
      return respond(res,e instanceof TypeError?400:503,{ok:false,error:e instanceof TypeError?'Check title, chapter, status and URL.':'Owner item service unavailable'});
    }
  }
  if (action === 'staff-directory' && req.method === 'GET') {
    try { return respond(res,200,{ok:true,staff:await listActiveOwnerStaff()}); }
    catch { return respond(res,503,{ok:false,error:'Staff directory unavailable'}); }
  }
  if (action === 'approvals' && req.method === 'GET') {
    try { return respond(res,200,{ok:true,approvals:await listOwnerApprovals(owner.id)}); }
    catch { return respond(res,503,{ok:false,error:'Approval history unavailable'}); }
  }
  if (action === 'decide' && req.method === 'POST') {
    const input=bodyOf(req);
    if (JSON.stringify(input).length>3000) return respond(res,413,{ok:false,error:'Decision request too large'});
    try {
      const result=await decideOwnerItem(owner.id,input);
      return respond(res,201,{ok:true,result});
    } catch(error) {
      return respond(res,error instanceof TypeError?400:409,{ok:false,error:error instanceof TypeError?'Provide an outcome, assignee and valid due date.':'The decision may already be resolved. Refresh and review the task register.'});
    }
  }
  if (action === 'documents') {
    try {
      if (req.method === 'GET') {
        const op=req.query?.op||'list';
        if (op==='list') return respond(res,200,{ok:true,documents:await listOwnerDocuments(owner.id)});
        if (op==='download') {
          const result=await getOwnerDocumentDownload(owner.id,String(req.query?.id||''));
          return result?respond(res,200,{ok:true,...result}):respond(res,404,{ok:false,error:'Document not found'});
        }
        return respond(res,400,{ok:false,error:'Unknown document operation'});
      }
      const input=bodyOf(req);
      if (JSON.stringify(input).length>3000) return respond(res,413,{ok:false,error:'Document request too large'});
      if (req.method==='POST') {
        if (input.op==='upload-intent') return respond(res,201,{ok:true,...await requestOwnerDocumentUpload(owner.id,input)});
        if (input.op==='complete') return respond(res,200,{ok:true,...await completeOwnerDocumentUpload(owner.id,input.document_id)});
        if (input.op==='fail') return respond(res,200,{ok:true,...await failOwnerDocumentUpload(owner.id,input.document_id)});
      }
      if (req.method==='PATCH' && input.op==='archive') return respond(res,200,{ok:true,...await archiveOwnerDocument(owner.id,input.document_id)});
      return respond(res,405,{ok:false,error:'Document operation not allowed'});
    } catch(error) {
      return respond(res,error instanceof TypeError?400:503,{ok:false,error:error instanceof TypeError?'Check the file name, type, size and document reference.':'Private document storage is temporarily unavailable'});
    }
  }
  if (action === 'item-history' && req.method === 'GET') {
    try {
      const rows=await ownerItemHistory(owner.id,String(req.query?.id||''));
      return rows ? respond(res,200,{ok:true,history:rows})
        : respond(res,404,{ok:false,error:'Item not found'});
    }catch(e){return respond(res,e instanceof TypeError?400:503,{ok:false,error:'Item history unavailable'});}
  }
  const month = req.query?.month || ownerMonth();
  if (!monthBounds(month) || month > ownerMonth()) return respond(res,400,{ok:false,error:'Choose a valid reporting month'});
  try {
    if (action === 'summary') return respond(res,200,{ok:true,...await ownerSummary(month)});
    if (action === 'behavior') return respond(res,200,{ok:true,...await ownerWebsiteBehavior(month)});
    if (action === 'posthog-analytics') return respond(res,200,{ok:true,...await posthogOwnerAnalytics(month)});
  } catch { return respond(res,503,{ok:false,error:'The requested owner report is unavailable'}); }
  return respond(res,404,{ok:false,error:'Unknown owner action'});
}
