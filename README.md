# Gordaya Beauty

A small, self-hosted booking application for a one-person nail and lash salon.
Visitors can browse services and prices, pick an available time window, and
leave contact details. The owner signs in to a single admin area to create or
block time windows in bulk, edit services and prices, review bookings, and set
how close to the start time bookings close.

The interface is Ukrainian/Russian, and all business logic uses the
`Europe/Kyiv` timezone regardless of where the server runs.

This repository is a sanitized public copy. It contains no production
database, `.env` file, client records, or real contact details. The footer and
demo seed use clearly fictional data (`@gordaya_demo`).

## Stack

- **Next.js 16.3.5** — App Router, React 19, TypeScript
- **Tailwind CSS 4** — styling, no component library
- **`node:sqlite`** — built-in SQLite driver, no native dependencies
- **iron-session** — encrypted admin session cookie
- **zod** — request validation
- **date-fns / date-fns-tz** — calendar and timezone handling
- **SQLite** — a single local database file

There is no external database, queue, analytics, or third-party runtime
service. Everything runs in one Node.js process.

## Architecture

```
Browser
  │
  ├── /, /booking/[service]        public pages (server components + client UI)
  ├── /api/slots, /api/bookings    public JSON endpoints
  └── /admin, /api/admin/*         session-protected admin pages/endpoints
        │
        └── Next.js (Node runtime)
              │
              ├── src/lib/prisma.ts      Prisma-like data layer over node:sqlite
              ├── prisma/migrations/     raw SQL schema migrations
              └── prisma/dev.db          local SQLite file (not committed)
```

The public pages are dynamic and read availability from SQLite on each
request. The admin session is stored in a signed/encrypted cookie; no session
table is needed. The database file is the only persistent state.

### Why Prisma was replaced

The original deployment target was an Android phone running Termux. Prisma's
query engine is a native binary built against glibc, and it does not load on
Android's Bionic libc. Rather than shipping a second database server, the data
access layer was replaced with `src/lib/prisma.ts`, a small typed wrapper
around Node's built-in `node:sqlite`.

The wrapper intentionally mirrors the subset of the Prisma Client API used by
this app (`findMany`, `findUnique`, `create`, `createMany`, `update`, `delete`,
`upsert`, `include`, `select`, `$transaction`). It stores `DateTime` values as
Unix milliseconds and booleans as `0`/`1`, matching the SQL schema.

This is not a full Prisma implementation. Column and relation names are
validated against explicit allow-lists before they reach SQL, and unsupported
Prisma features are intentionally absent. `prisma/schema.prisma` is kept as a
readable description of the schema, but **Prisma Client is not installed or
used at runtime**, and `prisma migrate` / `prisma db seed` are not part of the
workflow.

## Requirements

- Node.js **24 or newer** (for the built-in `node:sqlite` module)
- npm (the repository includes `package-lock.json`)

## Setup

```bash
npm ci
cp .env.example .env
# edit .env — at minimum set ADMIN_PASSWORD and SESSION_SECRET
npm run db:init        # apply prisma/migrations/*/migration.sql
npm run db:seed        # optional: insert the fictional demo catalogue
npm run dev            # http://localhost:3000
```

Open `/admin` to sign in with `ADMIN_PASSWORD`.

`npm run db:seed` is a demo helper. It inserts two services and a few sample
price lines; it does not copy production prices or any client data. Skip it if
you want to create the catalogue yourself in the admin area.

Next.js loads `.env` automatically for `dev`, `build`, and `start`. The helper
scripts (`db:init`, `db:seed`, tests) read `DATABASE_URL` from the process
environment and fall back to `file:./prisma/dev.db`, so the example path works
without extra setup. If you change the database path in `.env`, export it for
the CLI scripts too:

```bash
DATABASE_URL="file:/absolute/path/app.db" npm run db:init
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes (has a default) | SQLite URL, e.g. `file:./prisma/dev.db`. Relative paths resolve from the process working directory. |
| `ADMIN_PASSWORD` | Yes | Password for the single shared admin login. The login endpoint returns an error if it is unset. |
| `SESSION_SECRET` | Yes | Random string of at least 32 characters used by iron-session. The app throws at startup if it is missing or shorter than 32 characters. |
| `SESSION_COOKIE_SECURE` | Yes (set explicitly) | `"true"` only when served over HTTPS; `"false"` for local HTTP. A `Secure` cookie on plain HTTP makes login silently fail. |

The booking cutoff is **not** an environment variable. It is stored in the
`AppSetting` table (`bookingCutoffMinutes`), defaults to 120 minutes, and is
editable in **Admin → Settings**. The business timezone is fixed to
`Europe/Kyiv` in `src/lib/timezone.ts`.

Generate a session secret with:

```bash
openssl rand -base64 32
```

## Database, schema, and migrations

The database has five tables:

| Table | Purpose |
|---|---|
| `Service` | A bookable service (manicure, lashes) and its public description. |
| `PriceItem` | Itemized price lines belonging to a service, including optional surcharges. |
| `Slot` | A window of the owner's time. Status is `AVAILABLE`, `BOOKED`, or `BLOCKED`. Slots are shared across all services because one person performs every procedure. |
| `Booking` | A client reservation for one slot and one service, with contact details and `CONFIRMED` / `CANCELLED` status. |
| `AppSetting` | Key/value application settings, currently the booking cutoff in minutes. |

Migrations live in `prisma/migrations/<timestamp>_<name>/migration.sql`:

1. `20260916094211_shared_calendar` — core tables and indexes
2. `20260916095019_price_items` — service notes and itemized price lines

`npm run db:init` applies every migration in lexical order inside a
transaction and records it in `_gordaya_migrations`, so reruns are safe.
`AppSetting` is created both by the initializer and lazily by the data layer
(`ensureSchema`), so older databases remain usable. The data layer does not
run migrations itself.

`prisma/schema.prisma` documents the same schema for readers and tooling; it
is not used to generate a runtime client.

## Demo mode

The public repository ships without a database. `npm run db:seed` creates a
fictional catalogue with generic prices and notes. The only public contact
detail in the UI is the demo Instagram handle `@gordaya_demo` in
`src/components/SiteFooter.tsx`; replace it in a private fork.

Do not run the demo seed against a real database unless you intend to add demo
services to it. Use the admin UI for production data.

## Tests

The tests are self-contained and runnable in CI. Each suite creates a fresh
temporary directory, applies both migration SQL files, inserts minimal
fixtures, and deletes the directory afterwards. No `.env`, real database, or
network access is required.

```bash
npm test          # both suites
npm run test:db   # data layer: CRUD, ordering, includes, transactions, SQL guards
npm run test:cutoff # booking cutoff visibility and threshold calculations
```

The data-layer tests exercise the properties the UI relies on: booleans and
dates are converted correctly, `include` works through relations, transactions
roll back on error, and unknown column names are rejected.

## Lint, typecheck, and build

```bash
npm run lint
npm run build
npm start
```

`next build` imports the session module, so `SESSION_SECRET` must be set (at
least 32 characters) even for a local production build. If your build touches
the database, run `npm run db:init` first and point `DATABASE_URL` at a
throwaway file. CI does this with dummy secrets and a database under the
runner's temporary directory; no real secrets are required.

## Production deployment

This app is designed for a persistent single-node host. Do not run multiple
app instances against the same SQLite file, and do not deploy it to a
serverless platform with an ephemeral filesystem — the database would not
survive between requests.

### Termux + runit

A minimal Android/Termux deployment looks like this:

```bash
pkg install nodejs-lts git nginx
git clone <your-private-repo> ~/gordaya
cd ~/gordaya
npm ci
cp .env.example .env
# edit .env: production ADMIN_PASSWORD, SESSION_SECRET, SESSION_COOKIE_SECURE=true,
# and DATABASE_URL pointing at a persistent path
npm run db:init
npm run build
```

Keep the process alive with a runit service, for example
`$PREFIX/var/service/gordaya/run`:

```sh
#!/data/data/com.termux/files/usr/bin/sh
export PREFIX=/data/data/com.termux/files/usr
export PATH="$PREFIX/bin:$PATH"
cd /data/data/com.termux/files/home/gordaya
exec 2>&1
exec npm run start -- -H 127.0.0.1 -p 3000
```

Enable it with `sv up gordaya`. On Android, also acquire a Termux wake lock and
disable battery optimization for Termux; otherwise the OS may suspend the
process. Test battery and thermal behavior before relying on a phone as a
server.

### nginx reverse proxy

Bind Next.js to loopback and let nginx terminate TLS:

```nginx
server {
    listen 80;
    server_name salon.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Obtain a certificate with your preferred ACME client, or terminate TLS at the
tunnel (next section). Set `SESSION_COOKIE_SECURE="true"` once the public URL
is HTTPS.

### cloudflared tunnel

As an alternative to exposing nginx directly, run a named Cloudflare Tunnel:

```yaml
tunnel: gordaya
credentials-file: /path/to/<tunnel-id>.json

ingress:
  - hostname: salon.example.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Run `cloudflared tunnel run gordaya` under the same supervisor as the app.
Because Cloudflare terminates HTTPS, keep `SESSION_COOKIE_SECURE="true"` and
make sure the proxy forwards `X-Forwarded-Proto: https` (the nginx block above
sets it; Cloudflare sends it automatically).

### Backups

SQLite keeps data in the database file plus `-wal`/`-shm` sidecars. Back up
with SQLite's online backup command when available:

```bash
sqlite3 /path/to/app.db ".backup '/path/to/backups/app-$(date +%F).db'"
```

Or stop the service and copy all database files together. Store backups
outside the repository and treat them as sensitive: they contain client names,
phone numbers, and optional social handles. Never commit them.

## Security and privacy notes

- The repository intentionally excludes `.env`, `*.db*`, logs, screenshots,
  and any session files. `.gitignore` covers these; verify with `git status`
  before publishing a fork.
- All real client data lives in `Booking` (name, phone, optional
  Telegram/Instagram, comment). The public demo uses fictional contact data.
- The admin area uses one shared password and an encrypted, `HttpOnly`
  iron-session cookie with a seven-day lifetime. There are no per-user
  accounts or audit log.
- Admin API routes check the session; inputs are validated with zod; the
  SQLite wrapper validates column and relation names against allow-lists.
- The app does not currently implement rate limiting on login or booking
  endpoints. If exposed to the public internet, add throttling at the reverse
  proxy or in the app.
- Serve over HTTPS in production and set `SESSION_COOKIE_SECURE="true"`.
  Rotate `ADMIN_PASSWORD` and `SESSION_SECRET` if either is exposed; changing
  `SESSION_SECRET` invalidates existing admin sessions.
- The app makes no outbound calls to messaging providers. Telegram/Instagram
  fields are stored for the owner to follow up manually; no reminder service
  is included.
- The dependency versions are pinned to the stack used by the original
  application. At the time of publication, `npm audit` reports advisories
  against Next.js 16.3.5 and zod 4.6.5; review and update dependencies (and
  rerun the tests/build) before exposing a deployment to the public internet.

## Project structure

```
src/
  app/                     Next.js App Router pages and API routes
    admin/                 login and dashboard
    api/                   public and session-protected endpoints
    booking/[service]/     booking page per service
  components/              public and admin UI
  lib/
    prisma.ts              node:sqlite data layer (Prisma-shaped subset)
    settings.ts            AppSetting helpers + booking cutoff
    session.ts             iron-session configuration and auth guard
    timezone.ts            Europe/Kyiv conversion and calendar helpers
    validators.ts          zod schemas
    i18n/                  UA/RU dictionaries and locale context
prisma/
  schema.prisma            documentation schema (no runtime client)
  migrations/              raw SQL migrations
scripts/
  db-utils.ts              migration runner
  init-db.ts               npm run db:init
  seed-demo.ts             npm run db:seed
  test-helpers.ts          temp DB + fixtures for tests
  test-db.ts               data-layer tests
  test-cutoff.ts           booking-cutoff tests
.github/workflows/ci.yml   Node 24 CI: npm ci, test, lint, build
public/                    static assets
```

## CI

`.github/workflows/ci.yml` runs on Node.js 24 with npm caching and concurrency
cancellation:

1. `npm ci`
2. `npm test`
3. `npm run lint`
4. `npm run build` with dummy `SESSION_SECRET` / `SESSION_COOKIE_SECURE`,
   `ADMIN_PASSWORD`, and a throwaway `DATABASE_URL` under `$RUNNER_TEMP`,
   initialized from the migrations

No repository secrets are required.

## License

There is no `LICENSE` file in this repository yet. Until one is added, the
code is not licensed for redistribution or reuse; decide and add a license
before publishing a fork. This repository intentionally does not include one.
