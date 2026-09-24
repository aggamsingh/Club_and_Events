# Changelog

## 2.0.0 — Full rebuild

A ground-up rebuild of the v1 prototype. Data can be migrated with `server/scripts/migrate-v1.js`.

### Security
- **Removed the hard-coded MongoDB Atlas credentials** from source. Config now comes from validated environment variables. The v1 credential was scrubbed from git history and the project moved to a new database; the old credential is treated as permanently compromised (see docs/SECURITY.md).
- Real authentication: bcrypt passwords + signed JWT in an httpOnly, SameSite cookie, replacing a club name stored in `sessionStorage`.
- Fixed **broken access control**: clubs could edit other clubs' events. Ownership is now enforced on every write, with a regression test.
- Club creation restricted to admins (it was public).
- Fixed **stored XSS**: no more `innerHTML`, and registration links must be http(s). Added a strict Content Security Policy.
- Uploads limited to real images ≤ 5 MB, verified by magic bytes.
- Rate limiting, helmet security headers, Zod input validation with unknown-field stripping, CSV-injection-safe exports, open-redirect-safe login redirects, CSRF protection for split-origin deployments.
- Password changes and admin resets revoke existing sessions.

### Features
- Student accounts: sign up, RSVP/cancel with capacity limits (safe under concurrency), "My events".
- Event feed: search, category and club filters, upcoming/past tabs, pagination, URL-synced filters.
- Event pages: status badges (live/ended/full), seat bar, **Add to calendar (.ics)**, external registration link.
- Events gain description, category, capacity; posters are optional (generated covers otherwise).
- Club dashboard with stats, attendee list and **CSV export**, editable club profile.
- Club directory and club pages.
- Admin console: platform stats, create clubs (password generator), reset passwords, delete clubs (cascading).
- Account page with password change.
- Responsive mobile layout, accessible forms and dialogs, toast notifications.

### Architecture
- One React 19 SPA (Vite, React Router 7, TanStack Query, Tailwind 4) replaces both the vanilla HTML pages and the unfinished Create React App.
- Modular Express 5 API (routes / middleware / services / models) with an app factory for testing.
- Unified `users` collection with roles; events reference clubs by id instead of name.
- Posters stored in MongoDB GridFS instead of the ephemeral local disk.
- Dates handled as UTC end to end (fixes timezone shifts).
- Production serves API and client from one origin.

### Tooling
- 47 API integration tests (real in-memory MongoDB) + 13 UI tests.
- GitHub Actions CI (audit, lint, test, build, Docker build).
- Multi-stage non-root Dockerfile and Docker Compose stack.
- Seed script (admin + demo data) and v1 migration script.
- Full documentation in `docs/`.
- Stopped committing `node_modules`, `.env` and uploads.

## 1.0.0 — Prototype

- Express + MongoDB API with club login and event CRUD, poster uploads to local disk.
- Vanilla HTML pages (view events, club login, dashboard, event form) and a partial React app.
