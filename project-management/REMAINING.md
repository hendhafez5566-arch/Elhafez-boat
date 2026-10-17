# Remaining after 2026-10-17 large build

## Feature development remaining (code not yet delivered or incomplete)
- Genuine optional grounded LLM integration with approved tenant catalog/FAQ tools and robust escalation/evaluation; current deterministic FAQ is NOT AI.
- Native WhatsApp customer Flow/departure/room-tier choices and richer traveler data; published Meta Flow JSON/version/status integration. Current inbound booking usually uses base-program price, not specific room.
- Full room inventory business policy (occupancy edge cases, contracted supplier allotments, shared/partial allocations), financial/payment/refunds and cancellation rules; private media/documents.
- Agent inbox assignment locks/presence, search, alerting, message receipts reconciliation, service template with parameter support; opted-in campaigns/scheduled followups with approved message templates.
- Commercial subscriptions: automated payment/invoice/taxes/metering, plan enforcement for all quotas, owner support. Prices and billing currently placeholders, subscriptions manually operated.
- Reliability/security: secure DB roles/grants, request throttling in shared store, proper session lifecycle, customer data export/deletion and privacy policy, backups ENCRYPTED offsite, restore runbooks, monitoring/alerts and CI reproducibility.
- Deployment: clean lockfile, actual Docker build, dedicated domain/TLS, public webhook config, Meta WABA/number approval, verified API tokens and version-specific Flow validation.

## Already coded but NOT verified in real environment
- Program departures and hotel room packages with per-tier price, optional selection in staff booking UI, confirmation with program/departure/room allocation and cancellation release.
- Meta webhook, inbox, sender worker, published Flow handling, reviewed FAQs and consent-controlled static approved template sends.
- Platform owner tenancy, manual subscription controls, employee invitation/roles and Arabic dashboard.
- Docker/Compose reference and backup script.

## Final acceptance plan (once, after remaining feature work)
1. Fresh checkout and pinned dependencies; real PostgreSQL migration 0001–0012 and non-owner RLS tests.
2. Full HTTP API, backend services, responsive browser/mobile UI, tenant role/cross-company isolation, concurrency and booking capacity/accounting invariants.
3. Official Meta test number, actual signed webhook/menu/Flow/template and status reconciliation, 24h rules/consent/opt-out and throttling.
4. Billing provider and subscription E2E once selected, real monitoring, encrypted backup/restore, performance and failure injection.
5. Resolve defects; only then review/merge draft PR #1 and prepare commercial pilot.

Owner explicitly requests final comprehensive acceptance ONLY after complete feature build. Routine syntax/type checks allowed. Current app is NOT sellable/deployed.


## 2026-10-17 update

**Moved from unimplemented to written but NOT acceptance-verified:** WhatsApp customer date/room selection before Flow or text booking; server-side per-person price/currency snapshots, departure/room capacity checks, employee booking parity, recent booking status lookup using verified sender number, agent assignment lock and per-assignee reply permissions. Migration 0013 is new and UNAPPLIED. See `docs/15-WHATSAPP-BOOKING-CHOICES.md`.

**Still missing before complete feature scope:** traveler document/passport fields and privacy/storage controls; advanced financial deposits/refunds, optional published Flow dynamic selectors, agency inbox notifications/search and escalation; actual grounded AI vs reviewed FAQ, subscription payments/invoicing/metering; official Meta enrollment and approved Flow provisioning; production safety/backups/alerts and clean install/lockfile. No final acceptance yet as requested.
