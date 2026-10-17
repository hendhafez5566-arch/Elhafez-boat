# READ FIRST — Elhafez Boat Handover, 2026-10-17

**Goal:** independent commercial, multi-tenant, Arabic RTL tourism/Umrah/Hajj WhatsApp sales SaaS. Not the old Elhafez ERP. Companies manage programs/bookings/offers/customers; travelers browse official WhatsApp lists/buttons/Flows; AI fallback must be grounded, and human takeover stops bot replies.

Repo `hendhafez5566-arch/Elhafez-boat`, branch `feat/stage0-foundation`, draft PR #1. PUBLIC by owner's explicit decision until later. **Do not ask again about privacy, and NEVER commit tokens, passwords or real customer PII.** Before edits inspect actual GitHub HEAD, AGENTS.md, docs/01-MASTER-PLAN.md, docs/13-WHATSAPP-OPERATIONS.md, docs/14-COMMERCIAL-RELEASE-GAPS.md and current source.

## User's execution policy

**Build the entire feature set first; perform the formal end-to-end acceptance suite ONCE near the end**, not after each build batch. Routine compile/syntax checking permitted. Do NOT claim tests passed without actual evidence. Keep this file and CURRENT-STATUS/REMAINING/CHANGELOG current every session; new chat should not ask user to restate completed requirements.

## Latest implementation on GitHub, NOT production validated

`apps/api/src/server.ts`: secured tenant routes, public Meta signed webhooks, public invitation acceptance, separate platform owner routes.
`apps/api/src/whatsapp.ts`: Meta token/phone verification, AES-GCM encrypted token, inbound state machine, automatic published menus, program details and provisional booking, human handoff, STOP/START consent, inbox/agent replies, optional Flow config.
`apps/api/src/flows.ts`: Meta Flow token binding, one-time validation and booking submission.
`apps/api/src/team.ts`: employee invitation/acceptance/revoke/role updates.
`apps/api/src/platform.ts`: platform owner login, tenants, plans, manual subscriptions, first-owner onboarding.
`apps/api/src/knowledge.ts`: reviewed FAQ draft/publish and exact published matching. **Not generative AI.**
`apps/worker/main.ts`: database-backed outbound Meta Cloud API worker with service-window protection.
`packages/database/migrations/0006..0010`: WhatsApp, staff, owner onboarding, Flow and reviewed FAQ data.
`apps/web/public/index.html`, `app.js`, `operations.js`, `operations.css`, `platform.html/js`, `join.html/js`: Arabic panels and separate console.
`meta/booking-flow-template.json`: draft Flow template for Meta; not yet published.
`docs/13-WHATSAPP-OPERATIONS.md`, `docs/14-COMMERCIAL-RELEASE-GAPS.md`: operational and remaining-release detail.

## Verification truth

Source committed via GitHub connector. Local check on *isolated new modules with stubs* using tsc was successful, as were standalone JS syntax checks; this does **not prove full repository build**. No live DB migrations, official Meta Cloud API, Flows or email, deployed dashboard, subscription billing, E2E or browser acceptance performed. Previous historical 29 unit tests from earlier batch were not re-run as part of this integration.

## Next action, without asking for things already decided

Continue implementing missing features: multi-departure/room packages, staff notifications and inbox assignment, approved templates and opt-in workflows, safe AI provider optional, commercial usage tracking, platform billing integration pending user/provider selection, runbooks. Resolve known security/permission and concurrency gaps before final release. Keep branch draft until full endgame acceptance. Never fabricate readiness percentages or claim live integration from simulation.