# Remaining / acceptance gates

## Immediately blocking verified Stage 0 completion
- Clean npm install and deterministic package-lock.json; verify scripts on checked out repository.
- Execute migration 0001/0002 on isolated PostgreSQL and pass RLS/concurrency integration tests, fix any failures.
- Complete API and Arabic dashboard real database E2E acceptance with non-superuser runtime role.
- Write audit event records within mutating transactions; verify permission failures.
- Add reliable deployment/runbook; confirm backups and restore.

## Stage 1 after foundation verified
- Real program attributes: departures, travel dates, room types, hotels, capacity / fare variants, images and offer snapshots.
- Official Meta Cloud API onboarding/webhook signatures/idempotency and outbound queue; WhatsApp template/window rules.
- Tenant configurable versioned menus and official WhatsApp Flows, booking forms and support takeover.
- E2E with Meta test number then approved production number.

## Subsequent stages
Customer CRM, inbox, assignments, follow-ups and reports; grounded AI; owner superadmin and subscriptions; SaaS hardening and pilot.

See docs/01-MASTER-PLAN.md. Do not mark DONE for code that was only written without actual runtime verification.
