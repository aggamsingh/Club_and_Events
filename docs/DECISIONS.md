# Architecture Decision Records

Each record gives the **context**, the **decision**, the **alternatives** considered and the **tradeoffs** accepted. Where a decision would change at larger scale, the record says when to revisit it.

| # | Decision |
| --- | --- |
| [001](#adr-001--rebuild-as-v2-rather-than-patch-v1) | Rebuild as v2 rather than patch v1 |
| [002](#adr-002--one-react-spa-built-with-vite) | One React SPA built with Vite |
| [003](#adr-003--same-origin-deployment-express-serves-the-spa) | Same-origin deployment: Express serves the SPA |
| [004](#adr-004--one-users-collection-with-a-role-field) | One `users` collection with a `role` field |
| [005](#adr-005--jwt-in-an-httponly-samesite-cookie-verified-against-the-db) | JWT in an httpOnly SameSite cookie, verified against the DB |
| [006](#adr-006--rsvp-concurrency-via-unique-index--conditional-atomic-increment) | RSVP concurrency via unique index + conditional atomic increment |
| [007](#adr-007--store-posters-in-mongodb-gridfs) | Store posters in MongoDB GridFS |
| [008](#adr-008--escaped-regex-search--offset-pagination) | Escaped-regex search + offset pagination |
| [009](#adr-009--tanstack-query-for-server-state-url-for-filter-state-no-global-store) | TanStack Query for server state, URL for filters, no global store |
| [010](#adr-010--thin-route-modules-explicit-serializers-no-controller-layer) | Thin route modules + explicit serializers, no controller layer |
| [011](#adr-011--zod-validation-at-the-http-boundary) | Zod validation at the HTTP boundary |
| [012](#adr-012--javascript-esm-not-typescript) | JavaScript (ESM), not TypeScript |
| [013](#adr-013--real-database-tests-with-nodetest--supertest--mongodb-memory-server) | Real-database tests with node:test + Supertest + mongodb-memory-server |
| [014](#adr-014--tailwind-css-4--small-in-house-component-kit) | Tailwind CSS 4 + small in-house component kit |
| [015](#adr-015--dates-stored-in-utc-converted-in-the-browser) | Dates stored in UTC, converted in the browser |
| [016](#adr-016--put-with-multipart-for-event-edits) | PUT with multipart for event edits |
| [017](#adr-017--hard-deletes-with-explicit-cascades) | Hard deletes with explicit cascades |
| [018](#adr-018--admins-create-clubs-students-self-register) | Admins create clubs; students self-register |

---

## ADR-001 — Rebuild as v2 rather than patch v1

**Context.** v1 had a single 250-line `index.js` with a hard-coded database password, two half-finished front ends (vanilla HTML pages *and* a Create React App that only showed an `alert()` after login), "auth" that was just a club name in `sessionStorage`, an authorisation hole (any club could edit any event), stored XSS through `innerHTML`, and `node_modules` committed to git.

**Decision.** Keep the product idea and the data (with a migration script) but rebuild the code base: modular API, one React front end, tests, CI, Docker.

**Alternatives.** Patch v1 in place, i.e. fix the password and the ownership check.

**Tradeoffs.** A rebuild costs more up front and throws away the v1 HTML pages. But almost every v1 file had a security or structural problem, and two front ends would have to be maintained forever. `scripts/migrate-v1.js` keeps existing clubs (and their passwords) and events.

---

## ADR-002 — One React SPA built with Vite

**Context.** v1 used Create React App, which is deprecated and unmaintained, plus separate static HTML pages.

**Decision.** A single React 19 SPA built with **Vite 8**, routed with **React Router 7** in library ("data router") mode.

**Alternatives.**
- **Next.js / React Router framework mode (SSR):** better SEO and first paint, but needs a Node renderer and duplicates auth concerns between server components and the API. For a logged-in, campus-internal app, SEO barely matters.
- **Keep vanilla HTML/JS:** no build step, but manual DOM updates led straight to v1's `innerHTML` XSS and duplicated logic.

**Tradeoffs.** Client-side rendering means a blank page until JS loads (mitigated by a ~127 KB gzipped initial JS payload and code-split role pages) and weaker SEO for public event pages. **Revisit** if public event pages need link previews or search ranking: add pre-rendering or move to React Router framework mode.

---

## ADR-003 — Same-origin deployment: Express serves the SPA

**Context.** The session lives in a cookie (ADR-005). Browsers increasingly block third-party cookies, and cross-origin requests need CORS.

**Decision.** In production, Express serves `client/dist` and falls back to `index.html` for client routes. In development, Vite proxies `/api` to Express. Both give **one origin**, so the cookie is first-party, `SameSite=Lax` works, and **no CORS is needed**.

**Alternatives.** Front end on Vercel/Netlify with the API elsewhere. This is supported through `CLIENT_ORIGIN` + `VITE_API_URL`, which switches the cookie to `SameSite=None; Secure` and enables a CORS allowlist.

**Tradeoffs.** A single container means the static files don't get a global CDN edge by default (you can put Cloudflare in front). In return you get one deploy, one URL, simpler security and no CORS preflights. Hashed assets are served `immutable` for a year, so a CDN in front works well.

---

## ADR-004 — One `users` collection with a `role` field

**Context.** v1 had a `clubs` collection only. v2 adds students and admins, and all three log in.

**Decision.** One `User` model with `role ∈ {admin, club, student}`. Events reference their club by `ObjectId` (v1 used the club's *name* as a string, so renaming a club orphaned its events).

**Alternatives.** Separate `clubs`, `students` and `admins` collections, or a `users` collection plus a separate `clubProfiles` collection.

**Tradeoffs.** Club-specific fields (`description`) sit on every user document, empty for students. That is acceptable for one small field. It buys one login flow, one session mechanism and role checks as a single string comparison. Club names must be unique but student names must not, so the unique index is **partial** (`role: 'club'`) with a **case-insensitive collation**. **Revisit** if clubs gain many profile fields, then split out a profile document.

---

## ADR-005 — JWT in an httpOnly SameSite cookie, verified against the DB

**Context.** v1 had no real authentication. The login page stored `loggedInClubName` in `sessionStorage`, and the password was re-sent on every write.

**Decision.** On login, sign a JWT `{ sub, role, ver }` (7-day expiry) and set it as an **httpOnly, Secure (in prod), SameSite=Lax** cookie. On each authenticated request, verify the signature **and** load the user, comparing `tokenVersion`.

**Alternatives.**
| Option | Why not |
| --- | --- |
| JWT in `localStorage` + `Authorization` header | Any XSS can read and steal the token. Needs manual header handling. |
| Pure stateless JWT (no DB lookup) | Can't revoke tokens, so a password change or account deletion wouldn't log anyone out until expiry. |
| Server-side sessions (`express-session` + Mongo store) | A perfectly good choice. It needs a sessions collection and cleanup, and gives the same result as the JWT + `tokenVersion` hybrid. |
| OAuth / "Sign in with Google" | Great for students later. Out of scope for the first version; campus SSO varies. |

**Tradeoffs.** One extra indexed `findById` per authenticated request (sub-millisecond on an `_id` lookup). In return, deleted users and role changes take effect immediately, and a password change revokes every other session. CSRF defence relies on `SameSite=Lax` plus JSON/multipart APIs. In split-origin mode the cookie must be `SameSite=None`, so the API also requires an `X-Requested-With` header on writes. That forces a CORS preflight only allowlisted origins pass (see SECURITY.md).

---

## ADR-006 — RSVP concurrency via unique index + conditional atomic increment

**Context.** Events can have a capacity, and two students clicking "RSVP" at the same moment for the last seat must not both get in. Each student may RSVP only once.

**Decision.** Three steps (see ARCHITECTURE §5):
1. Insert `Rsvp{event,user}`. The **unique compound index** rejects duplicates.
2. `findOneAndUpdate({ _id, $or: [{capacity: null}, {$expr: {$lt: ['$rsvpCount', '$capacity']}}] }, { $inc: { rsvpCount: 1 } })`. MongoDB applies single-document updates atomically, so this matches at most `capacity` times.
3. If step 2 matched nothing, delete the step-1 RSVP (a compensating action) and return 409.

**Alternatives.**
| Option | Why not |
| --- | --- |
| Read `rsvpCount`, compare, then write | Classic race: two requests read "1 left" and both write. |
| Multi-document transaction | Correct, but needs a replica set (so no standalone `mongod`, slower tests) and more code for the same guarantee. |
| Count `Rsvp` documents on every read | Always accurate, but costs an extra `count` per event card and doesn't by itself prevent over-booking. |

**Tradeoffs.** `rsvpCount` is **denormalised**. If the process crashed between steps 1 and 3, an RSVP could exist without a matching seat count. That window is milliseconds, and it errs on the safe side (never over-books). A test proves the guarantee under load: 10 concurrent requests, 3 seats, exactly 3 successes.

---

## ADR-007 — Store posters in MongoDB GridFS

**Context.** v1 wrote uploads to the server's local `uploads/` folder. PaaS hosts (Render, Railway, Heroku) have **ephemeral disks**, so every deploy would delete every poster. v1 also served any file type with no size limit.

**Decision.** Buffer uploads in memory (≤ 5 MB), verify the **magic bytes**, and store them in a GridFS bucket `posters`. Serve them via `GET /api/posters/:id` with immutable caching.

**Alternatives.**
| Option | Pros | Cons |
| --- | --- | --- |
| Local disk (v1) | Simplest | Lost on redeploy, can't scale past one instance |
| S3 / Cloudflare R2 | Cheap, CDN-friendly, industry standard | Extra account, credentials, SDK; overkill for a campus app |
| Cloudinary | Automatic resizing/WebP | Third-party dependency and quota; vendor lock-in |
| **GridFS** | Works wherever MongoDB works; backups include images; no new infrastructure | Images use DB storage (Atlas free tier = 512 MB); DB serves image bytes |

**Tradeoffs.** Database storage is pricier per GB than object storage, and image traffic passes through Node. With immutable URLs and long cache headers, each poster is fetched from the server roughly once per browser. **Revisit** once posters exceed a few hundred MB or traffic grows: the storage code is isolated in `services/posterStorage.js`, so swapping in S3/R2 touches one file.

---

## ADR-008 — Escaped-regex search + offset pagination

**Context.** Students search by partial words ("hack" → "Hackathon").

**Decision.** Case-insensitive **regex** over title, venue and description, with the user's input **escaped** so it is treated literally (no regex injection or ReDoS). Pagination uses `skip/limit` with a total count.

**Alternatives.** MongoDB `$text` index (fast and ranked, but matches whole words only, so "hack" wouldn't find "hackathon"), **Atlas Search** (fuzzy, relevance-ranked, but Atlas-only), cursor/keyset pagination.

**Tradeoffs.** A non-anchored regex can't use an index and scans the candidate set. The date and category filters (which *are* indexed) narrow that set first, and a campus has hundreds of events, not millions. Offset pagination slows down at deep pages and can shift if events are added while browsing. That is acceptable for a 12-per-page feed. **Revisit** at around 50k events: move to Atlas Search and keyset pagination.

---

## ADR-009 — TanStack Query for server state, URL for filter state, no global store

**Context.** Nearly all front-end state is a copy of server data (events, clubs, the current user).

**Decision.** **TanStack Query** owns server state: caching, deduplication, `keepPreviousData` pagination, and invalidation after mutations. Search, filters and page live in the **URL** (`useSearchParams`). Everything else is component `useState`. A global `QueryCache.onError` turns any 401 into "logged out".

**Alternatives.** Redux Toolkit / RTK Query, Zustand, or hand-written `useEffect` + `fetch` (as in v1's React attempt).

**Tradeoffs.** Adds a ~13 KB gzipped dependency and a caching model to learn. In return it removes loading/error boilerplate, race conditions between rapid requests and stale lists after edits. URL state makes every filtered view shareable. There is no truly global client state, so Redux would be ceremony.

---

## ADR-010 — Thin route modules + explicit serializers, no controller layer

**Context.** Common Express structures split routes / controllers / services / repositories.

**Decision.** Each resource has one route module whose handlers call Mongoose directly. Cross-cutting or security-sensitive logic lives in `middleware/` (auth, validation, errors), `services/` (file storage) and `utils/`. Responses go through **explicit serializers** (`serializeEvent`, `serializeUser`…) rather than returning Mongoose documents.

**Alternatives.** A full controller/service/repository layering.

**Tradeoffs.** The layering pays off when business logic is shared between entry points (HTTP, jobs, CLI) or when the persistence layer might change. Here handlers are 5–30 lines, and extra layers would mostly forward calls. Serializers are a deliberate exception: they are the documented API contract and make leaking `passwordHash`/`tokenVersion` impossible. **Revisit** when background jobs (reminder emails) need the same logic as HTTP handlers, then extract `services/events.js`.

---

## ADR-011 — Zod validation at the HTTP boundary

**Decision.** Every route declares Zod schemas for `params`, `query` and `body`. The `validate()` middleware parses them into `req.valid`, and handlers read **only** from `req.valid`. Mongoose schemas add a second layer of constraints (lengths, enums, `endDate > startDate`).

**Why Zod.** One schema gives parsing (string → number/date coercion for multipart forms), stripping of unknown keys (stops mass assignment, e.g. `role: "admin"` on register), and field-level error messages the UI shows next to inputs. Environment variables use the same library (`config.js`).

**Alternatives.** express-validator (chain-based, verbose), Joi (similar power, larger), Mongoose validation alone (runs too late, after the handler has already used the input).

**Tradeoffs.** Some rules exist in two places (Zod and Mongoose), plus a third copy on the client for instant feedback (`lib/validation.js`). Keep them in sync when rules change. A shared package would remove the duplication but needs a monorepo build step.

---

## ADR-012 — JavaScript (ESM), not TypeScript

**Decision.** Modern JavaScript with native ES modules on both sides. Types are enforced at runtime at the boundaries (Zod, Mongoose) and documented through serializers and API.md.

**Tradeoffs.** No compile-time checking of internal calls, so refactors rely on the test suites (60 tests) rather than the compiler. This keeps the toolchain simple (no `tsc`, no type builds for tests) and the code easy to follow for contributors who don't know TypeScript. **Revisit** if the team grows or a shared API-types package is wanted. Zod schemas can then generate types (`z.infer`).

---

## ADR-013 — Real-database tests with node:test + Supertest + mongodb-memory-server

**Decision.** API tests start the real Express app and a **real MongoDB binary in memory**, then make HTTP requests with Supertest. The runner is Node's built-in `node:test`. UI tests use Vitest + Testing Library.

**Alternatives.** Jest (heavier, and ESM support is still awkward), mocking Mongoose (fast but can't catch index/constraint/query bugs; the unique-index and atomic-update guarantees couldn't be tested at all), a shared test database (slow, flaky, needs setup).

**Tradeoffs.** The first run downloads a MongoDB binary (cached afterwards, also in CI), and each file takes about 1 s to boot a server. In exchange, tests exercise real indexes, real concurrency and real GridFS. That is exactly where v1's bugs lived.

---

## ADR-014 — Tailwind CSS 4 + small in-house component kit

**Decision.** Tailwind v4 (Vite plugin, `@theme` tokens) plus 14 small components in `components/ui.jsx` (Button, Field, Alert, Badge…). Icons come from `lucide-react`, tree-shaken. Modals use the native **`<dialog>`** element.

**Alternatives.** MUI / Chakra / Ant (fast to start, heavy bundles, generic look), shadcn/ui (excellent, but pulls in Radix and more setup than this app needs), plain CSS (v1: duplicated styles across four HTML files).

**Tradeoffs.** Hand-built components need their own accessibility care (labels, `aria-invalid`, focus rings, live regions). This has been done and is listed in REQUIREMENTS NFR-U2. `<dialog>` gives focus trapping and Esc-to-close for free. Font Awesome over a CDN was dropped, which removes a third-party request and lets the CSP stay `'self'`-only.

---

## ADR-015 — Dates stored in UTC, converted in the browser

**Context.** v1 sent `datetime-local` strings like `2026-10-01T18:00` (no timezone) and the server interpreted them in *its own* timezone. On a UTC host, an Indian club's 6 pm event became 11:30 pm.

**Decision.** The browser converts `datetime-local` → ISO-8601 UTC (`new Date(value).toISOString()`) before sending. The server stores and returns UTC. The UI formats with `Intl.DateTimeFormat` in the viewer's timezone. The `.ics` export uses UTC (`…Z`), which every calendar app converts.

**Tradeoffs.** Everyone sees times in their own timezone. For a single campus that is also the event's timezone, and for remote viewers it's arguably better. An explicit per-event timezone field would be needed for multi-campus use.

---

## ADR-016 — PUT with multipart for event edits

**Decision.** `PUT /api/events/:id` with the full editable field set as `multipart/form-data`. An optional `poster` replaces the image, and `removePoster=true` deletes it.

**Alternatives.** `PATCH` with partial JSON plus a separate `PUT /events/:id/poster` endpoint.

**Tradeoffs.** The edit form always sends every field anyway, so PUT keeps one request per save and lets the server validate cross-field rules (`endDate > startDate`, capacity ≥ current RSVPs) against the complete new state. A separate poster endpoint would be cleaner REST, but it would mean two requests and partial-failure states in the UI.

---

## ADR-017 — Hard deletes with explicit cascades

**Decision.** Deleting an event removes its RSVPs and poster. Deleting a club removes its events, their RSVPs and posters. The primary document is deleted first, then dependents, so a failure midway leaves harmless orphans rather than a broken visible record.

**Alternatives.** Soft deletes (`deletedAt`), which allow undo and auditing but make every query add a filter, and unique indexes more complex.

**Tradeoffs.** No undo. The UI makes up for this with explicit confirmation dialogs that state what will be removed. **Revisit** if audit or legal requirements appear.

---

## ADR-018 — Admins create clubs; students self-register

**Context.** In v1, anyone could `POST /api/clubs` and become a publishing club.

**Decision.** Only admins create club accounts (with a generated initial password the club can change). Public registration always creates a **student**. The first admin comes from the idempotent seed script (`ADMIN_EMAIL`/`ADMIN_PASSWORD`).

**Tradeoffs.** Onboarding a club needs a human. That is intended, since publishing to the whole campus is a privilege. A request-to-join workflow with approval is listed as future work.
