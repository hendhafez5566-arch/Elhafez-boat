# Implemented source; final verification remains separate

Current batch continues d31c20e on the same branch/PR.

- Booking source/contracts/UI retired with documented test migration; security primitives/tests retained.
- Durable DELAY continuation, dynamic catalog list pagination and stable selections, global keyword/first-message triggers.
- Live website-chat source using the same bot engine, visitor sessions/dedupe/origin checks and real employee takeover/replies.
- Media upload/library/storage limits/public links/deletion protection.
- Supported approved template variables/media/interactive button parameters and callbacks.
- Consent-filtered campaign/sequence drafts, recipient jobs, launch/cancel, worker limits and retries.
- Unified inbox polling/notifications, explicit read receipts, editable saved replies, generic lead capture, company consumption/admin caps.
- Encrypted per-integration credentials and configuration, durable Meta dispatch claims and UNCERTAIN recovery.
- Rebuilt actual-data RTL workspace; removed seeded tourism UI and stale compiled-code risk; optimistic flow draft revisions.

Locally confirmed: clean dependency install, TypeScript/build, JS syntax, static DOM checks and HTTP asset serving. This list means source is implemented, not database/browser/live-provider/commercial acceptance passed. See CURRENT-STATUS.md and REMAINING.md for exact evidence and limitations.

Confirmed remote CI on 7fc3626: 28/28 unit tests, all 22 migrations and real PostgreSQL catalog-isolation/RLS gate passed. Evidence: https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39072771700. No full final acceptance claim.


## 2026-10-18 — advanced runtime continuation from da1c6a3
Implemented source: native Sheets/HubSpot/WooCommerce/Shopify connectors and owner UI, OAuth/refresh/encryption, contact-sync queues and CONNECTOR node; immutable pinned linked SUBFLOW compilation/field bindings/return and Canvas library editing; Messenger/Instagram/Telegram receive/send adapters with unified inbox, signed/secret webhooks, dedupe and uncertain-send quarantine; owner privacy/retention/export/anonymization; fail-closed ClamAV upload gating; PostgreSQL distributed limits, granular API-key routes, worker health/queue UI. Migration **0024** is required.

Build/TypeScript, changed JS syntax and static HTTP dashboard/assets passed locally. No live provider/scanner, browser/mobile, load/fault/restore or formal final acceptance was run. Development CI evidence is attached below.

**Not all seven areas are closed:** Meta Commerce product-card/catalog-template variants remain unsupported. Existing approved image/video carousel was preserved and gains a published generic-catalog image picker. External accounts, OAuth apps/permissions, Meta review, HTTPS and ClamAV still require configuration and activation evidence. Legacy un-attributed webhook payloads, historical data and backups need a separate erasure process. Read `docs/19-ADVANCED-RUNTIME.md` for exact behavior and constraints; no commercial readiness claim.


Latest source evidence: [a4be882](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/a4be882e220f51f1f907cb2d30cdc4b890994da7), correction [9a338d6](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/9a338d63641f5b445abad2aaf2fa4ad4bcc5d318). Development CI a4be882 run [39100381266](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100381266) SUCCESS: **55/55**, migrations **0001–0024**, real PostgreSQL RLS/privacy/rate checks. Full final acceptance and live provider/scanner activation remain unverified; Meta Commerce product-card/catalog-template source remains open. Latest-head evidence: VERIFICATION-ADVANCED-2026-10-18.md.

Latest source correction **9a338d6** also passed [push CI 39100475500](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100475500) and [PR CI 39100478270](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100478270): **55/55**, migration 0024 and PostgreSQL gate. Logs inspected directly. This is not the formal final acceptance campaign.
