# Deployment

EventHub ships as **one Node process** that serves both the API and the built React app. You need that process (or its Docker image) and a MongoDB database.

## Environment variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `MONGO_URI` | ✓ | – | e.g. `mongodb+srv://user:pass@cluster.mongodb.net/eventhub?retryWrites=true&w=majority` |
| `JWT_SECRET` | ✓ | – | ≥ 32 random characters. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Changing it logs everyone out. |
| `NODE_ENV` | | `development` | Set `production` in production (Secure cookies, combined logs) |
| `PORT` | | `5000` | Most platforms inject this |
| `JWT_EXPIRES_IN` | | `7d` | Any [`ms`](https://github.com/vercel/ms) duration |
| `TRUST_PROXY` | | `1` in production, else `0` | Number of reverse proxies in front of the app. Matters for rate limiting by real IP. |
| `CLIENT_ORIGIN` | | – | **Only** for split-origin hosting (see below). Comma-separated origins. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | for seeding | – | Used by `npm run seed` to create/refresh the admin |

The server validates these at boot and exits with a readable message if one is missing or invalid.

## Option 1 — Render (or Railway / Fly.io) + MongoDB Atlas (recommended)

1. **Atlas:** create a free M0 cluster, a database user **with a new password**, and allow network access from your host (Render publishes its outbound IPs; `0.0.0.0/0` is the less secure fallback). Copy the connection string.
2. **Render → New → Web Service** from your GitHub repo. Choose **Docker** (it uses the root `Dockerfile`), or native Node:
   - Build command: `npm ci --prefix server --omit=dev && npm ci --prefix client && npm run build --prefix client`
   - Start command: `node server/src/server.js`
3. Set the environment variables: `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
4. Health check path: `/api/health`.
5. After the first deploy, open a **Shell** on the service and run `npm run seed --prefix server` (add `:demo` for sample data).
6. Visit the URL and log in as the admin to create club accounts.

Render terminates TLS and adds one proxy hop, which is why `TRUST_PROXY` defaults to 1 in production. The app handles `SIGTERM` gracefully during redeploys.

## Option 2 — Any Docker host

```bash
docker build -t eventhub .
docker run -d -p 5000:5000 \
  -e NODE_ENV=production \
  -e MONGO_URI='mongodb+srv://…' \
  -e JWT_SECRET='…' \
  -e TRUST_PROXY=1 \
  --name eventhub eventhub
docker exec -e ADMIN_EMAIL=you@college.edu -e ADMIN_PASSWORD='…' eventhub npm run seed --prefix server
```

Put it behind a TLS-terminating proxy (Caddy, Nginx, Cloudflare). Session cookies are `Secure` in production, so plain HTTP only works on `localhost`.

## Option 3 — Docker Compose (self-contained, includes MongoDB)

```bash
export JWT_SECRET=$(openssl rand -base64 48)
export ADMIN_EMAIL=you@college.edu ADMIN_PASSWORD='a-strong-password'
docker compose up --build -d
docker compose exec app npm run seed --prefix server
```

The data lives in the `mongo-data` volume. Back it up with `docker compose exec mongo mongodump --archive > backup.archive`.

## Option 4 — Split origin (static front end on Vercel/Netlify, API elsewhere)

Supported, but not recommended (see [ADR-003](DECISIONS.md#adr-003--same-origin-deployment-express-serves-the-spa)):

- API: set `CLIENT_ORIGIN=https://your-frontend.vercel.app`. This enables a credentialed CORS allowlist, switches the cookie to `SameSite=None; Secure`, and requires the `X-Requested-With` header on writes (the bundled client always sends it).
- Front end: build with `VITE_API_URL=https://your-api.onrender.com npm run build --prefix client`, and add an SPA rewrite (all paths → `/index.html`).
- Caveat: browsers that block third-party cookies (Safari by default, Chrome with some settings) **won't keep users logged in**. Using a custom domain for both, e.g. `app.example.com` and `api.example.com` (same site), avoids this.

## Migrating the v1 database

If you are upgrading the original v1 deployment's database:

```bash
cd server
MONGO_URI='…' JWT_SECRET='…' node scripts/migrate-v1.js --dry-run   # see what will change
MONGO_URI='…' JWT_SECRET='…' node scripts/migrate-v1.js             # apply
```

Clubs keep their existing passwords and get placeholder emails (`<club-slug>@clubs.eventhub.local`). Update those from the admin console or the database. Posters found in `server/uploads/` are imported into GridFS. The old `clubs` collection is left for you to drop after checking the result. Only run this if you still control the v1 database; its old credential is compromised (see [SECURITY.md](SECURITY.md)).

## Production checklist

- [ ] Production MongoDB URI stored only in the host's secret settings (never the leaked v1 credential)
- [ ] `NODE_ENV=production`, strong unique `JWT_SECRET`
- [ ] HTTPS in front of the app
- [ ] Atlas network access restricted; automated backups enabled
- [ ] `/api/health` configured as the health check
- [ ] Admin created with `npm run seed`, and the admin password changed after first login
- [ ] `TRUST_PROXY` matches your proxy topology
- [ ] If running more than one instance: shared rate-limit store (Redis)
