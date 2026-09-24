/** Only follow same-site relative paths after login (prevents open redirects like ?next=//evil.com). */
export function safeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null;
}
