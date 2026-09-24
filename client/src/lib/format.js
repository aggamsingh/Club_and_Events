const DAY = 24 * 3600 * 1000;

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Sat, 4 Oct · 6:00 pm" (year added when it isn't the current year). */
export function formatDateTime(value, { locale, timeZone } = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const withYear = date.getFullYear() !== new Date().getFullYear();
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear && { year: 'numeric' }),
    timeZone,
  }).format(date);
  return `${day} · ${formatTime(date, { locale, timeZone })}`;
}

export function formatTime(value, { locale, timeZone } = {}) {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(value));
}

/** Collapses same-day ranges: "Sat, 4 Oct · 6:00 pm – 9:00 pm". */
export function formatDateRange(start, end, opts = {}) {
  const s = new Date(start);
  const e = new Date(end);
  if (sameDay(s, e)) return `${formatDateTime(s, opts)} – ${formatTime(e, opts)}`;
  return `${formatDateTime(s, opts)} – ${formatDateTime(e, opts)}`;
}

/** "Today", "Tomorrow", "In 5 days", "3 days ago" — relative to calendar days, not 24h blocks. */
export function relativeDay(value, now = new Date(), locale) {
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(new Date(value)) - startOf(now)) / DAY);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(diff, 'day');
}

const pad = (n) => String(n).padStart(2, '0');

/** ISO string → value for <input type="datetime-local"> in the viewer's timezone. */
export function toDateTimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * datetime-local value (no timezone) → UTC ISO string. The browser interprets the
 * value in the user's local timezone, so the server always receives an unambiguous
 * instant. (v1 sent the naive string and the server guessed the timezone.)
 */
export function fromDateTimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function seatsLabel({ capacity, rsvpCount }) {
  if (capacity == null) return `${rsvpCount} going`;
  const left = Math.max(0, capacity - rsvpCount);
  return left === 0 ? 'Fully booked' : `${left} of ${capacity} seats left`;
}
