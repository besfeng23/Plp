// Vercel Edge Middleware — private-preview gate.
// Web Crypto only. Guest pages redirect to /private-preview while
// PLP_SITE_PRIVATE is not exactly "false" (fail closed).
import { gateDecision, PRIVATE_CACHE, PRIVATE_ROBOTS, safePreviewNextPath } from './lib/preview-gate.js';

export const config = {
  matcher: ['/((?!_vercel(?:/.*)?$).*)'],
};

function continueWith(headers) {
  const response = new Response(null, { headers: { 'x-middleware-next': '1' } });
  if (headers) {
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  }
  return response;
}

export default async function middleware(request) {
  const decision = await gateDecision(request, process.env);
  const headers = decision.headers || (decision.privateSite
    ? { 'X-Robots-Tag': PRIVATE_ROBOTS, 'Cache-Control': PRIVATE_CACHE }
    : null);

  if (decision.kind === 'allow') return continueWith(headers);

  if (decision.kind === 'admin-redirect') {
    const response = new Response(null, {
      status: 301,
      headers: { Location: new URL('/admin', request.url).toString(), ...headers },
    });
    return response;
  }

  if (decision.kind === 'api-deny') {
    return new Response(JSON.stringify({ ok: false, error: 'Private preview access required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  }

  const next = safePreviewNextPath(decision.next || '/');
  const target = new URL('/private-preview', request.url);
  if (next && next !== '/private-preview') target.searchParams.set('next', next);
  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), ...headers },
  });
}
