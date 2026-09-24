# Tech Stack

Every runtime dependency and tool in EventHub: **what it is**, **what it does in this project**, and **why it was chosen**. Versions are the ones in the lockfiles at the time of writing. The larger architectural choices are argued in [DECISIONS.md](DECISIONS.md).

## Runtime platform

| Tech | Version | Role here | Why |
| --- | --- | --- | --- |
| **Node.js** | ≥ 20.19 (22 LTS in Docker/CI) | Runs the API, scripts and tooling | One language across the stack; native ES modules, `node:test`, `--watch` built in |
| **MongoDB** | 7.x (Atlas or local) | Primary database + image storage (GridFS) | The document model fits events/clubs; free Atlas tier; atomic single-document updates power the RSVP guarantee |

## Back end (`server/`)

| Package | Version | What it does here | Why this one |
| --- | --- | --- | --- |
| **express** | 5.2 | HTTP server and routing | Express 5 forwards async errors to the error handler (no wrapper boilerplate), and has stricter path matching |
| **mongoose** | 9.10 | Schemas, validation, indexes, queries, population | Declarative schemas and indexes in code; `populate` for club names; mature |
| **mongodb** (driver, via mongoose) | 7.6 | `GridFSBucket` for poster storage | Bundled with Mongoose, so no extra dependency |
| **zod** | 4.6 | Validates and coerces every request's params/query/body, and the environment | One schema gives types, coercion, stripping of unknown keys and field-level messages ([ADR-011](DECISIONS.md#adr-011--zod-validation-at-the-http-boundary)) |
| **jsonwebtoken** | 9.0 | Signs and verifies session tokens | De-facto standard; HS256 with a single secret is enough for one service |
| **bcrypt** | 6.0 | Password hashing (cost 12) | Native, fast, prebuilt binaries for all platforms; adaptive cost |
| **cookie-parser** | 1.4 | Reads the `eh_session` cookie | Tiny, standard |
| **multer** | 2.4 | Parses `multipart/form-data` poster uploads into memory with size/count limits | Standard Express upload middleware; v2 fixes older DoS issues |
| **helmet** | 8.3 | Security headers: CSP, HSTS, nosniff, frame-ancestors, referrer policy… | Secure defaults in one line |
| **express-rate-limit** | 8.7 | Brute-force protection on auth; global request cap | Drop-in, standard `RateLimit` headers, pluggable store for multi-instance |
| **cors** | 2.8 | Credentialed CORS allowlist, **only** in split-origin mode | Not needed at all in the default same-origin deployment |
| **compression** | 1.8 | gzip for JSON, JS and CSS responses | Smaller payloads at negligible CPU cost |
| **morgan** | 1.12 | Access logs (`dev` locally, `combined` in production) | Simple; platform log drains ingest `combined` format |
| **dotenv** | 18.0 | Loads `server/.env` in development | Standard; `quiet` mode avoids log noise |

### Back-end dev & test

| Package | Version | Purpose |
| --- | --- | --- |
| **node:test** (built-in) | – | Test runner with `describe/it`, hooks, spec reporter; zero dependencies |
| **supertest** | 7.3 | Sends real HTTP requests to the Express app without opening a port; `agent()` keeps cookies between requests |
| **mongodb-memory-server** | 11.3 | Starts a real `mongod` in memory per test file, so indexes, atomic updates and GridFS are genuinely exercised |

## Front end (`client/`)

| Package | Version | What it does here | Why this one |
| --- | --- | --- | --- |
| **react** / **react-dom** | 19.3 | UI rendering | React 19's native `<title>` hoisting replaces a head-management library |
| **react-router** | 7.18 | Client routing, `useSearchParams` for filter state, `ScrollRestoration`, route error boundary | The standard; v7 merged `react-router-dom` into one package |
| **@tanstack/react-query** | 5.103 | Server-state cache: fetching, caching, dedupe, invalidation, `keepPreviousData`, global 401 handling | Removes hand-written loading/error/race code ([ADR-009](DECISIONS.md#adr-009--tanstack-query-for-server-state-url-for-filter-state-no-global-store)) |
| **tailwindcss** + **@tailwindcss/vite** | 4.3 | Styling with design tokens in `@theme` | Utility-first, no runtime cost, v4 needs no config file ([ADR-014](DECISIONS.md#adr-014--tailwind-css-4--small-in-house-component-kit)) |
| **lucide-react** | 1.48 | SVG icons | Tree-shakeable (only the icons used ship); replaces v1's Font Awesome CDN, keeping the CSP strict |

Browser APIs used instead of libraries: `fetch` + `FormData` (HTTP), `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` (dates), `<dialog>` (modals), `URL.createObjectURL` (poster preview), `crypto.getRandomValues` (password generator).

### Front-end build, lint & test

| Package | Version | Purpose |
| --- | --- | --- |
| **vite** | 8.3 | Dev server with HMR and an `/api` proxy; production build with hashed, code-split chunks |
| **@vitejs/plugin-react** | 6.1 | JSX transform + React Fast Refresh |
| **vitest** | 4.1 | Unit/component tests that reuse the Vite config |
| **@testing-library/react** + **jest-dom** + **user-event** | 16.3 / 6.9 / 14.6 | Test components the way a user sees them (roles, labels, text) |
| **jsdom** | 29.1 | DOM implementation for tests |
| **eslint** + **@eslint/js**, **eslint-plugin-react-hooks**, **eslint-plugin-react-refresh**, **globals** | 10.11 | Linting: recommended JS rules, Rules of Hooks (incl. React Compiler-era checks), Fast Refresh safety |

## DevOps & tooling

| Tool | Purpose |
| --- | --- |
| **Docker** (multi-stage `Dockerfile`) | Stage 1 builds the client, stage 2 installs production server deps, stage 3 is a slim `node:22-alpine` runtime running as non-root, with a `HEALTHCHECK` |
| **Docker Compose** | Local production-like stack: `mongo:7` (with health check and volume) + the app |
| **GitHub Actions** (`.github/workflows/ci.yml`) | On every push/PR: server `npm audit` + tests (MongoDB binary cached), client lint + tests + build, then a Docker build |
| **concurrently** | `npm run dev` at the root runs API and Vite together |
| **npm** lockfiles | Reproducible installs (`npm ci`) in CI and Docker |
| **VS Code launch configs** | Debug the API, the API tests, or the client in Chrome |

## Removed from v1 (and why)

| v1 dependency | Replaced by | Reason |
| --- | --- | --- |
| `react-scripts` (Create React App) | Vite | CRA is deprecated and unmaintained; slow builds |
| `web-vitals`, CRA test setup | Vitest + Testing Library | Part of the CRA template, unused |
| Font Awesome (CDN) | lucide-react | Third-party request, whole icon font downloaded, would need CSP exceptions |
| Local-disk uploads (`uploads/`) | GridFS | Ephemeral disks on PaaS; no validation |
| `nodemon` | `node --watch` | Built into Node |
| Hand-written HTML pages with `innerHTML` | React components | XSS, duplicated logic, two front ends |
