import { websiteBookingMonth, monthBounds } from './owner-month.js';
import { websiteBehaviorReport } from './owner-behavior.js';
import { selectRows } from '../api/_supabase.js';
import { clubRows } from '../api/_clubDb.js';
import { isTestRecord } from './admin-records.js';

export function ownerMonth(now = new Date()) {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0,7);
}
async function fetchClubCounts(read = clubRows, now = new Date()) {
  async function countStates(table, selection) {
    const data = [];
    for (let page = 0; page < 20; page++) {
      const query = new URLSearchParams({ chapter_code: 'eq.boracay', select: selection, order: 'id.asc',
        limit: '250', offset: String(page * 250) });
      const rows = await read(table, { query: query.toString() });
      if (!Array.isArray(rows)) throw new Error('Club data unavailable');
      data.push(...rows);
      if (rows.length < 250) return data;
    }
    throw new Error('Club data volume exceeds the owner report limit');
  }
  const [members, activities] = await Promise.all([
    countStates('plp_club_members', 'status'),
    countStates('plp_club_activities', 'id,title,status,starts_at,location_note'),
  ]);
  return {
    publishedActivities: activities.filter(x => x.status === 'PUBLISHED' && x.starts_at && Date.parse(x.starts_at) > now.getTime())
      .sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)).slice(0,12)
      .map(x => ({ title: x.title, starts_at: x.starts_at, location_note: x.location_note })),
    pending: members.filter(x => x.status === 'PENDING').length,
    active: members.filter(x => x.status === 'ACTIVE').length,
    upcoming: activities.filter(x => x.status === 'PUBLISHED' && x.starts_at && Date.parse(x.starts_at) > now.getTime()).length,
  };
}
async function fetchOpenTasks(read = selectRows) {
  const rows = await read('plp_staff_tasks', 'select=status&order=id.asc&limit=501');
  if (!Array.isArray(rows) || rows.length > 500) throw new Error('Task data exceeds reporting limit');
  return { open: rows.filter(x => x.status === 'open' || x.status === 'in_progress').length };
}

async function ownerEnquiries(read = selectRows) {
  const rows = await read('plp_concierge_enquiries','select=status,topic,created_at&order=created_at.desc&limit=501');
  if (!Array.isArray(rows) || rows.length > 500) throw new Error('Too many enquiries for complete reporting');
  const result = { total: rows.length, new: 0, club: 0, other: 0 };
  for (const item of rows) {
    if (String(item.status||'').toLowerCase() === 'new') result.new++;
    if (item.topic === 'club') result.club++;
    else result.other++;
  }
  return result;
}
async function ownerToday(read = selectRows, now = new Date()) {
  const local = new Date(now.getTime() + 28800000).toISOString().slice(0,10);
  const q = new URLSearchParams({ select:'booking_reference,status,check_in,check_out,guest:plp_guests(email)',
    check_in:'lte.'+local,check_out:'gte.'+local,order:'check_in.asc',limit:'501' });
  const rows = await read('plp_bookings',q.toString());
  if (!Array.isArray(rows) || rows.length > 500) throw new Error('Daily stay report exceeds safe limit');
  const stays = rows.filter(row => !isTestRecord({...row,email:row.guest?.email}) && !['CANCELLED','CANCELED','VOIDED','EXPIRED','REFUNDED'].includes(row.status));
  return { date:local, arriving:stays.filter(row=>row.check_in===local).length,
    departing:stays.filter(row=>row.check_out===local).length,
    inHouse:stays.filter(row=>row.check_in<=local && row.check_out>local && ['CONFIRMED','CHECKED_IN'].includes(row.status)).length };
}

export async function ownerSummary(month, sources = {}) {
  if (!monthBounds(month)) throw new TypeError('Invalid month');
  const requests = [
    websiteBookingMonth(month, sources.selectRows || selectRows),
    fetchClubCounts(sources.clubRows || clubRows, sources.now || new Date()),
    fetchOpenTasks(sources.selectRows || selectRows),
    ownerEnquiries(sources.selectRows || selectRows),
    ownerToday(sources.selectRows || selectRows, sources.now || new Date()),
  ];
  const results = await Promise.allSettled(requests);
  const value = index => results[index].status === 'fulfilled' ? results[index].value : null;
  return { month, websiteBookings: value(0), club: value(1), tasks: value(2), enquiries: value(3), today: value(4),
    unavailable: ['websiteBookings','club','tasks','enquiries','today'].filter((_, i) => results[i].status === 'rejected'),
    location: 'boracay', accountingConnected: false };
}
export async function ownerWebsiteBehavior(month, read = selectRows) {
  return websiteBehaviorReport(month, read);
}
