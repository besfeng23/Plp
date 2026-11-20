import { clubDbConfigured, clubRows, recordAttendance } from '../api/_clubDb.js';

const CHAPTER = 'boracay';
const MEMBER_STATUSES = new Set(['PENDING', 'ACTIVE', 'DECLINED', 'INACTIVE']);
const ACTIVITY_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'CANCELLED']);
const ACTIVITY_CATEGORIES = new Set(['connection', 'wellbeing', 'culture', 'island']);

function reply(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function staff(req) {
  const expected = process.env.PLP_STAFF_CODE;
  return Boolean(expected && req.headers['x-plp-staff-code'] && String(req.headers['x-plp-staff-code']) === expected);
}

function bodyOf(req) {
  if (typeof req.body === 'object' && req.body && !Array.isArray(req.body)) return req.body;
  try { const parsed = JSON.parse(req.body || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
}

function cleanText(value, max = 160) {
  return String(value ?? '').trim().replace(/[\r\n\t]+/g, ' ').slice(0, max);
}

function validEmail(value) {
  const email = cleanText(value, 180).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function validUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

function cleanActivity(input, { update = false } = {}) {
  const title = cleanText(input.title, 120);
  const summary = cleanText(input.summary, 600);
  const category = cleanText(input.category, 30).toLowerCase();
  const starts = new Date(input.starts_at);
  const ends = new Date(input.ends_at);
  const status = cleanText(input.status || 'DRAFT', 16).toUpperCase();
  const capacity = input.capacity === '' || input.capacity == null ? null : Number(input.capacity);
  if (!title || !summary || !ACTIVITY_CATEGORIES.has(category) || !ACTIVITY_STATUSES.has(status)) return { error: 'Complete the activity title, description, and category.' };
  if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || ends <= starts) return { error: 'Enter a valid start and end time.' };
  if (status === 'PUBLISHED' && starts <= new Date()) return { error: 'Only future activities may be published.' };
  if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1000)) return { error: 'Capacity must be between 1 and 1,000.' };
  return { row: { ...(!update ? { chapter_code: CHAPTER } : {}), title, summary, category, starts_at: starts.toISOString(), ends_at: ends.toISOString(), status, capacity, location_note: cleanText(input.location_note, 160) || null, accessibility_notes: cleanText(input.accessibility_notes, 400) || null, updated_at: new Date().toISOString() } };
}

export default async function handler(req, res) {
  const operation = String(req.query?.operation || 'activities').toLowerCase();
  if (req.method === 'GET' && operation === 'activities') {
    if (!clubDbConfigured()) return reply(res, 200, { ok: true, activities: [], configured: false });
    try {
      const now = encodeURIComponent(new Date().toISOString());
      const activities = await clubRows('plp_club_activities', { query: `chapter_code=eq.${CHAPTER}&status=eq.PUBLISHED&starts_at=gte.${now}&select=id,title,summary,category,starts_at,ends_at,location_note,accessibility_notes,capacity&order=starts_at.asc&limit=60` });
      return reply(res, 200, { ok: true, activities, configured: true });
    } catch { return reply(res, 503, { ok: false, error: 'Club calendar is temporarily unavailable.' }); }
  }

  // No anonymous member data, enrollment, or RSVP endpoints. A staff member
  // must record informed consent before entering applicant information.
  if (!staff(req)) return reply(res, 403, { ok: false, error: 'Staff access required.' });
  if (!clubDbConfigured()) return reply(res, 503, { ok: false, error: 'Club database is not configured.' });

  try {
    if (operation === 'attendance' && req.method === 'GET') {
      const activity = req.query?.activity;
      if (!validUuid(activity)) return reply(res, 400, { ok: false, error: 'Choose a club activity.' });
      // Keyset pagination also works with a provider row ceiling below the requested page size.
      const attendees = [];
      let after = '';
      for (;;) {
        const query = new URLSearchParams({
          activity_id: 'eq.' + activity, present: 'eq.true',
          select: 'member_id,member:plp_club_members!inner(full_name,chapter_code),activity:plp_club_activities!inner(chapter_code)',
          'activity.chapter_code': 'eq.' + CHAPTER, 'member.chapter_code': 'eq.' + CHAPTER,
          order: 'member_id.asc', limit: '250',
        });
        if (after) query.set('member_id', 'gt.' + after);
        const page = await clubRows('plp_club_attendance', { query: query.toString() });
        if (!page.length) break;
        attendees.push(...page.map(row => ({ id: row.member_id, name: row.member.full_name })));
        after = page.at(-1).member_id;
      }
      return reply(res, 200, { ok: true, attendees });
    }
    if (operation === 'attendance' && req.method === 'POST') {
      const { activity, member, present } = bodyOf(req);
      if (!validUuid(activity) || !validUuid(member) || typeof present !== 'boolean') {
        return reply(res, 400, { ok: false, error: 'Choose a member, activity and attendance action.' });
      }
      const saved = await recordAttendance(activity, member, present);
      if (saved !== present) throw new Error('Unexpected attendance result');
      return reply(res, 200, { ok: true, present: saved });
    }
    if (req.method === 'GET' && operation === 'members') {
      const { before, beforeId } = req.query;
      const query = new URLSearchParams({
        chapter_code: 'eq.' + CHAPTER,
        select: 'id,full_name,email,phone,status,age_declared_60plus,consent_at,created_at,updated_at',
        order: 'created_at.desc,id.desc', limit: '500',
      });
      if (before !== undefined || beforeId !== undefined) {
        if (!validUuid(beforeId) || typeof before !== 'string' ||
            !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(before)) {
          return reply(res, 400, { ok: false, error: 'Invalid member list page.' });
        }
        query.set('or', `(created_at.lt.${before},and(created_at.eq.${before},id.lt.${beforeId}))`);
      }
      const members = await clubRows('plp_club_members', { query: query.toString() });
      const last = members.at(-1);
      // Continue even after a short page because the provider may cap a response below 500.
      return reply(res, 200, { ok: true, members, next: last ? { before: last.created_at, beforeId: last.id } : null });
    }
    if (req.method === 'POST' && operation === 'members') {
      const body = bodyOf(req);
      const fullName = cleanText(body.full_name, 140);
      const email = validEmail(body.email);
      if (fullName.length < 2 || !email || body.age_declared_60plus !== true || body.consent_recorded !== true) {
        return reply(res, 400, { ok: false, error: 'Name, valid email, 60+ self-declaration, and recorded consent are required.' });
      }
      const members = await clubRows('plp_club_members', { method: 'POST', body: { chapter_code: CHAPTER, full_name: fullName, email, phone: cleanText(body.phone, 50) || null, age_declared_60plus: true, consent_at: new Date().toISOString(), consent_source: 'staff_recorded', status: 'PENDING' } });
      return reply(res, 201, { ok: true, member: members[0] });
    }
    if (req.method === 'PATCH' && operation === 'members') {
      const body = bodyOf(req);
      const status = cleanText(body.status, 16).toUpperCase();
      if (!validUuid(body.id) || !MEMBER_STATUSES.has(status) || status === 'PENDING') return reply(res, 400, { ok: false, error: 'A valid member and decision are required.' });
      const filter = `id=eq.${encodeURIComponent(body.id)}&chapter_code=eq.${CHAPTER}`;
      const existing = await clubRows('plp_club_members', { query: `${filter}&select=id,status,consent_at,age_declared_60plus&limit=1` });
      if (!existing.length) return reply(res, 404, { ok: false, error: 'Member not found.' });
      if (status === 'ACTIVE' && (!existing[0].consent_at || !existing[0].age_declared_60plus)) return reply(res, 409, { ok: false, error: 'The member needs recorded consent and a 60+ declaration.' });
      const members = await clubRows('plp_club_members', { method: 'PATCH', query: filter, body: { status, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() } });
      return reply(res, 200, { ok: true, member: members[0] });
    }
    if (req.method === 'GET' && operation === 'admin-activities') {
      const activities = await clubRows('plp_club_activities', { query: `chapter_code=eq.${CHAPTER}&select=*&order=starts_at.asc&limit=500` });
      return reply(res, 200, { ok: true, activities });
    }
    if (req.method === 'POST' && operation === 'admin-activities') {
      const { row, error } = cleanActivity(bodyOf(req));
      if (error) return reply(res, 400, { ok: false, error });
      const activities = await clubRows('plp_club_activities', { method: 'POST', body: row });
      return reply(res, 201, { ok: true, activity: activities[0] });
    }
    if (req.method === 'PATCH' && operation === 'admin-activities') {
      const body = bodyOf(req);
      if (!validUuid(body.id)) return reply(res, 400, { ok: false, error: 'A valid activity is required.' });
      const filter = `id=eq.${encodeURIComponent(body.id)}&chapter_code=eq.${CHAPTER}`;
      const existing = await clubRows('plp_club_activities', { query: `${filter}&select=*&limit=1` });
      if (!existing.length) return reply(res, 404, { ok: false, error: 'Activity not found.' });
      const { row, error } = cleanActivity({ ...existing[0], ...body }, { update: true });
      if (error) return reply(res, 400, { ok: false, error });
      const activities = await clubRows('plp_club_activities', { method: 'PATCH', query: filter, body: row });
      return reply(res, 200, { ok: true, activity: activities[0] });
    }
    return reply(res, 405, { ok: false, error: 'Unsupported club action.' });
  } catch (error) {
    // Never echo database responses; they can contain member PII or internal SQL.
    if (error.code === 'P4101') return reply(res, 404, { ok: false, error: 'Member or activity unavailable in the Boracay chapter.' });
    if (error.code === 'P4102') return reply(res, 409, { ok: false, error: 'Check-in requires an active member and a published activity that has started.' });
    if (error.code === 'P4103') return reply(res, 409, { ok: false, error: 'This activity has reached its recorded capacity.' });
    if (error.code === '23505') return reply(res, 409, { ok: false, error: 'A member with this email already exists in Boracay.' });
    return reply(res, 503, { ok: false, error: 'The club record could not be saved or loaded.' });
  }
}
