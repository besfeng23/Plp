import { websiteBookingMonth, monthBounds } from './owner-month.js';
import { websiteBehaviorReport } from './owner-behavior.js';
import { selectRows } from '../api/_supabase.js';
import { clubRows } from '../api/_clubDb.js';

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
    countStates('plp_club_activities', 'status,starts_at'),
  ]);
  return {
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
export async function ownerSummary(month, sources = {}) {
  if (!monthBounds(month)) throw new TypeError('Invalid month');
  const requests = [
    websiteBookingMonth(month, sources.selectRows || selectRows),
    fetchClubCounts(sources.clubRows || clubRows, sources.now || new Date()),
    fetchOpenTasks(sources.selectRows || selectRows),
  ];
  const results = await Promise.allSettled(requests);
  const value = index => results[index].status === 'fulfilled' ? results[index].value : null;
  return { month, websiteBookings: value(0), club: value(1), tasks: value(2),
    unavailable: ['websiteBookings','club','tasks'].filter((_, i) => results[i].status === 'rejected'),
    location: 'boracay', accountingConnected: false };
}
export async function ownerWebsiteBehavior(month, read = selectRows) {
  return websiteBehaviorReport(month, read);
}
