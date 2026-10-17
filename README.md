# Elhafez Boat — Tourism Sales SaaS

A standalone, multi-tenant, Arabic-first tourism sales platform. Tourism companies manage programs and booking requests; the customer journey will run on the official WhatsApp Business Platform (interactive lists, buttons and Flows), backed by deterministic business rules and optional grounded AI.

**Status:** building. This is not a live commercial WhatsApp chatbot or approved production service.

## Show the implemented design without a database

Start the web preview locally with Node 22+:

```sh
node apps/web/server.mjs
```

Open `http://localhost:3000` and click **استعراض التصميم ببيانات تجريبية**. This is a browser-only, clearly labeled sample workspace; programs, customers, offers, bookings and simulator actions disappear when the tab reloads. No WhatsApp/API calls occur.

## Working against a real company database (development only)

Read [docs/11-LOCAL-SETUP.md](docs/11-LOCAL-SETUP.md), set up PostgreSQL and separate privileged migration and non-owner runtime roles, install dependencies, run migrations and bootstrap first tenant, start API then web.

Project references: [AGENTS.md](AGENTS.md), [Master plan](docs/01-MASTER-PLAN.md), [UI implementation](docs/12-UI-IMPLEMENTATION.md), [Current status](project-management/CURRENT-STATUS.md), [Handover](project-management/HANDOVER.md).

**User-approved process:** continue building all agreed functionality, then run one final comprehensive acceptance campaign. Lightweight syntax/type checks while developing are allowed but are not an acceptance certificate. Do not expose secrets or customer data in this public repo; do not merge drafts prematurely.

## Current feature build (draft, not accepted for production)

- Arabic RTL travel agency dashboard for programs, bookings, offers, contacts, follow-ups, internal notes, published bot menus and approved FAQ.
- Tenant-scoped WhatsApp Cloud API backend: signature-verified webhook, phone routing, encrypted access tokens, interactive catalogs, provisional booking, human takeover, sender queue and optional Meta-published booking Flow.
- Staff invitations and role management; separate platform owner console for new tenant setup and manual subscription statuses.
- Database migrations 0001–0010. No Meta credentials, production deployment or full PostgreSQL/provider acceptance verified.

Agency UI: `/`; platform owner UI: `/platform.html` (requires independently bootstrapped owner); one-time team/owner link: `/join.html#...`.

Local setup/runbook: [13 WhatsApp Operations](docs/13-WHATSAPP-OPERATIONS.md). [Commercial release gaps](docs/14-COMMERCIAL-RELEASE-GAPS.md). [Latest handover](project-management/HANDOVER.md).

## Development commands

```sh
npm install
npm run build
npm run db:migrate
npm run db:bootstrap
npm run db:platform:bootstrap
npm run dev:api
npm run dev:worker
npm run dev:web
```

Provide all environment variables in an untracked secret store and review `.env.example`. Separate privileged migration/platform roles from non-owner runtime roles; **never run with production credentials during local work**.

**Acceptance strategy:** user requested one complete formal acceptance round after the entire feature scope is built. Existing tests remain committed but full DB/browser/Meta/provider tests have not been executed for this build. No merge or commercial deployment should happen before their proof.


## Development branch overview — October 17, 2026 (not release-tested)

Source on `feat/stage0-foundation` now includes:
- Agency admin dashboard: tourism programs, departures, hotel/room packages, provisional/confirmed/cancelled bookings, offers, CRM and followups; Arabic RTL design and local browser-only demo.
- Official WhatsApp Cloud API adapter and sender worker (signed webhook, encrypted connection, inbound/outbound conversation, native menus/buttons, optional published Meta Flow, staff handoff).
- Approved knowledge/FAQ and separately consent-controlled, Meta-approved static template registration and single-recipient sending.
- Team invitation acceptance and role administration; separate platform owner tenant console and manually managed subscription plans.
- PostgreSQL migrations through **0012** (unapplied here), API/service implementation, reference Docker and backup ops runbook.

**Not implemented/live**: real Meta number/Flow onboarding and sandbox acceptance, genuine generative AI model integration, automatic subscription billing/invoices, complete traveler/financial workflow, production deployment and monitoring; final real DB/browser/provider/security/load/restore acceptance. Refer to [current status](project-management/CURRENT-STATUS.md), [remaining](project-management/REMAINING.md), [handover](project-management/HANDOVER.md).

Dev/reference operations: [deploy/README.md](deploy/README.md). WhatsApp instructions: [docs/13-WHATSAPP-OPERATIONS.md](docs/13-WHATSAPP-OPERATIONS.md).

The repository remains PUBLIC by owner request; do not commit tokens, payment secrets or actual personal data.
