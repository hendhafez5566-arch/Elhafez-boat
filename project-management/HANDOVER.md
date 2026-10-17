# Handover — Elhafez Boat, 2026-10-17

## CRITICAL USER SCOPE CORRECTION (newest)
**GENERAL-PURPOSE chatbot platform for ALL businesses and shops**, inspired by BotSailor's options and configurable flows. Tourism is one optional preset; no hardcoded tourism bot. Still only a chatbot/communication automation SaaS, NOT an ERP, reservation/payment/accounting system.

Read `docs/00-SCOPE-CHATBOT-ONLY.md` and `docs/01-MASTER-PLAN.md` first. Those supersede ALL previous tourism-specific docs and overbuilt booking plans. Owner wants broad chatbot options: customizable buttons, lists, messages, images/media, customer inputs/custom fields, conditions, tags, optional approved AI, workflow builder, staff handoff and future integrations/broadcasts with compliance.

Repo `hendhafez5566-arch/Elhafez-boat` PUBLIC by user choice. Branch `feat/stage0-foundation`; PR #1 draft, unmerged. Do not switch repos/branches.

## Most recent actual code
- New generic deterministic TS engine `apps/api/src/flow-engine.ts` with START/TEXT/BUTTONS/LIST/INPUT/CONDITION/TAG/MEDIA/LINK/HANDOFF/END and validations.
- Tenant versioned flow persistence/runtime in `apps/api/src/flow-service.ts`, migration `0015_generic_flows.sql`; webhook adapter in `apps/api/src/whatsapp.ts` prioritizes generic published flows (or general default) and approved FAQ/catalog. Older hardcoded tourism conversation switch remains **unreachable legacy source**, to retire safely.
- Generic catalog schema `0016_generic_catalog.sql`, service `apps/api/src/catalog.ts` and authenticated `/api/v1/catalog` routes. Owner can create/publish product/service/offer with free-form category and informational price string. Customer question matching published exact full title triggers approved response and optional staff interest. No transactions, checkout or stock.
- React-free visual company editor: `apps/web/public/flow-builder.js` + CSS + new `flow-builder` section in `index.html`. Company picks industry preset or makes own graph of blocks via editable node links. Saves draft, publishes immutable revision, previews with browser-only messages. NOT actual drag-and-drop yet.
- Company catalog UI under `catalog`; old tourism category form hidden. Lead/inbox displays captured custom fields/tags. App JS demo uses memory data only.
- `apps/web/server.mjs` serves new static assets with same-origin CSP.
- `README.md`, `AGENTS.md`, `docs/00-SCOPE-CHATBOT-ONLY.md`, `docs/01-MASTER-PLAN.md` rewritten to reflect universal B2B SaaS.

## Verification / operational truth
New code was committed to GitHub using connector. Only isolated development TypeScript/JS syntax checks are available for new source; no clean entire repo npm install/build, actual Postgres migrations 0015–0016, Meta test number/provider acceptance, browser/mobile E2E or commercial deployment verified. No live Meta credentials provided. PR stays draft/unmerged. User explicitly wants **one formal full acceptance test campaign after ALL chatbot features are built**.

## Actual next task
Continue generic options based on scope, without industry logic: rich visual canvas drag/drop and connections, dynamically populated catalog LIST node, keyword triggers, media management and approved templates, tag/field filters, automated sequences with WhatsApp window and opt-in, safe integration API/webhook connectors and optional grounded AI. Safely retire old booking/tourism overbuild, preserve migration history. Polish RTL/mobile company UX and reusable presets. Finally one combined acceptance + release, not per-batch formal testing.

Never claim a feature is live if only a schema/module exists. Keep GitHub tracking files current.
