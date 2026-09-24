import { MAX_POSTER_BYTES, POSTER_TYPES } from './constants';

/**
 * Client-side checks mirror the server's zod schema so users get instant feedback.
 * The server still validates everything — this is for UX, not security.
 */
export function validateEvent(values, posterFile) {
  const errors = {};
  if (values.title.trim().length < 3) errors.title = 'Title must be at least 3 characters.';
  if (values.venue.trim().length < 2) errors.venue = 'Venue is required.';
  if (!values.startDate) errors.startDate = 'Start time is required.';
  if (!values.endDate) errors.endDate = 'End time is required.';
  if (values.startDate && values.endDate && new Date(values.endDate) <= new Date(values.startDate)) {
    errors.endDate = 'End time must be after the start time.';
  }
  if (values.capacity !== '' && (!Number.isInteger(Number(values.capacity)) || Number(values.capacity) < 1)) {
    errors.capacity = 'Capacity must be a whole number of at least 1 (or empty for unlimited).';
  }
  if (values.registerLink) {
    try {
      const url = new URL(values.registerLink);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      errors.registerLink = 'Must be a valid http(s) link.';
    }
  }
  if (values.description.length > 5000) errors.description = 'Description is too long (max 5000 characters).';
  if (posterFile) {
    if (!POSTER_TYPES.includes(posterFile.type)) errors.poster = 'Poster must be a JPEG, PNG, WebP or GIF image.';
    else if (posterFile.size > MAX_POSTER_BYTES) errors.poster = 'Poster must be 5 MB or smaller.';
  }
  return errors;
}
