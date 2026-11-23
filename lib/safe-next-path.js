// Same-origin return paths only. Used after owner or staff sign-in so a
// deep link such as /admin can come back without an open redirect.
export function safeNextPath(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '';
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { return ''; }
  if (decoded.includes('://') || decoded.startsWith('//') || decoded.includes('\\') || decoded.includes('..')) return '';
  const path = raw.split('?')[0].split('#')[0];
  if (!/^\/[A-Za-z0-9/_-]*$/.test(path) || path.length > 180) return '';
  if (path === '/' || path === '/owner' || path === '/owner/') return '';
  return path;
}

export function ownerSignInUrl(next) {
  const safe = safeNextPath(next);
  return 'https://plp-boracay.vercel.app/owner' + (safe ? '?next=' + encodeURIComponent(safe) : '');
}
