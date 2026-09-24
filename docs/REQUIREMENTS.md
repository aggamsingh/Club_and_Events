# Requirements

This document states **what EventHub must do** (functional requirements), **how well it must do it** (non-functional requirements), and **what it deliberately doesn't do yet**. Each requirement has an ID so tests, decisions and issues can refer to it. The *Verified by* column points to the automated test that proves it (`S:` = server test file, `C:` = client test file, `E2E` = manual/browser run).

## 1. Problem statement

In v1, college clubs announced events through scattered posters, WhatsApp groups and Instagram stories. Students missed events, and clubs had no idea how many people would turn up. EventHub gives the campus **one place** where:

- clubs publish events and see who is coming,
- students find events worth attending and reserve a seat,
- an administrator controls which clubs may publish.

## 2. Actors

| Actor | How they get an account | Can do |
| --- | --- | --- |
| **Visitor** | – | Browse and search events and clubs, download calendar files |
| **Student** | Self-registration | Everything a visitor can, plus RSVP and "My events" |
| **Club** | Created by an admin | Manage its own events and profile, see and export attendees |
| **Admin** | Seed script (`npm run seed`) | Manage clubs, moderate any event, view platform stats |

## 3. Functional requirements

### 3.1 Accounts & authentication

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-A1 | Students can register with name, email and password (min 8 chars). Emails are unique, case-insensitive. | S: auth.test.js |
| FR-A2 | Any role logs in with email + password. Wrong email and wrong password give the **same** error. | S: auth.test.js |
| FR-A3 | Sessions persist across page reloads for 7 days (configurable) and end on logout. | S: auth.test.js |
| FR-A4 | A user can change their password. This signs out every other device. | S: auth.test.js |
| FR-A5 | Registration can never create an admin or club account, even if `role` is sent in the request. | S: auth.test.js |
| FR-A6 | After login, users go to their role's home (student → feed, club → dashboard, admin → admin) or to the page they were trying to reach. Only same-site paths are allowed as redirect targets. | C: lib.test.js (safeNext), E2E |

### 3.2 Event discovery (public)

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-E1 | The feed lists **upcoming** events (including ones happening now), soonest first, 12 per page. | S: events.test.js |
| FR-E2 | A **Past** tab lists ended events, most recent first. | S: events.test.js |
| FR-E3 | Case-insensitive partial search over title, venue and description. Special characters are treated literally. | S: events.test.js |
| FR-E4 | Filter by category (technical, cultural, sports, workshop, seminar, social, other) and by club. Filters combine. | S: events.test.js |
| FR-E5 | Filters, search and page number are reflected in the URL (shareable, survive refresh/back). | E2E |
| FR-E6 | Event page shows poster (or a generated cover), title, category, date range, venue, organiser with link, description, seats taken/left, "Live now"/"Ended"/"Full" status. | C: EventCard.test.jsx, E2E |
| FR-E7 | Any visitor can download an iCalendar (`.ics`) file for an event. | S: events.test.js, utils.test.js |
| FR-E8 | Club directory lists clubs A→Z with their number of upcoming events; each club has a page listing its events. | S: clubs.test.js |

### 3.3 RSVPs (students)

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-R1 | A logged-in student can RSVP to an upcoming event once, and cancel it. | S: rsvp.test.js |
| FR-R2 | If an event has a capacity, it can **never** be over-booked, even under simultaneous requests. | S: rsvp.test.js (10 concurrent students, 3 seats) |
| FR-R3 | RSVPs to events that have ended are rejected. | S: rsvp.test.js |
| FR-R4 | Only students can RSVP (clubs/admins get 403, visitors 401). | S: rsvp.test.js |
| FR-R5 | "My events" shows the student's RSVPs split into upcoming and past. | S: rsvp.test.js |

### 3.4 Event management (clubs, admins)

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-M1 | A club can create an event: title (3–120), category, venue, start, end (> start), optional capacity (≥ 1), optional http(s) registration link, description (≤ 5000), optional poster. | S: events.test.js, C: lib.test.js |
| FR-M2 | Posters must be real JPEG/PNG/WebP/GIF images ≤ 5 MB. The **file contents** are checked, not the extension. | S: events.test.js |
| FR-M3 | A club can edit or delete **only its own** events. An admin can edit or delete any event. | S: events.test.js (v1 regression test) |
| FR-M4 | Replacing or removing a poster deletes the old file. Deleting an event deletes its poster and RSVPs. | S: events.test.js |
| FR-M5 | Capacity can't be reduced below the number of existing RSVPs. | S: rsvp.test.js |
| FR-M6 | The club dashboard shows all its events with RSVP counts, plus totals (events, upcoming, RSVPs). | S: rsvp.test.js |
| FR-M7 | The event owner (or an admin) can view the attendee list and export it as CSV. Nobody else can. | S: rsvp.test.js |
| FR-M8 | A club can edit its own description but not rename itself. | S: clubs.test.js |

### 3.5 Administration

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-X1 | Only an admin can create club accounts. Club names are unique, case-insensitive. | S: clubs.test.js |
| FR-X2 | An admin can reset a club's password, which revokes that club's existing sessions. | S: clubs.test.js |
| FR-X3 | An admin can delete a club, which removes its events, their posters and all RSVPs. | S: clubs.test.js |
| FR-X4 | The admin console shows counts of clubs, students, events, upcoming events and RSVPs. | S: rsvp.test.js |
| FR-X5 | Club login emails are visible to admins but not to the public. | S: clubs.test.js |
| FR-X6 | The first admin is created from environment variables by an idempotent seed script. | Manual (seed run) |

### 3.6 Data migration

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-D1 | Data from v1 (clubs with bcrypt passwords, events with `clubName`, posters on local disk) can be migrated in place. Clubs keep their passwords, posters move into GridFS, unsafe links are dropped. There is a dry-run mode. | Manual (run against v1-shaped data) |

## 4. Non-functional requirements

| ID | Category | Requirement | How it's met |
| --- | --- | --- | --- |
| NFR-S1 | Security | Passwords are never stored or returned in plaintext. | bcrypt cost 12, `select: false` on hash, explicit serializers |
| NFR-S2 | Security | Session tokens can't be read by JavaScript. | httpOnly cookie |
| NFR-S3 | Security | Cross-site request forgery is prevented. | `SameSite=Lax` cookie; in split-origin mode, CORS allowlist + required `X-Requested-With` header (S: cross-site.test.js) |
| NFR-S4 | Security | User content can't execute script (XSS). | React escaping everywhere, no `innerHTML`, strict CSP, http(s)-only links |
| NFR-S5 | Security | All input is validated and unknown fields are dropped. | Zod schemas on every body/query/param |
| NFR-S6 | Security | Credential stuffing and brute force are slowed down. | 10 failed attempts / 15 min / IP on login & register, 600 req / 15 min / IP overall |
| NFR-S7 | Security | No secrets in the repository. | `.env` ignored, Zod-validated config, `.env.example` |
| NFR-S8 | Security | Authorisation is enforced by the server, never only the UI. | `requireAuth(...roles)` + `assertCanManageEvent` on every mutating route |
| NFR-P1 | Performance | Feed queries use indexes, not collection scans, for date filtering and sorting. | Compound indexes `{endDate, startDate}`, `{club, startDate}`, `{category, endDate}` |
| NFR-P2 | Performance | Posters are cached by browsers and CDNs. | Immutable URLs with `Cache-Control: max-age=1y, immutable` + ETag |
| NFR-P3 | Performance | Students don't download admin/club code. | Route-level code splitting (`React.lazy`) |
| NFR-P4 | Performance | Responses are compressed and hashed assets cached long-term. | `compression`, `/assets` served `immutable` |
| NFR-R1 | Reliability | Concurrent RSVPs can't corrupt seat counts. | Unique index + conditional atomic `$inc` (see DECISIONS ADR-006) |
| NFR-R2 | Reliability | The process shuts down cleanly on deploys. | SIGTERM handler drains HTTP, then closes the DB pool |
| NFR-R3 | Reliability | Misconfiguration fails fast at boot with a readable message. | Zod-validated env in `config.js` |
| NFR-R4 | Reliability | Health can be probed by the platform. | `GET /api/health` (checks DB), Docker `HEALTHCHECK` |
| NFR-U1 | Usability | Works on phones (≥ 360 px) with no horizontal scroll. | Responsive Tailwind layout, mobile nav; E2E check |
| NFR-U2 | Accessibility | Keyboard- and screen-reader-friendly. | Labelled fields with `aria-invalid`/`aria-describedby`, native `<dialog>`, skip link, focus rings, live regions, reduced-motion support |
| NFR-U3 | Usability | Dates show in the viewer's timezone. The server stores UTC. | `datetime-local` → ISO conversion on the client |
| NFR-M1 | Maintainability | The code is tested automatically on every push. | 47 API + 13 UI tests in GitHub Actions |
| NFR-M2 | Maintainability | One command runs the whole stack. | `docker compose up`, `npm run dev` |
| NFR-M3 | Portability | Runs anywhere Node and MongoDB run, without a separate file store. | Posters in GridFS, single container |

## 5. Constraints & assumptions

- A single campus with tens of clubs, thousands of students and hundreds of events a semester. Regex search and offset pagination are fine at this scale (see ADR-008).
- Club accounts are few and hand-created by an admin. There is no club self-signup or approval workflow.
- One MongoDB database. Transactions are not required (see ADR-006).
- Deployed over HTTPS behind at most one reverse proxy.

## 6. Out of scope (future work)

These are deliberately **not** built. They are the natural next steps:

1. **Email** — verification, password reset by email, RSVP confirmations and reminders (e.g. Resend + a scheduled job).
2. **Waitlists** — auto-promote the next student when someone cancels a full event.
3. **QR check-in** — per-RSVP QR code scanned at the door to record actual attendance.
4. **Event approval workflow** — events start as `pending` until an admin approves them.
5. **Recurring events** and multi-session events.
6. **Full-text relevance search** — MongoDB Atlas Search or a text index once data grows.
7. **Image processing** — resizing and WebP conversion (e.g. `sharp`) or a CDN like Cloudinary.
8. **Analytics** — page views and RSVP conversion per event, charts on the club dashboard.
9. **Notifications** — follow a club, get alerted about its new events.
10. **Internationalisation** — UI strings are English-only.
