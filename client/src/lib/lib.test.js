import { describe, expect, it } from 'vitest';
import { safeNext } from './redirect';
import { toQueryString } from './api';
import { formatDateRange, fromDateTimeLocal, relativeDay, seatsLabel, toDateTimeLocal } from './format';
import { validateEvent } from './validation';

const opts = { locale: 'en-US', timeZone: 'UTC' };

describe('format', () => {
  it('collapses same-day ranges and expands multi-day ones', () => {
    const sameDay = formatDateRange('2030-03-02T10:00:00Z', '2030-03-02T12:30:00Z', opts);
    expect(sameDay).toMatch(/Sat, Mar 2, 2030 · 10:00 AM – 12:30 PM/);
    const multi = formatDateRange('2030-03-02T10:00:00Z', '2030-03-04T09:00:00Z', opts);
    expect(multi.match(/2030/g)).toHaveLength(2);
  });

  it('round-trips datetime-local values through UTC ISO strings', () => {
    const local = '2030-06-15T18:30';
    const iso = fromDateTimeLocal(local);
    expect(iso).toMatch(/Z$/);
    expect(toDateTimeLocal(iso)).toBe(local);
    expect(fromDateTimeLocal('')).toBe('');
    expect(fromDateTimeLocal('garbage')).toBe('');
  });

  it('describes days relative to today', () => {
    const now = new Date(2030, 0, 10, 23, 0);
    expect(relativeDay(new Date(2030, 0, 11, 1, 0), now, 'en')).toBe('tomorrow');
    expect(relativeDay(new Date(2030, 0, 10, 8, 0), now, 'en')).toBe('today');
    expect(relativeDay(new Date(2030, 0, 15), now, 'en')).toBe('in 5 days');
  });

  it('labels seats', () => {
    expect(seatsLabel({ capacity: null, rsvpCount: 4 })).toBe('4 going');
    expect(seatsLabel({ capacity: 10, rsvpCount: 4 })).toBe('6 of 10 seats left');
    expect(seatsLabel({ capacity: 10, rsvpCount: 10 })).toBe('Fully booked');
  });
});

describe('toQueryString', () => {
  it('drops empty values', () => {
    expect(toQueryString({ q: 'robo', category: '', page: 2, club: null })).toBe('?q=robo&page=2');
    expect(toQueryString({})).toBe('');
  });
});

describe('validateEvent', () => {
  const valid = {
    title: 'Hack Night',
    category: 'technical',
    startDate: '2030-01-01T10:00',
    endDate: '2030-01-01T12:00',
    venue: 'Lab 1',
    capacity: '',
    registerLink: '',
    description: '',
  };

  it('accepts a valid event', () => {
    expect(validateEvent(valid)).toEqual({});
  });

  it('flags end before start, bad capacity and non-http links', () => {
    const errors = validateEvent({ ...valid, endDate: '2030-01-01T09:00', capacity: '1.5', registerLink: 'javascript:alert(1)' });
    expect(Object.keys(errors).sort()).toEqual(['capacity', 'endDate', 'registerLink']);
  });

  it('checks poster type and size', () => {
    expect(validateEvent(valid, { type: 'application/pdf', size: 10 }).poster).toMatch(/JPEG/);
    expect(validateEvent(valid, { type: 'image/png', size: 6 * 1024 * 1024 }).poster).toMatch(/5 MB/);
  });
});

describe('safeNext (open-redirect guard)', () => {
  it('only allows same-site relative paths', () => {
    expect(safeNext('/events/1')).toBe('/events/1');
    expect(safeNext('//evil.com')).toBeNull();
    expect(safeNext('/\\evil.com')).toBeNull();
    expect(safeNext('https://evil.com')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
