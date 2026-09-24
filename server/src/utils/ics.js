/** Minimal RFC 5545 (iCalendar) writer for a single event — enough for Google/Apple/Outlook. */

const icsDate = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const icsText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/** Lines longer than 75 octets must be folded with CRLF + a single space. */
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = '';
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (Buffer.byteLength(current + char, 'utf8') > limit) {
      parts.push(current);
      current = '';
    }
    current += char;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildIcs({ id, title, description, venue, startDate, endDate, url, organizer, updatedAt }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventHub//Campus Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@eventhub`,
    `DTSTAMP:${icsDate(updatedAt ?? Date.now())}`,
    `DTSTART:${icsDate(startDate)}`,
    `DTEND:${icsDate(endDate)}`,
    `SUMMARY:${icsText(title)}`,
    `LOCATION:${icsText(venue)}`,
    `DESCRIPTION:${icsText([description, organizer && `Organised by ${organizer}`].filter(Boolean).join('\n\n'))}`,
    ...(url ? [`URL:${icsText(url)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
