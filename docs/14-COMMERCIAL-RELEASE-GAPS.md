> **HISTORICAL / SUPERSEDED (2026-10-17)** — The owner rejected ERP/booking/finance expansion. The authoritative scope is [WhatsApp chatbot-only lead assistant](00-SCOPE-CHATBOT-ONLY.md). Any booking, payment, refund, traveler records or system-management requirements in this older document are **NOT product requirements and MUST NOT be built**. Human staff handles all reservations and follow-up outside the bot.

# Remaining commercial-release requirements

Elhafez Boat is an independent SaaS under development, **NOT production-ready or sellable yet**. The product owner expressly deferred formal **comprehensive acceptance until the end of functional development**. Lightweight syntax/type safety during development remains reasonable.

## Implemented as unverified source code on draft branch

- Company staff authentication, tenant-scoped program catalog, sales CRM/offers, provisional bookings, existing manual confirmation, workflow menus and Arabic dashboard.
- Agency bot configuration and immutable published versions; company-reviewed FAQ database and exact-match answers only.
- WhatsApp official Cloud API adapter, signed webhooks, persisted inbox/state, human takeover and outbox worker; optional Meta Flow support with secure one-time form tokens.
- Employee invitations (manually shared one-time links), invite acceptance, role changes with session invalidation.
- Platform owner login, tenant provisioning, plan selection and manual subscription status changes. No payment collection.
- UI for tenant operation, inbox, connection, members, FAQ, subscription overview and separate owner console.

## Features and acceptance NOT YET FINISHED

1. **Provider:** Meta Cloud API account/number approval, real account connection, published Flow validation/acceptance, template management, campaign compliance, event reconciliation, real E2E provider tests.
2. **Tourism catalog:** multi-departure programs, hotels/rooms and tiered occupancy rates, photos/private media storage, multilingual descriptions, better cancellations/partial refunds and traveler documents.
3. **Inbox:** production notifications, agent presence and collision prevention for simultaneous staff replies, SLA rules, refined assignment and escalation, advanced search/filters.
4. **AI:** genuine optional LLM integration with vetted tenant knowledge and measurable hallucination guardrails. Current FAQ is deterministic published-answer matching, NOT LLM AI.
5. **Subscriptions:** actual metered usage, enforced plan quotas across all features, payments, invoices/tax, billing lifecycle, platform operations support. Current plans have placeholder prices and manual statuses only.
6. **Security and operations:** hardened service-role grants, tenant role isolation, session rotation, audit coverage, content retention/deletion/export workflows, secret rotation, GDPR/Egyptian data privacy assessment, backup/restore, observability and incident handling.
7. **Deployment:** reproducible clean install/lockfile, staging environment, domain + TLS, database migrations and rollback/backup plan, production CI/CD and runtime health alerts.
8. **Final one-time acceptance:** PostgreSQL migration + tenant RLS, HTTP API and browser E2E (desktop/mobile), Meta sandbox/live number, multiuser concurrency, refund/capacity integrity, failover/restore, performance/load, security and accessibility. Run together after feature scope is completed as user instructed. Do not certify from screenshots or pure TypeScript.

## External inputs deferred (not to invent)

Official Meta credentials, domain/host, payment provider details, approved pricing/subscription policies, tourism business rules for refunds/room tiers and production privacy policy. Never commit secrets to the public repository, per owner choice.

## Updated on 2026-10-17 after inventory/templates/ops batch

Parts of item (1), (2), (5) and (7) above now have additional **UNVERIFIED SOURCE CODE**:
- Item (1): Meta-approved static template registration, one-at-a-time send queue, explicit customer consent and STOP, plus optional published booking Flow scaffold. Marketing campaigns and actual Meta provider acceptance remain.
- Item (2): `program_departures` and `program_room_packages` tables and staff UI for dates/hotels/room occupancy and per-person rates. Booking create/confirmation/cancellation allocate/deallocate capacity. **Customer WhatsApp date/room choice and full travel pricing/refund policy still missing.**
- Item (5): subscription status/read-only gate and some plan quotas. Automatic billing and complete metering not built.
- Item (7): untested reference `Dockerfile`, `deploy/compose.platform.yaml`, `deploy/scripts/backup-postgres.sh`, runbook; no actual deployment, encrypted backup or restore drill.

The full list of STILL missing deliverables and final acceptance is in `project-management/REMAINING.md`. These code additions have not been tested against live PostgreSQL/Meta and should NOT be portrayed as production-ready.
