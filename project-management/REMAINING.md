# Remaining before commercial delivery

User order (2026-10-17): implement all functions and visual surfaces first; comprehensive acceptance suite is the FINAL phase, not intermittent phases.

## Incomplete business functionality
- Departure-based programs: schedules, hotels, room allocation, pricing tiers, contracted/available seats, real booking rules and full change audit.
- Automated WhatsApp: official Meta connection and webhook verify/signature/idempotency; outbound jobs, delivery receipts, service window and opt-in/template policies, WhatsApp Flows.
- Conversation state and human agent routing; genuine customer chat and assignment. Current inbox is INTERNAL NOTES only.
- Offers and packages beyond simple linked promotional announcements; media library.
- Tenant invitation & password recovery; permission administration; reports/exports; intelligent grounded AI with permitted tools.
- Owner platform: agency onboarding, billing/subscriptions, quotas and support.
- Production readiness: backup, restore, alerting, migrations, DB grants, retained logs, performance/monitoring.

## Implemented partially, not final
- Base programs, provisional booking/confirmation, customers, offers, follow-ups, internal conversation notes, Arabic dashboard and local-only demo simulator.
- Team/settings pages currently explicit placeholders rather than real APIs.
- SQL migration coverage: code written through 0004 but **no real PostgreSQL migration execution verified**.

## Final acceptance phase (only after feature completion)
Execute all existing/new unit tests, PG integration + tenant isolation and booking concurrency, authenticated API E2E, browser UI, Meta test-number interaction/Flows, security/privacy, backup/restore, load testing. Fix findings and rerun until truly acceptable.