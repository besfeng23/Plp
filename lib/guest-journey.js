import { PLP_ROOMS } from './pricing.js';

export const INQUIRY_TOPICS = {
  stay: 'Accommodation',
  group: 'Family or group stay',
  arrival: 'Arrival and transfers',
  water: 'Water activities',
  wellness: 'Wellness',
  dining: 'Private dining',
  club: 'Boracay Club membership (60+)',
  'club-activity': 'Boracay Club activities',
  returning: 'Returning guest stay',
};

export const CLUB_PROGRAMS = {
  connection: 'Coffee and conversation',
  wellbeing: 'Gentle wellbeing',
  culture: 'Culture and learning',
  island: 'Island outings',
};

export function inquiryContext(search) {
  const params = new URLSearchParams(search);
  const key = params.get('topic');
  const room = PLP_ROOMS.find(item => item.slug === params.get('room'));
  const program = params.get('program');
  return {
    topic: Object.hasOwn(INQUIRY_TOPICS, key) ? key : 'stay',
    room: room?.slug || '',
    program: (key === 'club' || key === 'club-activity') && Object.hasOwn(CLUB_PROGRAMS, program) ? program : '',
  };
}

export function requestedGuests(value, capacity) {
  if (!/^[1-9]\d*$/.test(value || '')) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count <= capacity ? count : null;
}
