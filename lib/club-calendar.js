// RFC 5545 local download containing only the fields already published on the calendar.
const encoder = new TextEncoder();
const escapeText = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r\n?|\n/g, '\\n').replace(/([,;])/g, '\\$1');
const timestamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

function foldLine(line) {
  let result = '';
  let bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) { result += '\r\n '; bytes = 1; }
    result += character;
    bytes += length;
  }
  return result;
}

export function calendarFile(activity, now = new Date()) {
  const description = [activity.summary, activity.accessibility_notes].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pueblo La Perla//Boracay Club//EN',
    'BEGIN:VEVENT', 'UID:' + escapeText(activity.id) + '@plp-boracay.vercel.app',
    'DTSTAMP:' + timestamp(now), 'DTSTART:' + timestamp(activity.starts_at), 'DTEND:' + timestamp(activity.ends_at),
    'SUMMARY:' + escapeText(activity.title), 'DESCRIPTION:' + escapeText(description),
    'LOCATION:' + escapeText(activity.location_note), 'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
