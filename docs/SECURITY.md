# Security

## 1. ⚠️ Incident: database credentials committed in v1

The original v1 commit, which was public on GitHub for several months, contained a **MongoDB Atlas connection string with a username and password** hard-coded in `server/index.js`, plus a committed `server/.env`.

**What was done:**

1. **Moved to a new database.** v2 runs on a new Atlas account and cluster with a least-privilege user (`readWrite` on the `eventhub` database only) and an IP allowlist. The v1 cluster is no longer used by the project.
2. **Scrubbed history.** The v1 commit was rewritten: the connection string in `server/index.js` is replaced by `process.env.MONGO_URI`, and `server/.env`, `server/uploads/` and `server/node_modules/` were removed. The rewritten history was force-pushed.

**What remains true:** rewriting history keeps the secret out of *future* clones. It does not un-leak it, because anyone who fetched the repository while it was public may still have it. The v1 credential must therefore be treated as **permanently compromised** and must never be reused. If the old Atlas account can be accessed, its cluster should be terminated.

**Going forward:** consider turning on **GitHub secret scanning / push protection** for the repository.

v2 reads every secret from environment variables, validated at boot by `server/src/config.js`. `.gitignore` excludes `.env*` (except `.env.example`), and `.dockerignore` keeps them out of images.

## 2. v1 audit → v2 fixes

| # | v1 finding | Severity | v2 fix | Regression test |
| --- | --- | --- | --- | --- |
| 1 | DB password hard-coded and committed; `.env` committed but never loaded | Critical | Env-only config, Zod-validated; `.env` ignored | – (process) |
| 2 | **Broken access control:** `PUT /api/events/:id` checked the password of the `clubName` *in the request body*, not the event's owner, so any club could edit any event | High | Session-based identity + `assertCanManageEvent` ownership check on every mutation | `events.test.js` "REGRESSION v1" |
| 3 | `POST /api/clubs` unauthenticated: anyone could create a publishing club | High | Admin-only | `clubs.test.js` |
| 4 | "Login" stored the club name in `sessionStorage`; editable in DevTools | High | Signed JWT in httpOnly cookie, verified server-side with DB lookup | `auth.test.js` |
| 5 | Stored **XSS**: event fields inserted with `innerHTML`; `registerLink` could be `javascript:` | High | React-only rendering (auto-escaped), http(s)-only URL validation, strict CSP | `EventCard.test.jsx`, `events.test.js` |
| 6 | Unrestricted upload: any file type, any size, trusted filename extension | High | 5 MB limit, image mimetypes only, **magic-byte verification**, stored in GridFS (never on a web-served path) | `events.test.js` |
| 7 | Password re-sent with every write request | Medium | Password used only at login and password change | – |
| 8 | No rate limiting on login | Medium | 10 failed attempts / 15 min / IP; 600 req / 15 min / IP globally | – (config) |
| 9 | Mass assignment: request bodies passed to Mongoose | Medium | Zod schemas strip unknown keys; handlers read only `req.valid` | `auth.test.js` (role smuggling) |
| 10 | No security headers | Medium | `helmet`: CSP, HSTS, `X-Content-Type-Options`, `frame-ancestors`, etc.; `x-powered-by` disabled | `auth.test.js` |
| 11 | Stack traces / raw errors possible in responses | Low | Central error handler; 500s return a generic message | `auth.test.js` |
| 12 | `node_modules` (2,000+ files) committed | Low (hygiene) | Ignored; lockfiles committed instead | – |

## 3. Threat model (STRIDE summary)

| Threat | Example | Controls |
| --- | --- | --- |
| **Spoofing** | Pretending to be a club | bcrypt (cost 12) passwords, signed JWT, DB lookup per request, constant-time login response for unknown emails, rate limits |
| **Tampering** | Editing another club's event; changing role at signup; forging a poster file type | Ownership checks, Zod whitelisting, server-sniffed content type, JWT signature |
| **Repudiation** | "I never RSVPed" | RSVP documents have `createdAt`; HTTP access logs via `morgan` (combined format in prod) |
| **Information disclosure** | Leaking password hashes, club emails, internal errors | `select: false` on hashes, explicit serializers, emails only for admins, generic 500s |
| **Denial of service** | Huge uploads/bodies, regex bombs, login floods | 5 MB upload cap, 100 KB JSON cap, 1 file/20 fields per upload, escaped regex with 100-char limit, `limit ≤ 50` pagination, rate limiting |
| **Elevation of privilege** | Student calling admin endpoints | `requireAuth(...roles)` on every protected route; UI guards are cosmetic only |

## 4. Controls in detail

### Authentication & sessions
- Passwords are hashed with **bcrypt, cost 12**. The 8–72 character limit exists because bcrypt ignores bytes beyond 72.
- The session is a JWT `{ sub, role, ver }` signed with HS256 using `JWT_SECRET` (≥ 32 chars, enforced). It lasts 7 days by default (`JWT_EXPIRES_IN`).
- Cookie `eh_session`: `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`.
- **Revocation:** `tokenVersion` is bumped on password change or admin reset. Every request re-reads the user, so deleted users are logged out immediately.
- **User enumeration:** unknown emails still run a bcrypt comparison against a dummy hash and return the same message as a wrong password. (Registration does reveal that an email is taken; that is a usability tradeoff most sites make. Rate limiting keeps it slow.)

### CSRF
- **Same-origin mode (default):** `SameSite=Lax` means browsers don't send the cookie on cross-site POST/PUT/DELETE. APIs only accept JSON or multipart bodies.
- **Split-origin mode (`CLIENT_ORIGIN` set):** the cookie must be `SameSite=None`, so two extra controls kick in:
  1. a **CORS allowlist** with credentials, limited to the configured origins;
  2. every non-GET `/api` request must carry an **`X-Requested-With`** header. Custom headers can't be sent by plain HTML forms, and they force a CORS preflight that non-allowlisted origins fail.

  Both are covered by `tests/cross-site.test.js`.

### XSS & content
- The UI never uses `dangerouslySetInnerHTML`. Every piece of user content is rendered as text by React.
- CSP (`helmet` defaults + `img-src 'self' data: blob:`) sets `script-src 'self'`. No inline scripts and no third-party script or font CDNs.
- Registration links must be `http(s)`, validated server- and client-side. External links open with `rel="noopener noreferrer"`.
- Posters are served with their **sniffed** type and `X-Content-Type-Options: nosniff`, so an uploaded file can never be interpreted as HTML or script.

### Injection
- All queries go through Mongoose with typed values from Zod, so operator injection (`{"$gt": ""}`) is rejected: fields that must be strings are strings.
- ObjectIds are validated before any query (`400 Invalid id`).
- Search text is regex-escaped and length-limited.
- CSV export prefixes cells starting with `= + - @ \t \r` with `'` (**CSV/formula injection**).
- Post-login redirects accept only same-site relative paths (`safeNext`, **open redirect** protection).

### Infrastructure
- The Docker image runs as the non-root `node` user and contains only production dependencies.
- `trust proxy` defaults to 1 hop in production, so rate limits see the real client IP behind Render/Railway. Set `TRUST_PROXY` to match your proxy count. Too high a value lets clients spoof IPs through `X-Forwarded-For`.
- CI runs `npm audit --omit=dev --audit-level=high` on the server.

## 5. Known limitations / next steps

- No email verification, and no self-service password reset by email (an admin can reset club passwords).
- No account lockout beyond per-IP rate limiting. A distributed attack across many IPs is only slowed by bcrypt's cost.
- The rate-limit store is in memory, per process. With several instances, use a shared store (e.g. Redis via `rate-limit-redis`).
- No audit log of admin actions.
- The JWT secret has no rotation mechanism (rotating it logs everyone out). Supporting key ids (`kid`) would allow overlap.

## 6. Reporting

Please report vulnerabilities privately to the repository owner rather than opening a public issue.
