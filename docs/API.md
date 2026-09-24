# API Reference

Base path: `/api`. JSON in and out, except where noted (multipart uploads, images, `.ics`, CSV).

**Authentication:** a session cookie (`eh_session`, httpOnly) set by `/auth/login` or `/auth/register`. Browsers send it automatically. With `curl`, use a cookie jar (`-c jar -b jar`).

**Access legend:** 🌐 public · 🔓 any logged-in user · 🎓 student · 🏛 club · 🛡 admin · 👑 owner club *or* admin

**Errors:** always `{ "error": { "message": string, "fields"?: { [field]: string } } }`.

| Status | Meaning |
| --- | --- |
| 400 | Validation failed (see `fields`), malformed JSON, bad id, not an image |
| 401 | Not logged in / session expired or revoked / wrong credentials |
| 403 | Logged in but not allowed (wrong role, not the owner) |
| 404 | Resource or route not found |
| 409 | Conflict: duplicate email/club name, already RSVPed, event full, event ended |
| 413 | Poster larger than 5 MB |
| 429 | Rate limit exceeded (`RateLimit-*` headers show the window) |
| 500 | Unexpected server error (generic message; details are only in server logs) |

---

## Shared shapes

### User
```json
{ "id": "…", "name": "Coding Club", "email": "coding@demo.eventhub", "role": "club", "description": "…", "createdAt": "2026-09-24T10:00:00.000Z" }
```

### Event
```json
{
  "id": "6ab5…",
  "title": "24-Hour Hackathon",
  "description": "Form a team of up to four…",
  "category": "technical",
  "venue": "Tech Park, Hall A",
  "startDate": "2026-09-27T03:30:00.000Z",
  "endDate": "2026-09-28T03:30:00.000Z",
  "club": { "id": "6ab5…", "name": "Coding Club" },
  "posterUrl": "/api/posters/6ab5…",
  "registerLink": null,
  "capacity": 120,
  "rsvpCount": 3,
  "isFull": false,
  "status": "upcoming",
  "createdAt": "…",
  "updatedAt": "…"
}
```
- `category` ∈ `technical | cultural | sports | workshop | seminar | social | other`
- `status` ∈ `upcoming | live | past` (computed at request time)
- `capacity: null` = unlimited; `posterUrl: null` = no poster (the UI draws a cover)
- All dates are ISO-8601 UTC.

---

## Health

### `GET /health` 🌐
`200 { "status": "ok", "db": "connected" }` or `503 { "status": "degraded", "db": "disconnected" }`.

---

## Auth — `/auth`

Login and register are limited to **10 failed attempts per IP per 15 minutes**.

### `POST /auth/register` 🌐
Creates a **student** account and logs in. Any `role` field is ignored.
```json
{ "name": "Asha Rao", "email": "asha@college.edu", "password": "at-least-8-chars" }
```
`201 { "user": User }` + `Set-Cookie`. Errors: `400` (fields), `409` (email taken).

### `POST /auth/login` 🌐
```json
{ "email": "coding@demo.eventhub", "password": "demo-password" }
```
`200 { "user": User }` + `Set-Cookie`. `401 "Incorrect email or password."` for both unknown email and wrong password.

### `POST /auth/logout` 🌐
Clears the cookie. `204`.

### `GET /auth/me` 🌐
`200 { "user": User | null }`. Never returns 401, so the SPA can check the session quietly.

### `PATCH /auth/password` 🔓
```json
{ "currentPassword": "old", "newPassword": "new-password" }
```
`200 { "user": User }` + a fresh cookie. **All other sessions are revoked.** `400` if the current password is wrong.

---

## Events — `/events`

### `GET /events` 🌐
Query parameters (all optional):

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `q` | string ≤ 100 | – | case-insensitive substring over title, venue, description (regex-escaped) |
| `category` | enum | – | see Event shape |
| `club` | ObjectId | – | only this club's events |
| `when` | `upcoming \| past \| all` | `upcoming` | upcoming = `endDate ≥ now` (includes live events), sorted soonest first; past/all sorted newest first |
| `page` | int ≥ 1 | 1 | |
| `limit` | int 1–50 | 12 | |

```json
{ "items": [Event], "page": 1, "limit": 12, "total": 37, "totalPages": 4 }
```

### `GET /events/:id` 🌐 (personalised if logged in)
```json
{
  "event": { …Event, "clubDescription": "Hackathons, workshops…" },
  "viewer": { "hasRsvp": false, "canManage": false }
}
```
`hasRsvp` is only ever true for students. `canManage` is true for the owner club and admins.

### `POST /events` 🏛 — `multipart/form-data`
| Field | Required | Rules |
| --- | --- | --- |
| `title` | ✓ | 3–120 chars |
| `venue` | ✓ | 2–200 chars |
| `startDate` | ✓ | ISO date-time (send UTC; the client converts local time) |
| `endDate` | ✓ | after `startDate` |
| `category` | | enum, default `other` |
| `description` | | ≤ 5000 chars |
| `capacity` | | integer 1–100000, or empty for unlimited |
| `registerLink` | | `http://` or `https://` URL ≤ 500, or empty |
| `poster` | | file: JPEG/PNG/WebP/GIF, ≤ 5 MB, verified by magic bytes |

`201 { "event": Event }`.

```bash
curl -b jar -F title="Robotics 101" -F venue="Lab 3" -F category=workshop \
  -F startDate=2026-10-10T10:00:00Z -F endDate=2026-10-10T12:00:00Z \
  -F capacity=40 -F poster=@poster.png http://localhost:5000/api/events
```

### `PUT /events/:id` 👑 — `multipart/form-data`
Same fields as create. All editable fields are replaced (PUT semantics). Additionally:
- attach `poster` to **replace** the poster (the old file is deleted after saving),
- send `removePoster=true` to **remove** it.

`400` if `capacity` < current `rsvpCount`. `403` if you're a club that doesn't own the event.

### `DELETE /events/:id` 👑
Deletes the event, its RSVPs and its poster. `204`.

### `POST /events/:id/rsvp` 🎓
Reserves a seat. `201 { "event": Event, "viewer": { "hasRsvp": true, … } }`.
`409` if already RSVPed, the event is full, or it has ended. Over-booking is impossible even under concurrency (see ARCHITECTURE §5).

### `DELETE /events/:id/rsvp` 🎓
Cancels. `204`, or `404` if there was no RSVP.

### `GET /events/:id/attendees` 👑
`200 { "items": [{ "name", "email", "rsvpAt" }], "total": n }`, oldest RSVP first.
With `?format=csv`: `text/csv` attachment `<event-slug>-attendees.csv`. Cells starting with `= + - @` are prefixed with `'` to block spreadsheet formula injection.

### `GET /events/:id/calendar.ics` 🌐
`text/calendar` attachment (RFC 5545, CRLF line endings, lines folded at 75 octets). Works with Google Calendar, Apple Calendar and Outlook.

---

## Clubs — `/clubs`

### `GET /clubs` 🌐
`200 { "items": [{ "id", "name", "description", "upcomingCount", "email"? }] }`, sorted by name. `email` is included **only for admins**.

### `GET /clubs/:id` 🌐
`200 { "club": { "id", "name", "description" } }`.

### `POST /clubs` 🛡
```json
{ "name": "Robotics Society", "email": "robotics@college.edu", "password": "initial-pass", "description": "" }
```
`201 { "club": User }`. `409` if the email or the (case-insensitive) name is taken.

### `PATCH /clubs/:id` 🛡 or the club itself
```json
{ "name": "New name", "description": "New blurb" }
```
Admins can change both. A club can change **only its own `description`** (`403` otherwise).

### `POST /clubs/:id/reset-password` 🛡
`{ "password": "new-pass" }` → `204`. Revokes the club's existing sessions.

### `DELETE /clubs/:id` 🛡
Deletes the club and cascades to its events, their RSVPs and posters. `204`.

---

## Current user — `/me`

### `GET /me/rsvps` 🎓
`200 { "upcoming": [Event], "past": [Event] }`. Upcoming is soonest first, past is most recent first.

### `GET /me/events` 🏛
`200 { "items": [Event], "stats": { "total", "upcoming", "totalRsvps" } }`.

---

## Admin — `/admin`

### `GET /admin/stats` 🛡
`200 { "stats": { "clubs", "students", "events", "upcomingEvents", "rsvps" } }`.

---

## Posters — `/posters`

### `GET /posters/:id` 🌐
Streams the image from GridFS. Headers: sniffed `Content-Type`, `Content-Length`, `Cache-Control: public, max-age=31536000, immutable`, `ETag`. Returns `304` for a matching `If-None-Match`, and `404` for an unknown id.
