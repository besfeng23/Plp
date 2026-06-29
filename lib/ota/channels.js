export const OTA_CHANNELS = Object.freeze({
  BOOKING_COM: 'booking_com',
  AGODA: 'agoda',
  AIRBNB: 'airbnb',
  EXPEDIA: 'expedia',
  VRBO: 'vrbo',
  DIRECT: 'direct',
  MANUAL: 'manual',
});

export const OTA_CHANNEL_LABELS = Object.freeze({
  [OTA_CHANNELS.BOOKING_COM]: 'Booking.com',
  [OTA_CHANNELS.AGODA]: 'Agoda',
  [OTA_CHANNELS.AIRBNB]: 'Airbnb',
  [OTA_CHANNELS.EXPEDIA]: 'Expedia',
  [OTA_CHANNELS.VRBO]: 'Vrbo',
  [OTA_CHANNELS.DIRECT]: 'Direct website',
  [OTA_CHANNELS.MANUAL]: 'Manual admin booking',
});

export const OTA_SYNC_STATUSES = Object.freeze({
  IMPORTED: 'imported',
  MAPPED: 'mapped',
  UNMAPPED: 'unmapped',
  BLOCKED: 'blocked',
  CONFLICT: 'conflict',
  CANCELLED: 'cancelled',
  MODIFIED: 'modified',
  NEEDS_REVIEW: 'needs_review',
  SYNCED: 'synced',
  FAILED: 'failed',
});

export const OTA_FOUNDATION_NOTICE = 'This is a foundation screen. Live OTA API credentials are not connected yet.';

const freezeSection = (section) => Object.freeze(section);

export const OTA_ADMIN_SECTIONS = Object.freeze([
  freezeSection({
    id: 'channels',
    label: 'Channels',
    description: 'Registry for future Booking.com, Agoda, Airbnb, Expedia, Vrbo, direct, and manual sources.',
    status: OTA_SYNC_STATUSES.NEEDS_REVIEW,
  }),
  freezeSection({
    id: 'external-bookings',
    label: 'External Bookings',
    description: 'Review queue for imported OTA/iCal reservations before staff maps or blocks inventory.',
    status: OTA_SYNC_STATUSES.IMPORTED,
  }),
  freezeSection({
    id: 'calendar-sync',
    label: 'Calendar Sync',
    description: 'Future iCal feed import/export runs with safe logging and no live calls from this screen.',
    status: OTA_SYNC_STATUSES.SYNCED,
  }),
  freezeSection({
    id: 'conflicts',
    label: 'Conflicts',
    description: 'Potential double-booking, overlap, stale mapping, and cancellation mismatch review.',
    status: OTA_SYNC_STATUSES.CONFLICT,
  }),
  freezeSection({
    id: 'room-mapping',
    label: 'Room Mapping',
    description: 'Mapping layer between channel room/rate codes and PLP accommodation records.',
    status: OTA_SYNC_STATUSES.UNMAPPED,
  }),
  freezeSection({
    id: 'sync-logs',
    label: 'Sync Logs',
    description: 'Audit trail for future import/export attempts, payload summaries, failures, and staff reviews.',
    status: OTA_SYNC_STATUSES.FAILED,
  }),
]);

export function listSupportedOtaChannels() {
  return Object.values(OTA_CHANNELS).map((id) => ({ id, label: OTA_CHANNEL_LABELS[id] }));
}
