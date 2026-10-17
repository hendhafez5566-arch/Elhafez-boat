# Master implementation plan

Status values: NOT STARTED, IN PROGRESS, BLOCKED, VERIFIED DONE. Numerous stages now have feature-source implementations on draft branch, but **NO STAGE HAS VERIFIED DONE STATUS** because formal acceptance is deliberately reserved for final cycle. See CURRENT-STATUS and REMAINING for accurate completion and limitations.

## Stage 0 — Specification and foundation
- [ ] Confirm data model, role matrix, exact booking rules, customer UX and visual design.
- [ ] Establish TypeScript monorepo, package manager lockfile, lint/format/typecheck, CI, test runner, env templates, local Docker setup, migrations, seed fixtures.
- [ ] Define API contracts, WhatsApp adapter interfaces, action IDs and workflow schemas.
- [ ] Add security baseline and tenant-scoped authorization tests.
**Gate:** clean install, CI passing, migrations and tenant isolation tested.

## Stage 1 — Vertical slice
- [ ] Tenant and user auth/roles.
- [ ] Programs CRUD, images, price tiers, dates, availability and publish/unpublish.
- [ ] Versioned menu engine, interactive list/reply-button renderer and simulator.
- [ ] WhatsApp webhook verify/receive/send adapter with idempotency, signature checks and queue.
- [ ] WhatsApp Flow form mapping, submission validation and draft booking creation.
- [ ] Booking inbox with human review/confirmation and immutable price/terms snapshot.
**Gate:** add published Umrah program -> list shown -> customer selects -> sees details -> submits Flow -> provisional booking appears for staff. Verify first in simulator, then live API after credentials/eligibility.

## Stage 2 — Sales operations
- [ ] Unified inbox, assignment, takeover/handoff, internal notes, customer CRM, statuses, follow-up tasks, reporting.
- [ ] Offers/campaigns, opt-in and opt-out, template management and 24h service-window policy.
**Gate:** multi-agent handoff, no duplicate sends, compliant follow-up and audit trail tested.

## Stage 3 — Grounded AI
- [ ] Knowledge base, safe retrieval, tools for program search, availability and lead qualification.
- [ ] Guardrails for prices, booking/payment actions and escalation; AI evaluation set in Arabic.
**Gate:** no fabricated business facts in adversarial and regression tests.

## Stage 4 — Multi-tenant commercial release
- [ ] Self-service company onboarding and WhatsApp connection where supported, subscription/billing, quotas and usage visibility.
- [ ] Monitoring, backups + restore drill, retention/deletion, load tests, rate limits, runbooks, disaster recovery.
- [ ] Pilot with real companies; fix verified defects before sale.
**Gate:** independent tenant security, E2E WhatsApp acceptance, recovery, performance and operational signoff.

## Out of scope initially
Automatic payment confirmation without verified payment provider; guaranteed availability without inventory check; ERP coupling; unapproved bulk messaging; arbitrary unvalidated customer-authored executable flows.

Each gate needs evidence (commands, test results, screenshots where applicable) and explicit owner approval. No invented completion percentages.


## Current source progress (not formal stage completion), 2026-10-17

- Foundations: typed service modules, multiple migrations, tenant authorization and Arabic dashboard written; clean install, actual DB, lockfile and CI gate remain unverified.
- WhatsApp booking vertical: signed webhook, multi-tenant conversation routing, interactive native lists, program views, opt-in-aware templates, optional Meta Flow and queue worker in source. Real Meta approval, number hookup and provider E2E remain.
- Sales operations: programs, catalog travel dates and hotel rooms, manual reservations with atomic capacity/cancellation, customers, offers, followups, human inbox, team invites and approved knowledge FAQ largely have code, but missing rich traveler/financial policies and formal acceptance.
- Commercial multi-tenancy: platform owner and manual subscriptions, some plan enforcement, sample Docker and backups. Payment provider, invoices, automated quotas and production hardening missing.
- Genuine grounded AI with LLM is NOT implemented; approved FAQ exact-match fallback does not equal LLM AI.
- Owner explicitly wants **one final comprehensive acceptance phase after remaining feature work**, not continuous formal acceptance per stage. Routine syntax/type safeguards still allowed.
