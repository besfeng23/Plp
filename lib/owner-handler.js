import { ownerConfigured, ownerOriginAllowed, readOwnerCookie, ownerCookie, clearOwnerCookie,
  validateOwnerBearer, validateCurrentOwner, requestOwnerEmail, verifyOwnerOtp } from '../lib/owner-auth.js';
import { ownerMonth, ownerSummary, ownerWebsiteBehavior } from '../lib/owner-summary.js';
import { monthBounds } from '../lib/owner-month.js';

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
export default async function handler(req, res) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Cookie');
  const env = process.env;
  const action = String(req.query?.operation || 'me');
  if (!ownerConfigured(env)) return respond(res,503,{ok:false,error:'The owner sign-in has not been configured.'});
  if (!['GET','POST'].includes(req.method)) return respond(res,405,{ok:false,error:'Method not allowed'});
  if (req.method === 'POST' && !ownerOriginAllowed(req)) return respond(res,403,{ok:false,error:'Request origin not allowed'});
  if (req.method === 'POST' && ['login','session','verify'].includes(action)) {
    if (req.method !== 'POST') return respond(res,405,{ok:false,error:'Method not allowed'});
    const input = bodyOf(req);
    if (JSON.stringify(input).length > 10000) return respond(res,413,{ok:false,error:'Request too large'});
    try {
      if (action === 'login') {
        await requestOwnerEmail(env);
        return respond(res,202,{ok:true,message:'A sign-in email has been requested for the registered PLP owner.'});
      }
      const owner = action === 'verify'
        ? await verifyOwnerOtp(input.code, env)
        : await validateOwnerBearer(input.accessToken, env);
      if (!owner) return respond(res,401,{ok:false,error:'Owner identity could not be verified'});
      res.setHeader('Set-Cookie',ownerCookie(owner.id,env));
      return respond(res,200,{ok:true,role:'owner',name:'Dr. Marichi Fong Ramos'});
    } catch (error) {
      return respond(res,error.status===429?429:503,{ok:false,error:error.status===429?'Please retry sign-in later.':'Owner sign-in is temporarily unavailable.'});
    }
  }
  if (action === 'logout') {
    if (req.method !== 'POST') return respond(res,405,{ok:false,error:'Method not allowed'});
    res.setHeader('Set-Cookie',clearOwnerCookie());
    return respond(res,200,{ok:true});
  }
  if (req.method !== 'GET') return respond(res,405,{ok:false,error:'Method not allowed'});
  const ticket = readOwnerCookie(req,env);
  if (!ticket) return respond(res,401,{ok:false,error:'Owner sign-in required'});
  // Reverify the Supabase Auth user on every protected read: revoked or
  // reassigned identities cannot keep using a signed but stale cookie.
  const owner = await validateCurrentOwner(ticket.uid,env);
  if (!owner) {
    res.setHeader('Set-Cookie',clearOwnerCookie());
    return respond(res,401,{ok:false,error:'Owner session expired or access withdrawn'});
  }
  if (action === 'me') return respond(res,200,{ok:true,role:'owner',email:owner.email,name:'Dr. Marichi Fong Ramos'});
  const month = req.query?.month || ownerMonth();
  if (!monthBounds(month) || month > ownerMonth()) return respond(res,400,{ok:false,error:'Choose a valid reporting month'});
  try {
    if (action === 'summary') return respond(res,200,{ok:true,...await ownerSummary(month)});
    if (action === 'behavior') return respond(res,200,{ok:true,...await ownerWebsiteBehavior(month)});
  } catch { return respond(res,503,{ok:false,error:'The requested owner report is unavailable'}); }
  return respond(res,404,{ok:false,error:'Unknown owner action'});
}
