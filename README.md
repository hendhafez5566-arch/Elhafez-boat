# Elhafez Boat — Tourism Sales SaaS

Independent multi-company, Arabic-first tourism sales platform. Staff create and publish Umrah, Hajj and travel programs, review provisional booking requests and confirm capacity safely. Customer-facing integration will use **official WhatsApp** interactive lists/buttons and WhatsApp Flows, plus grounded AI as an opt-in fallback.

## Development status
Stage 0 foundation is **IN PROGRESS**, not ready for production. There is an early authenticated API, PostgreSQL schema and Arabic dashboard, but real PostgreSQL/UI integration and official WhatsApp setup remain UNVERIFIED/NOT DONE.

Read [AGENTS.md](AGENTS.md), [Master Plan](docs/01-MASTER-PLAN.md), [Current Status](project-management/CURRENT-STATUS.md), [Handover](project-management/HANDOVER.md) and [Setup](docs/11-LOCAL-SETUP.md).

## Developer commands (after npm install)
```sh
npm run check
npm run db:migrate
npm run db:bootstrap
npm run dev:api
npm run dev:web
```

See setup guide for isolated DB, least-privileged credentials and required environment variables. Never commit secrets or traveler data. Code changes remain in draft PR #1 until verified.

**Scope boundaries:** no copy of legacy accounting ERP; no unofficial WhatsApp automation; no fabricated prices or AI-confirmed bookings.
