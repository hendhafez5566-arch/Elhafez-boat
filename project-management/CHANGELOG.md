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
