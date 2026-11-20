// Dedicated PLP Club data access. This intentionally does not modify the
// booking/payment Supabase client or its plp_runtime schema selection.
const TABLES = new Set(['plp_club_chapters', 'plp_club_members', 'plp_club_activities']);

export function clubDbConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function clubRows(table, { method = 'GET', query = '', body } = {}) {
  if (!TABLES.has(table)) throw new Error('Unsupported club resource');
  if (!clubDbConfigured()) throw new Error('Club database is not configured');
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${base}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      Prefer: method === 'GET' ? '' : 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  const result = raw ? JSON.parse(raw) : [];
  if (!response.ok) {
    const error = new Error('Club data operation failed');
    error.code = result?.code || String(response.status);
    throw error;
  }
  return Array.isArray(result) ? result : [];
}
