# READ FIRST — Next Chat Handover (2026-10-17)

Product: **Elhafez Boat**, independent, commercially sellable multi-tenant Arabic RTL SaaS for tourism companies. NOT the old accounting ERP. Customer primary UX: official WhatsApp Business Platform lists/buttons/Flows, with grounded AI fallback and staffed handoff. Agency staff run catalog, bookings, customers, offers, inbox, followups; platform owner eventually manages subscriptions.

Repo: `hendhafez5566-arch/Elhafez-boat`. User explicitly leaves it PUBLIC until later. Do not ask again about making it private. NEVER push credentials, PII or test customers derived from actual records.
Branch: `feat/stage0-foundation`, draft PR #1. **Never merge without verification and release decision.** Inspect actual SHA, changed files, and PR before any new changes. Read `AGENTS.md`, `docs/01-MASTER-PLAN.md`, `docs/02-ARCHITECTURE.md`, `docs/04-WHATSAPP-BOT.md`, `docs/06-DASHBOARD.md`, `docs/07-BUSINESS-RULES.md`, `docs/12-UI-IMPLEMENTATION.md`, `project-management/CURRENT-STATUS.md`.

## Verified files present on branch (check GitHub)
- Existing Stage 0 scaffold: TypeScript workspace, `apps/api` basic tenant auth/program/bookings APIs, initial DB schema and 29 historical unit tests, initial CI. Status still draft.
- New migration `0003_sales_workspace.sql`: contacts, customer notes, offers, internal conversations, staff messages and follow-up tasks under tenant RLS.
- New migration `0004_program_trip_details.sql`: program travel/summary/hotel/duration.
- New API business layer `apps/api/src/sales.ts` and expanded authenticated routes in `server.ts`.
- New polished Arabic RTL responsive dashboard via `apps/web/public/{index.html,style.css,app.js}`, plus explicitly labeled local-only demo mode and bot menu simulator; settings/team sections are just presentation/placeholder.

## User instruction governing testing
**Build the whole product first, then run the comprehensive test phase once at the end.** Do not insist on formal stage-by-stage acceptance. Keep routine compile/syntax safeguards while coding to avoid broken builds. Do NOT claim full acceptance from lint, TypeScript or static screenshots. Preserve tests for endgame.

## Previous local evidence, NOT release certification
29 preexisting tests reportedly passed in prior session on a reconstructed local checkout. During the latest batch only `node --check` and `tsc --noEmit` were used plus a static rendered design preview; no PostgreSQL was available. GitHub Actions, provider acceptance, real database workflows, live Meta WhatsApp and deployment remain unverified.

## Next substantial implementation, without asking user to repeat requirements
Add real travel-program departure/hotel/room pricing and per-departure capacity, WhatsApp provider-neutral interaction engine + webhook safety + outgoing queue, menu configuration and versioning, booking lifecycle and internal assignment, tenant staff features, owner superadmin and subscriptions. Keep no-secret-on-public-Git policy. Update CURRENT-STATUS/HANDOVER/REMAINING/CHANGELOG each batch.

After the entire feature scope exists, execute one final integrated acceptance covering actual DB, HTTP E2E, browser UI, provider sandbox, tenant security, scalability, backup/restore. Do not deploy as commercial until passing.