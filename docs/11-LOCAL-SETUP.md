# Local backend setup (implementation in progress)

This is an API foundation, not a production-ready service. Meta WhatsApp, Flows, tenant invitation and deployed dashboard are not yet connected.

1. Node.js 22+, npm, PostgreSQL 16+ and Redis; copy `.env.example` to `.env`; Node 22 loads `.env` in the npm commands. **Do not commit `.env`.**
2. `npm install` (generates lockfile; commit after validation). `npm run check` for typecheck, build and pure/unit tests.
3. `docker compose up -d postgres redis` for local services if Docker is available.
4. Create a non-owner, non-superuser, non-BYPASSRLS role for the **runtime** connection. A separate privileged migration connection applies schema. For example, as DB admin, create `elhafez_runtime` with a unique secret password, grant `CONNECT` and `USAGE ON SCHEMA public`, and after migrations grant specific `SELECT/INSERT/UPDATE/DELETE` on required tables plus appropriate sequences. Never give runtime role ownership or BYPASSRLS.
5. Set `MIGRATION_DATABASE_URL` using the migration role; run `npm run db:migrate`. Run `npm run build` then set one-time `BOOTSTRAP_*` environment variables (including a strong private password), and run `npm run db:bootstrap`.
6. Set `DATABASE_URL` with runtime-role credentials; run `npm run dev:api`. Request `GET /health`. Login via `POST /api/v1/auth/login` with `tenantSlug`, `email`, `password`. Use the short-lived bearer token only in memory, transmitted over HTTPS outside localhost.

### Available authenticated endpoints

- `GET /api/v1/programs`: list company programs.
- `POST /api/v1/programs`: create draft (OWNER/MANAGER); fields `title,category,currency,priceMinor,availableSeats`.
- `PATCH /api/v1/programs/:id/publish`: publish draft (OWNER/MANAGER).
- `GET /api/v1/bookings`: booking requests.
- `POST /api/v1/bookings`: provisional request (OWNER/MANAGER/AGENT); fields `programId,customerName,customerPhone,partySize`. This is staff-only; customer-facing webhook authentication is still TODO.
- `PATCH /api/v1/bookings/:id/confirm`: confirm capacity atomically (OWNER/MANAGER).
- `POST /api/v1/auth/logout`: revoke current bearer token.

### Important limitations

Database migrations have not yet been applied or tested against an actual PostgreSQL instance in the execution environment. Tests use SQL fake clients to check transaction boundaries and SQL intent, not full PostgreSQL behavior. Separate end-to-end DB RLS and concurrency tests are mandatory before production.

Rate limits in API process memory are only an initial safeguard; implement centralized limits before multi-instance rollout. Add TLS termination, structured audit, admin invitations, account recovery, email verification, monitoring and credential rotation before production.

### Current sales workspace additions (migrations 0003 and 0004)

Authenticated endpoints for staff:

- `GET/POST /api/v1/contacts`; `PATCH /api/v1/contacts/:id/status`; `GET/POST /api/v1/contacts/:id/notes`.
- `GET/POST /api/v1/offers`; `PATCH /api/v1/offers/:id/publish`.
- `GET/POST /api/v1/followups`; `PATCH /api/v1/followups/:id/complete`.
- `GET/POST /api/v1/conversations`; `GET/POST /api/v1/conversations/:id/messages` — **internal notes only**, not provider messaging.
- `GET /api/v1/summary` — tenant-scoped operational counters.

Program create accepts optional `summary`, `hotelName`, `durationDays` and ISO8601 `departureAt`, migrated as `summary`, `hotel_name`, `duration_days`, `departure_at`.

Browser-only design demo: press "استعراض التصميم ببيانات تجريبية" on the login screen. It is isolated in JavaScript memory, not connected to DB/API/WhatsApp, clearly marked and safe for preview. It is NOT a real data acceptance test.

Formal acceptance (PostgreSQL, browser, WhatsApp sandbox) is intentionally deferred to a single final phase by user direction. Maintain routine compile/syntax safeguards and honest status until then.