// Empty by default: the app and API share an origin (Vite proxy in dev, Express in prod).
// Set VITE_API_URL only for split deployments, e.g. https://api.example.com
const BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/**
 * Thin fetch wrapper: sends cookies, encodes JSON or FormData, and turns the API's
 * { error: { message, fields } } envelope into an ApiError.
 */
export async function api(path, { method = 'GET', body, form, signal } = {}) {
  // X-Requested-With is required by the API in split-origin deployments (CSRF defence);
  // harmless when same-origin.
  const init = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', 'X-Requested-With': 'EventHub' },
    signal,
  };
  if (form) {
    init.body = form; // the browser sets the multipart boundary itself
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(BASE + path, init);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.message ?? `Request failed (${res.status}).`, data?.error?.fields);
  }
  return data;
}

/** Absolute URL for API-served files (posters, .ics, CSV). */
export const apiUrl = (path) => (path ? BASE + path : null);

export function toQueryString(params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}
