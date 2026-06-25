import { insertRow, isSupabaseConfigured, selectRows, updateRows } from '../_supabase.js';

const ALLOWED_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function isAuthorized(req) {
  const configured = process.env.PLP_STAFF_CODE;
  const provided = req.headers['x-plp-staff-code'];
  return Boolean(configured && provided && String(provided) === String(configured));
}

function cleanSection(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 80);
}

function cleanStatus(value) {
  const status = String(value || 'DRAFT').trim().toUpperCase();
  return ALLOWED_STATUSES.has(status) ? status : 'DRAFT';
}

function cleanUpdatedBy(value) {
  return String(value || 'staff').trim().slice(0, 120);
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) return json(res, 401, { error: 'Unauthorized' });
  if (!isSupabaseConfigured()) return json(res, 500, { error: 'Supabase is not configured.' });

  if (req.method === 'GET') {
    try {
      const rows = await selectRows('plp_site_content', 'select=id,section,status,content,updated_at,updated_by&order=section.asc');
      return json(res, 200, { content: rows || [] });
    } catch (error) {
      return json(res, 500, { error: error.message || 'Unable to load content.' });
    }
  }

  if (req.method === 'POST') {
    let body = {};
    try {
      body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    } catch {
      body = {};
    }

    const section = cleanSection(body.section);
    if (!section) return json(res, 400, { error: 'Section is required.' });
    if (!body.content || typeof body.content !== 'object' || Array.isArray(body.content)) {
      return json(res, 400, { error: 'Content must be a JSON object.' });
    }

    const payload = {
      section,
      content: body.content,
      status: cleanStatus(body.status),
      updated_by: cleanUpdatedBy(body.updatedBy),
      updated_at: new Date().toISOString()
    };

    try {
      const existing = await selectRows('plp_site_content', `section=eq.${encodeURIComponent(section)}&select=id&limit=1`);
      const saved = existing?.[0]
        ? (await updateRows('plp_site_content', `id=eq.${existing[0].id}`, payload))?.[0]
        : await insertRow('plp_site_content', payload);
      return json(res, 200, { ok: true, content: saved });
    } catch (error) {
      return json(res, 500, { error: error.message || 'Unable to save content.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'Method not allowed' });
}
