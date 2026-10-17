# Changelog — latest first

## 2026-10-17 — Owner pivot: ALL-BUSINESS chatbot builder platform
- Latest decision supersedes tourism-only chatbot scope. Product is a generic multi-tenant chatbot SaaS inspired by BotSailor's configurable tools; never a booking/accounting ERP.
- Added generic flow engine with TEXT / BUTTONS / LIST / INPUT / CONDITION / TAG / MEDIA / LINK / HANDOFF / END nodes, validation, customer state, versioned draft/publish and human lead handoff.
- Added SQL migration 0015 for tenant-specific workflow drafts, versions, sessions, custom lead fields. WhatsApp signed webhook adapter now uses published generic flow before old travel-specific logic (legacy code to retire).
- Built reusable Arabic visual block editor and browser-only preview plus starting templates for general, shops, clinics, restaurants, real estate, education and tourism.
- Added migration 0016 and generic product/service/offer catalog API and UI, company-configurable categories and optional approved info. Staff inbox can inspect custom data collected by chatbot flows.
- Updated AGENTS, README, master plan and project management handover/remaining. Source written/pushed on draft PR; real PostgreSQL/Meta/browser acceptance NOT executed.

Earlier extensive tourism booking and ERP changes in git history are obsolete, not future requirements.
