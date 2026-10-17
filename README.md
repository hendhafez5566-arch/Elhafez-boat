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