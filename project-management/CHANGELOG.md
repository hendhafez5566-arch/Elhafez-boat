# Changelog — latest first

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
