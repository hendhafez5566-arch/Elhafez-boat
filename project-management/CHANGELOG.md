# Changelog

2026-10-17 — Initial product docs/master plan and GitHub cross-chat handover.
2026-10-17 — Initial TS workspace, program/bot contracts, draft booking, local Arabic dashboard and database migrations through 0005.
2026-10-17 — Added official WhatsApp Cloud API inbound webhook, HMAC signature validation, encrypted credentials, idempotent stateful inbox, customer list/menu booking, human takeover, outbound queue worker, STOP/START and delivery updates.
2026-10-17 — Added invite/role flows, platform-owner login/tenant provisioning/manual subscriptions, draft Meta Flow booking contracts, FAQ publishing/exact answer, extended responsive Arabic admin UI, migration files 0006–0010 and setup docs.
2026-10-17 — Lightweight syntax/type checks ONLY. No real Postgres migrations, clean CI/build, Meta acceptance, full E2E or commercial release. Owner requests ONE formal comprehensive acceptance phase after feature development.

## 2026-10-17 — continuation: core commercial features (unaccepted)

- Added migrations 0011 for multiple departure dates and hotel room packages and 0012 for consent-bound Meta approved templates.
- Extended business booking methods with optional departure/room package, immutable rate snapshot, combined program/departure/room seat allocation and idempotent cancel/capacity release; added routes and Arabic staff forms.
- Created template registry that queries Meta for approved static templates, requires explicit evidence of customer consent, allows only individual outreach with rate limit, supports STOP revoke, and rechecks consent in durable send worker.
- Subscription write gates and worker subscription enforcement, stale template-job expiry, quarantine of queued traffic on suspension; bootstrap trial subscription.
- Added reference Docker stack, private-backup script and operations runbook; these assets were NOT built/deployed or restore-tested.
- Refreshed cross-chat status and handover. No formal acceptance run. Draft PR #1 unchanged/unmerged.


## 2026-10-17 — WhatsApp booking selection + inbox assignment

- Created tenant-scoped `booking-choice.ts` and migration 0013: date/room state columns, Flow-bound selection IDs.
- Added paginated native WhatsApp travel dates and hotel rooms before booking, database quote/capacity revalidation, immutable provisional fare snapshot, and Flow/text fallback parity.
- Employee booking creation now requires date/room when catalog contains them. Booking lists display selected itinerary, room and locked per-person fare.
- Added customer request-status menu based on verified Meta sender phone and company scope.
- Prevented simultaneous unrelated agents from taking over the same human-held conversation; restricted employee replies to assigned agent.
- Removed programs with solely expired/unavailable contracted departures from WhatsApp menus; clarified base prices as indicative.
- Wrote `docs/15-WHATSAPP-BOOKING-CHOICES.md`. Changes pushed to draft PR; no real PostgreSQL/Meta, provider E2E or formal acceptance performed.
