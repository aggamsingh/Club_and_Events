# Testing

## Strategy

Most of the risk in this app is on the **server**: authorisation, validation, concurrency, file handling. So most tests are **API integration tests** against a real MongoDB. The UI has focused unit/component tests for the logic that is easy to get subtly wrong (date conversion, validation, redirect safety, escaping). Full user journeys were checked in a real browser (see *End-to-end* below).

```
             ▲  fewer, slower
   E2E       │  browser run of the main journeys (manual script, not in CI yet)
   API       │  47 tests: real Express + real MongoDB (in memory) + real HTTP
   UI/unit   │  13 tests: pure functions + component rendering
             ▼  more, faster
```

| Suite | Runner | Where | Count |
| --- | --- | --- | --- |
| API integration + server utils | `node:test` + Supertest + mongodb-memory-server | `server/tests/*.test.js` | 47 |
| UI unit + component | Vitest + Testing Library + jsdom | `client/src/**/*.test.{js,jsx}` | 13 |

Run everything with `npm test` at the repository root, or `npm test` inside `server/` or `client/`.

## Server tests

Each test file boots its **own in-memory MongoDB** and the real app (`createApp()`), and clears all collections before each test. Files run one at a time (`--test-concurrency=1`) to keep memory use predictable. Tests use bcrypt cost 4 instead of 12, purely for speed.

| File | What it proves |
| --- | --- |
| `auth.test.js` | Registration sets an httpOnly/SameSite cookie; **role smuggling ignored**; duplicate email → 409 with field error; weak password → 400; **same error for unknown email and wrong password**; logout; forged token → 401; **password change revokes other sessions but keeps the current one**; malformed JSON and unknown routes return JSON errors; health check and security headers (CSP, nosniff, no `x-powered-by`) |
| `events.test.js` | Club creates an event with a poster that is **served back byte-for-byte from GridFS** with immutable caching; events without posters; anonymous 401 / student 403; validation (end > start, **`javascript:` links rejected**, capacity ≥ 1); **disguised files rejected by magic bytes**; > 5 MB → 413; **REGRESSION v1: a club can't edit or delete another club's event**; owner edits, replaces the poster (**old file deleted**), removes the poster, deletes; admin moderation; bad vs unknown ids (400 vs 404); feed ordering for upcoming (**incl. live**) vs past; category/club filters; case-insensitive partial search; **regex characters treated literally**; pagination and `limit` cap; `.ics` format and escaping |
| `rsvp.test.js` | RSVP → shows on event + "My events" → cancel; duplicate → 409; only students; **10 concurrent RSVPs for 3 seats → exactly 3 succeed, count = 3**; ended events rejected; capacity can't go below existing RSVPs; attendee list restricted to owner; **CSV formula injection neutralised**; club dashboard stats; admin stats + 403 for non-admins |
| `clubs.test.js` | Only admins create clubs (v1 allowed anyone), and the new club can log in; **case-insensitive unique club names**; public directory with upcoming counts, **emails hidden from the public but shown to admins**; club edits its description but can't rename itself or edit others; **admin reset revokes the club's sessions**; **club deletion cascades** to events, RSVPs and posters |
| `cross-site.test.js` | Split-origin mode: CORS only for the configured origin, `SameSite=None; Secure` cookie, **writes without `X-Requested-With` rejected** (CSRF) |
| `utils.test.js` | `escapeRegex`, `slugify`, `csvCell`, `sniffImageType` (JPEG/PNG/GIF/WebP vs HTML), ICS escaping + **75-octet line folding** |

## Client tests

| File | What it proves |
| --- | --- |
| `src/lib/lib.test.js` | Date range formatting (same-day vs multi-day); **`datetime-local` ↔ UTC round-trip**; relative days ("today", "tomorrow"); seat labels; query-string building; client event validation mirrors the server's rules (end > start, capacity, http(s) links, poster type/size); **open-redirect guard** (`//evil.com`, `/\evil.com`, absolute URLs rejected) |
| `src/components/EventCard.test.jsx` | Card links to the event and shows venue, club, seats and badges; accessible placeholder when there's no poster; **HTML in titles is rendered as text, not markup**; "Live now" badge |

## End-to-end (browser) verification

Before release, the production build was served by Express against a seeded database and driven with headless Chrome (Puppeteer). The run covered:

- feed rendering, live search (URL updates), category filter, past tab;
- anonymous access to `/dashboard` redirecting to `/login?next=/dashboard`;
- student sign-up → RSVP → "You're going" → My events; student blocked from `/admin`;
- club login → dashboard → client-side validation error → create an event with a poster upload → poster rendered from GridFS → edit;
- a rival club blocked from the edit page;
- admin login → create a club with a generated password;
- mobile viewport (390 px): no horizontal overflow, menu works;
- **zero console errors and no unexpected HTTP errors** during the whole run.

Turning this script into a Playwright suite in CI is a natural next step.

## Manual checks that aren't automated

- `npm run seed` / `seed:demo` against a fresh database, run twice to confirm idempotency.
- `npm run migrate:v1 -- --dry-run` and a real run against v1-shaped data (clubs keep their passwords, posters imported into GridFS, `javascript:` links dropped, safe to re-run).
- `docker compose up --build` → both containers healthy → seed inside the container → app served on `:5000`.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request:

1. **server:** `npm ci` → `npm audit --omit=dev --audit-level=high` → `npm test` (the MongoDB binary is cached between runs)
2. **client:** `npm ci` → `npm run lint` → `npm test` → `npm run build`
3. **docker:** builds the production image (after both jobs pass)
