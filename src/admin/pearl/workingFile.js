import { chapters, checkGroups, states } from './chapterData.js';

const field = (key, label, type = 'text', options) => ({ key, label, type, options });
const state = field('state', 'Readiness', 'select', states);
const evidence = field('evidence', 'Evidence or approval reference', 'evidence');
const title = label => field('title', label, 'required');
const notes = label => field('detail', label, 'area');
export const definitions = {
  checks: {
    noun: 'checklist item', fields: [
      title('Item'), field('group', 'File section', 'select', checkGroups), notes('What is known or needed'),
      field('owner', 'Responsible person or team'), field('due', 'Review date', 'date'),
      field('asset', 'Asset or file reference'), field('rights', 'Usage permission'), field('alt', 'Image description'),
      field('organisation', 'Partner or supplier'), field('kind', 'Role or service'), state, evidence,
    ],
  },
  offers: {
    noun: 'tier or offer', fields: [
      title('Tier or offer name'), field('kind', 'Offer type', 'select', ['Membership tier', 'Comparison offer']),
      field('provider', 'Offer provider'), notes('Benefits and inclusions'), field('exclusions', 'Exclusions or limits', 'area'),
      field('eligibility', 'Eligibility'), field('amount', 'Amount', 'amount'), field('currency', 'Currency', 'currency'),
      field('basis', 'Billing interval'), field('term', 'Membership term'), field('tax', 'Taxes and fees'),
      field('renewal', 'Renewal terms'), field('refund', 'Refund or cancellation terms'), state, evidence,
    ],
  },
  members: {
    noun: 'member profile', fields: [
      title('Member reference or alias'), field('stage', 'Application status', 'select', ['Pending review', 'Active', 'Declined', 'Inactive']),
      field('age', 'Age declaration', 'select', ['Unverified', 'Declared 60+']), field('consent', 'Contact consent', 'select', ['Unverified', 'Recorded']),
      field('offer', 'Membership tier', 'offers'), field('interests', 'Activity interests'), notes('Follow-up note'),
    ],
  },
  events: {
    noun: 'activity', fields: [
      title('Activity or event name'), field('category', 'Activity theme', 'select', ['', 'Connection', 'Gentle wellbeing', 'Culture & learning', 'Island experience', 'Other']),
      field('date', 'Local date', 'date'), field('time', 'Local start time', 'time'), field('venue', 'Venue'),
      field('facilitator', 'Facilitator or supplier'), field('capacity', 'Capacity', 'capacity'),
      field('access', 'Accessibility arrangements', 'area'), notes('Activity notes'), state, evidence,
    ],
  },
  attendance: {
    noun: 'participation entry', fields: [
      field('event', 'Activity', 'events'), field('member', 'Member reference', 'members'),
      field('outcome', 'Participation', 'select', ['Registered interest', 'Attended', 'Did not attend']), notes('Participation note'),
    ],
  },
  enquiries: {
    noun: 'enquiry', fields: [
      title('Enquiry reference or alias'), field('topic', 'Topic', 'select', ['Membership', 'Activity', 'Partner', 'Residential interest', 'Other']),
      field('stage', 'Follow-up status', 'select', ['New', 'In progress', 'Closed']),
      field('owner', 'Follow-up owner'), field('due', 'Next follow-up', 'date'),
      field('action', 'Next action'), notes('Enquiry notes'),
    ],
  },
};

export const collections = Object.keys(definitions);
export const categories = { checks: 'Chapter file', offers: 'Membership', events: 'Activities' };
export const maxFileBytes = 8 * 1024 * 1024;
const activityResults = new Set(['Attended', 'Did not attend']);
export const reviewState = row => row.state || 'Needs verification';
export function chapterReview(location) {
  return ['checks', 'offers', 'events'].flatMap(collection =>
    location[collection].map(row => ({ ...row, collection, section: row.group || categories[collection] })));
}

export function localDate(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(now);
}
export function daysOfMonth(month) {
  const [year, mm] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, mm - 1, 1));
  const skip = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, mm, 0)).getUTCDate();
  return [...Array(skip).fill(''), ...Array.from({ length: count }, (_, i) => month + '-' + String(i + 1).padStart(2, '0'))];
}
export function shiftMonth(month, delta) {
  const [year, mm] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mm - 1 + delta, 1)).toISOString().slice(0, 7);
}
export function validDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}
export function localLabel(day, monthOnly = false) {
  if (!day) return 'Undated';
  const date = new Date((monthOnly ? day + '-01' : day) + 'T12:00:00Z');
  return new Intl.DateTimeFormat('en-GB', { ...(monthOnly ? {} : { day: 'numeric' }), month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}
export function emptyRow(collection, presets = {}) {
  const record = {};
  for (const f of definitions[collection].fields) record[f.key] = f.type === 'select' ? f.options[0] : '';
  if ('state' in record) record.state = 'Needs verification';
  return { ...record, ...presets };
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}
function validateRow(row, collection, chapter) {
  check(row && typeof row === 'object' && !Array.isArray(row), 'Invalid record in the working file.');
  check(typeof row.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(row.id), 'A record reference is missing or invalid.');
  const clean = { id: row.id };
  for (const f of definitions[collection].fields) {
    const v = row[f.key] ?? '';
    check(typeof v === 'string' && v.length <= 2000, f.label + ' is too long or has an invalid value.');
    clean[f.key] = v.trim();
    if (f.type === 'required') check(clean[f.key], 'Enter ' + f.label.toLowerCase() + '.');
    if (f.type === 'select') check(f.options.includes(clean[f.key]), 'Select a valid value for ' + f.label.toLowerCase() + '.');
    if (!clean[f.key]) continue;
    if (f.type === 'date') check(validDay(v), 'Enter a valid date for ' + f.label.toLowerCase() + '.');
    if (f.type === 'time') check(/^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Enter a valid local start time.');
    if (f.type === 'capacity') check(/^\d{1,6}$/.test(v) && Number(v) > 0, 'Capacity must be a positive whole number.');
    if (f.type === 'amount') check(/^\d{1,12}(\.\d{1,2})?$/.test(v), 'Enter an amount with up to two decimal places.');
    if (f.type === 'currency') {
      clean[f.key] = v.toUpperCase();
      check(/^[A-Z]{3}$/.test(clean[f.key]), 'Enter a three-letter currency code.');
    }
  }
  if (clean.state === 'Ready') {
    check(clean.evidence, 'Add an evidence or approval reference before marking this item Ready.');
    if (collection === 'events') check(clean.date && clean.time && clean.venue && clean.facilitator, 'A ready activity needs a date, start time, venue and facilitator.');
    if (collection === 'offers') check(clean.detail && clean.amount && clean.currency && clean.basis, 'A ready offer needs benefits, an amount, currency and billing interval.');
  }
  if (collection === 'offers' && clean.amount) check(clean.currency, 'Add a currency for the amount.');
  if (collection === 'events' && clean.time) check(clean.date, 'Add a local date for the start time.');
  if (collection === 'members') {
    check(chapter === 'boracay', 'Member profiles belong to the Boracay pilot.');
    if (clean.stage === 'Active') check(clean.age === 'Declared 60+' && clean.consent === 'Recorded', 'An active profile needs the age declaration and recorded consent.');
  }
  if (collection === 'attendance') check(chapter === 'boracay' && clean.member && clean.event, 'Select a Boracay member and an activity.');
  return clean;
}
function checkLinks(location, chapter) {
  const now = new Date();
  const timeZone = chapters[chapter].timeZone;
  const today = localDate(timeZone, now);
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  for (const m of location.members) {
    check(!m.offer || location.offers.some(o => o.id === m.offer && o.kind === 'Membership tier'), 'A member refers to a missing membership tier.');
  }
  const pairs = new Set();
  const headcounts = new Map();
  for (const a of location.attendance) {
    const event = location.events.find(e => e.id === a.event);
    check(event && location.members.some(m => m.id === a.member), 'A participation entry refers to a missing activity or member.');
    if (activityResults.has(a.outcome)) {
      check(event.date && (event.date < today || (event.date === today && event.time && event.time <= clock)), 'Record attendance after the activity starts. Check its local date and start time.');
    }
    if (a.outcome === 'Attended') {
      const count = (headcounts.get(event.id) || 0) + 1;
      check(!event.capacity || count <= Number(event.capacity), 'Attendance exceeds the recorded activity capacity.');
      headcounts.set(event.id, count);
    }
    const pair = a.event + ':' + a.member;
    check(!pairs.has(pair), 'The working file contains duplicate participation for an activity and member.');
    pairs.add(pair);
  }
}

export function readBook(raw) {
  check(raw && raw.format === 'plp-pearl-owner' && raw.version === 1 && raw.locations, 'Choose a Pearl Club working file saved by this workspace.');
  const result = { format: raw.format, version: 1, locations: {} };
  for (const id of Object.keys(chapters)) {
    const input = raw.locations[id];
    check(input && typeof input === 'object', 'The file is missing a chapter.');
    const location = {};
    for (const collection of collections) {
      check(Array.isArray(input[collection]) && input[collection].length <= 5000, 'A register is missing or exceeds the working-file limit.');
      const ids = new Set();
      location[collection] = input[collection].map(row => {
        const clean = validateRow(row, collection, id);
        check(!ids.has(clean.id), 'The file contains duplicate record references.');
        ids.add(clean.id);
        return clean;
      });
    }
    checkLinks(location, id);
    result.locations[id] = location;
  }
  return result;
}

export function saveRow(book, chapter, collection, value, id) {
  const location = book.locations[chapter];
  const prior = collection === 'attendance' ?
    location.attendance.find(a => a.event === value.event && a.member === value.member) : null;
  if (prior && id && prior.id !== id) throw new Error('This member already has an entry for this activity. Edit that entry.');
  const newId = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8, '0')).join('');
  const row = validateRow({ ...value, id: id || prior?.id || newId() }, collection, chapter);
  if (collection === 'attendance' && activityResults.has(row.outcome)) {
    const previous = location.attendance.find(a => a.id === row.id);
    const historic = previous?.outcome === row.outcome && previous?.member === row.member && previous?.event === row.event;
    check(historic || location.members.some(m => m.id === row.member && m.stage === 'Active'), 'Attendance requires an active Boracay member profile.');
  }
  const records = location[collection];
  const exists = records.some(record => record.id === row.id);
  check(exists || records.length < 5000, 'This working-file register is full.');
  if (['members', 'enquiries'].includes(collection)) {
    check(!records.some(record => record.id !== row.id && record.title.toLowerCase() === row.title.toLowerCase()), 'This reference already exists in the chapter.');
  }
  const next = { ...location, [collection]: exists ? records.map(record => record.id === row.id ? row : record) : [...records, row] };
  checkLinks(next, chapter);
  const updated = { ...book, locations: { ...book.locations, [chapter]: next } };
  check(new Blob([JSON.stringify(updated)]).size <= maxFileBytes, 'This working file has reached its size limit.');
  return updated;
}
