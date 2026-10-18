## 2026-10-18 — isolated technical execution

WhatsApp ambiguous-send regression fix; API/worker idle DB recovery; two-replica fault and throttle checks; engine microbenchmark; all-page Chrome viewport traversal; local provider fixtures; isolated Compose; backup fingerprints; read-only alarms; owner activation and maintenance guides. Evidence and untested scope in CURRENT-STATUS.md. No activation/merge/deploy.

# Changelog — latest first

## 2026-10-18 — Core runtime and real workspace continuation from d31c20e
- Retired booking services/contracts/UI and their obsolete tests; preserved auth/RBAC/tenant transaction tests and replaced coverage with generic chatbot cases. No CI exclusions/skip/continue-on-error added.
- Added durable delay, paginated catalog list snapshots, configurable global triggers and Website Chat with actual inbox handoff/replies.
- Added managed media, validated interactive template parameters and consent-filtered campaigns/sequences with worker jobs, limits and cancellation.
- Added company usage/admin caps, live inbox/notification polling, per-message reads, editable replies, encrypted integration credentials, optimistic draft saves and durable Meta PROCESSING/UNCERTAIN recovery.
- Rebuilt RTL app with real APIs; removed dummy tourism workspace and retired package; preserved historical SQL/data. Added migration 0022 and clean-build step.
- Build/install/JS/DOM/HTTP safeguards passed. CI on 7fc3626 passed 28/28 unit tests, all 22 migrations and PostgreSQL catalog-isolation/RLS gate (run 39072771700). Final acceptance remains deferred.
- Follow-up also gives first-message triggers priority over exact FAQs on WhatsApp and aligns the channel scope docs with implemented website source.
- Startup follow-up now runs compiled API/worker JS after one root build and loads root .env for web; removed unused placeholder worker.


## 2026-10-18 — Generic chatbot implementation batch
- Repaired missing catalog service and 0016 migration; removed invalid legacy inventory source.
- Added canvas editing/layout persistence, undo/redo/duplicate, validation and version rollback.
- Added executable question, keyword branch, dynamic catalog, grounded AI and outbound webhook nodes plus shared server preview.
- Added AI source/usage settings, team inbox improvements, safe queued integrations, scheduled individual templates and scoped read API keys (migrations 0017–0021).
- Retired active tourism endpoints; stopped dashboard dependency on old tourism data. Historical migrations preserved.
- Added lockfile, reproducible Docker install and meaningful regression/PostgreSQL RLS test entrypoints.
- Local compile/syntax/static HTTP checks passed. No local DB/browser/live provider/final acceptance or commercial deployment. Scope remains incomplete; see REMAINING.md.
- GitHub CI on source commit: 34/38 passing; nine new regressions passed, four unchanged legacy service failures; migration/RLS skipped (run 39070131242).
- Source commit: e38fbdb0f7b20769b8746a441eb839b8ca333506.


## 2026-10-17 — Owner pivot: ALL-BUSINESS chatbot builder platform
- Latest decision supersedes tourism-only chatbot scope. Product is a generic multi-tenant chatbot SaaS inspired by BotSailor's configurable tools; never a booking/accounting ERP.
- Added generic flow engine with TEXT / BUTTONS / LIST / INPUT / CONDITION / TAG / MEDIA / LINK / HANDOFF / END nodes, validation, customer state, versioned draft/publish and human lead handoff.
- Added SQL migration 0015 for tenant-specific workflow drafts, versions, sessions, custom lead fields. WhatsApp signed webhook adapter now uses published generic flow before old travel-specific logic (legacy code to retire).
- Built reusable Arabic visual block editor and browser-only preview plus starting templates for general, shops, clinics, restaurants, real estate, education and tourism.
- Added migration 0016 and generic product/service/offer catalog API and UI, company-configurable categories and optional approved info. Staff inbox can inspect custom data collected by chatbot flows.
- Updated AGENTS, README, master plan and project management handover/remaining. Source written/pushed on draft PR; real PostgreSQL/Meta/browser acceptance NOT executed.

Earlier extensive tourism booking and ERP changes in git history are obsolete, not future requirements.


## 2026-10-18 — Reusable flow sections, visual groups, Meta-approved carousels
- Added reusable linear-section library with tenant RLS migration 0023, RBAC and audit; safe copy-to-flow insert/clone in actual canvas editor.
- Added Shift multi-selection and named visual groups; immutable published versions preserve group labels without changing execution.
- Added official approved CAROUSEL component compiler for marketing image/video card templates and card-by-card UI values; unsupported templates remain blocked.
- Added 15 tests and cross-tenant PostgreSQL RLS coverage. CI SUCCESS on 13a3da3: 43 tests pass, migration 0023 and RLS gate pass. No live Meta/browser/commercial acceptance.
- Detailed limitations and operation: docs/18-FLOW-REUSE-AND-CAROUSEL.md.


## 2026-10-18 — advanced runtime continuation from da1c6a3
Implemented source: native Sheets/HubSpot/WooCommerce/Shopify connectors and owner UI, OAuth/refresh/encryption, contact-sync queues and CONNECTOR node; immutable pinned linked SUBFLOW compilation/field bindings/return and Canvas library editing; Messenger/Instagram/Telegram receive/send adapters with unified inbox, signed/secret webhooks, dedupe and uncertain-send quarantine; owner privacy/retention/export/anonymization; fail-closed ClamAV upload gating; PostgreSQL distributed limits, granular API-key routes, worker health/queue UI. Migration **0024** is required.

Build/TypeScript, changed JS syntax and static HTTP dashboard/assets passed locally. No live provider/scanner, browser/mobile, load/fault/restore or formal final acceptance was run. Development CI evidence is attached below.

**Not all seven areas are closed:** Meta Commerce product-card/catalog-template variants remain unsupported. Existing approved image/video carousel was preserved and gains a published generic-catalog image picker. External accounts, OAuth apps/permissions, Meta review, HTTPS and ClamAV still require configuration and activation evidence. Legacy un-attributed webhook payloads, historical data and backups need a separate erasure process. Read `docs/19-ADVANCED-RUNTIME.md` for exact behavior and constraints; no commercial readiness claim.


Latest source evidence: [a4be882](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/a4be882e220f51f1f907cb2d30cdc4b890994da7), correction [9a338d6](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/9a338d63641f5b445abad2aaf2fa4ad4bcc5d318). Development CI a4be882 run [39100381266](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100381266) SUCCESS: **55/55**, migrations **0001–0024**, real PostgreSQL RLS/privacy/rate checks. Full final acceptance and live provider/scanner activation remain unverified; Meta Commerce product-card/catalog-template source remains open. Latest-head evidence: VERIFICATION-ADVANCED-2026-10-18.md.

Latest source correction **9a338d6** also passed [push CI 39100475500](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100475500) and [PR CI 39100478270](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100478270): **55/55**, migration 0024 and PostgreSQL gate. Logs inspected directly. This is not the formal final acceptance campaign.


## 2026-10-18 — Meta Commerce continuation from 5c03106
Implemented source: tenant/account-bound generic-to-Meta catalog mapping, official CATALOG/SPM/MPM/PRODUCT Carousel components, exact named/numbered template variables, real mapping/product/section/card UI for individual sends and campaigns, queue snapshot and pre-dispatch revalidation, inbound cart/referred-product interest-to-staff handoff. Migration **0025** adds FORCE/RLS mappings; existing consent/usage/ownership and image/video carousel remain. No orders, inventory, payment or ERP created. Local build/syntax/HTTP and 70/70 unit checks passed; provider-contract/text-bound cases included. Live Meta credentials/Commerce permissions/approvals and comprehensive browser/fault/load/restore acceptance remain unverified. Exact implementation/activation limits: docs/20-META-COMMERCE.md. Earlier statements that all Commerce source variants are absent are superseded by this entry; source completion does not prove provider activation. CI/commit evidence follows below.


Commerce source delivery: [c2487df](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/c2487dfb0673f3a53d477dfcb53b9507c36b1975). Development [push CI 39103361252](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39103361252) SUCCESS: **70/70**, migrations **0001–0025**, actual PostgreSQL Commerce mapping cross-tenant read/insert denial, FORCE/RLS gate and cart-as-interest lead/handoff assertions. Job 117603998394 logs inspected. Local 70/70 also passed. External provider activation and full browser/fault/load/restore acceptance remain unverified; this evidence does not claim those passed.


## 2026-10-18 — actual runtime/browser/backup acceptance
- New `tests/runtime-acceptance.mjs`: two-tenant non-owner PostgreSQL role, auth/catalog/FAQ, real flow save/publish/preview, website lead/human handoff and dedupe/origin, worker heartbeat, DELAY continuation once, 40-request smoke and logout.
- New `tests/browser-acceptance.mjs`: Chrome DevTools login, dashboard/canvas desktop/mobile viewports and screenshots. Fixed race in test startup (wait for module login handler) rather than changing production auth.
- New `scripts/ci-backup-restore.sh`: disposable PostgreSQL `pg_dump` + `pg_restore` into a new test DB, with migration/company/bot/catalog verification.
- `.github/workflows/verify.yml`: new independent runtime acceptance job, real PostgreSQL/Chrome and screenshot artifact. Original check job retained.
- Confirmed CI [39105138303](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39105138303) SUCCESS across both jobs: 70/70 unit tests, migrations 0001–0025, RLS and new runtime/browser/restore checks.
- This does NOT prove live Meta/Google/ecommerce accounts, real ClamAV/AI, production load/security or commercial readiness. See `project-management/ACCEPTANCE-EXECUTION-2026-10-18.md`.


- Follow-up 2026-10-18: added security `.dockerignore`, container-image build/static HTTP smoke in CI, tested a `node:22-alpine` image and verified dashboard/Flow Builder/widget asset responses; [run 39105618688](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39105618688) SUCCESS with both acceptance and original check jobs.
