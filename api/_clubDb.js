// Dedicated PLP Club data access. This intentionally does not modify the
// booking/payment Supabase client or its plp_runtime schema selection.
const TABLES = new Set(['plp_club_chapters', 'plp_club_members', 'plp_club_activities', 'plp_club_attendance']);

export function clubDbConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function clubRequest(resource, { method = 'GET', query = '', body } = {}) {
  if (!clubDbConfigured()) throw new Error('Club database is not configured');
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${base}/rest/v1/${resource}${query ? `?${query}` : ''}`, {
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
  return result;
}

export async function clubRows(table, options) {
  if (!TABLES.has(table)) throw new Error('Unsupported club resource');
  const result = await clubRequest(table, options);
  if (!Array.isArray(result)) throw new Error('Unexpected club result');
  return result;
}

export function recordAttendance(activity, member, present) {
  return clubRequest('rpc/plp_club_record_attendance', {
    method: 'POST', body: { p_activity: activity, p_member: member, p_present: present },
  });
}
