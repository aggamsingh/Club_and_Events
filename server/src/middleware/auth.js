import jwt from 'jsonwebtoken';
import { getConfig } from '../config.js';
import { User } from '../models/User.js';
import { forbidden, unauthorized } from '../utils/httpError.js';

export const SESSION_COOKIE = 'eh_session';

function cookieOptions() {
  const { isProd, crossSite } = getConfig();
  return {
    httpOnly: true, // not readable from JS → a stolen-token XSS can't exfiltrate it
    secure: isProd || crossSite,
    // Lax blocks the cookie on cross-site POST/PUT/DELETE, which is our CSRF defence.
    // A split-origin deployment has to use None (plus the CORS allowlist).
    sameSite: crossSite ? 'none' : 'lax',
    path: '/',
  };
}

export function issueSession(res, user) {
  const { jwtSecret, jwtExpiresIn } = getConfig();
  const token = jwt.sign({ sub: user.id, role: user.role, ver: user.tokenVersion }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });
  const { exp } = jwt.decode(token);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: new Date(exp * 1000) });
}

export function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

/**
 * Resolves the session cookie to a fresh User document (or null). The DB lookup
 * means deleted users and changed roles take effect immediately, and tokenVersion
 * lets a password change revoke every other session.
 */
async function resolveUser(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, getConfig().jwtSecret);
  } catch {
    return null;
  }
  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.ver) return null;
  return user;
}

/** Attaches req.user when a valid session exists; never rejects. */
export async function optionalAuth(req, res, next) {
  req.user = await resolveUser(req);
  next();
}

/** Rejects with 401 unless logged in; with roles given, 403 unless the user has one of them. */
export function requireAuth(...roles) {
  return async (req, res, next) => {
    req.user = await resolveUser(req);
    if (!req.user) {
      clearSession(res);
      throw unauthorized();
    }
    if (roles.length && !roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/** Admins can manage anything; clubs only their own events. */
export function assertCanManageEvent(user, event) {
  const ownerId = event.club?._id ?? event.club;
  if (user.role === 'admin') return;
  if (user.role === 'club' && ownerId?.equals(user._id)) return;
  throw forbidden('Only the club that created this event can change it.');
}
