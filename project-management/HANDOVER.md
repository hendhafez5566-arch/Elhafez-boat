# READ FIRST — Elhafez Boat cross-chat handover (2026-10-17)

## Product
Independent multi-tenant, Arabic RTL tourism SaaS for agency staff. Customers use native official WhatsApp Cloud API lists/buttons and optional published WhatsApp Flows for Umrah/Hajj/tourism booking requests. Free-text AI may assist only using grounded facts, never invent prices or confirm bookings. Internal dashboard handles program catalog, hotels/travel dates, leads/customers, booking approval, staff/handoff, offers, followups, subscription, admin. NOT the legacy Elhafez offline ERP.

## Repository and owner decisions
- GitHub: `hendhafez5566-arch/Elhafez-boat` (PUBLIC *by owner's explicit choice*, not change privately without asking).
- Active branch: `feat/stage0-foundation`. PR #1 OPEN, DRAFT, unmerged.
- User wants **implementation first, ONE formal comprehensive acceptance cycle at the end**. Lightweight syntax/TypeScript checks permitted while coding; no invented test results.
- GitHub plan/current status/handover must stay current so next chat can continue without repeating requirements.
- Never put secrets, Meta tokens, customer PII, receipts or real traveler IDs into this PUBLIC repo.
- No Meta connection, real hosting/database, verified provider delivery or production deployment has been established.

## Source work committed, not release-tested
- `apps/api/src/services.ts`: role/tenant-scoped catalog and bookings; optional departure and room package IDs; price snapshot, atomic confirmation and capacity release on cancel; subscription limits.
- `apps/api/src/inventory.ts`: travel dates + contracted hotel room types, nights, rates, occupancy and total units.
- `apps/api/src/sales.ts`: tenant customers, offers, followups and INTERNAL staff conversation notes.
- `apps/api/src/bot-config.ts`: editable drafts with immutable published menu revisions.
- `apps/api/src/whatsapp.ts`: official Meta phone connection verified with Graph; encrypted token, signature-verified inbound webhook, deduped messages, menus, human handoff, STOP/START and staff inbox; optional Meta Flow and approved FAQ exact-match routing.
- `apps/api/src/flows.ts`: one-time tenant and conversation bound Meta booking Flow response handler. `meta/booking-flow-template.json` is a DRAFT asset, NOT uploaded to Meta.
- `apps/api/src/knowledge.ts`: tenant reviewed FAQ, deterministic exact-match answers. **No actual LLM integration.**
- `apps/api/src/templates.ts`: Meta-approved variable-free template registry, explicit documented opt-in, single-recipient queue with 24-hour per-customer cap.
- `apps/api/src/team.ts`: invite/accept/revoke/role change; manually share one-time link.
- `apps/api/src/platform.ts`: platform owner auth, create tenants, owner invitation and MANUAL subscription status. Billing provider not integrated.
- `apps/api/src/server.ts`: endpoints for above services with role/subscription gates.
- `apps/worker/main.ts`: durable PostgreSQL outbound queue, retry/unknown reconciliation states, service-window cutoff, template opt-in, subscription enforcement and expired-job rejection.
- `packages/database/migrations/0001..0012`: schema, RLS, WhatsApp, platform, inventory and template consent.
- `apps/web/public/index.html`, `app.js`, `operations.js`, `operations.css`: Arabic agency dashboard + explicit browser-only demo, inventory/departure/rooms, bookings, approved templates, WhatsApp inbox, employee management, company subscription.
- `apps/web/public/platform.html/js`, `join.html/js`: separate owner console and invite acceptance.
- `Dockerfile`, `deploy/compose.platform.yaml`, `deploy/scripts/backup-postgres.sh`, `deploy/README.md`: reference operations scaffold only, UNVERIFIED.
- `docs/13-WHATSAPP-OPERATIONS.md`, `docs/14-COMMERCIAL-RELEASE-GAPS.md` and project-management/* explain the architecture and remaining work.

## Absolute truth about execution
- GitHub contents were committed using connector; the branch has NOT been merged.
- No clean `npm install`/lockfile/build over checked-out GitHub repo, live migrations 0001–0012, actual tenant RLS integration, real browser acceptance, Meta sandbox/live account, full message delivery, PostgreSQL backup/restore or production deployment was completed.
- Local isolated TS/syntax safeguards passed for some source drafts. That is NOT a production test. No final formal acceptance was run by owner's deliberate request.

## NEXT ACTION (do not ask for repeat)
Continue code and user-visible workflows: finish full WhatsApp program/departure/room selection, customer contact/traveler fields in Flow, approval/cancellation/refund business policies, inbox worker reconciliation, optional grounded AI and payment/billing architecture (provider credentials unavailable). Complete end-user screens without fake buttons. Build standard deploy/runbook and usage metering. Keep requirements and branch unchanged.
Only AFTER feature scope is ready: one combined formal acceptance with real Postgres/RLS, HTTP/browser, Meta test number, event dedupe, concurrency, billing provider, restore/security/performance, then review PR and deploy. Never claim commercial readiness before evidence.

Read `AGENTS.md`, `docs/01-MASTER-PLAN.md`, `docs/14-COMMERCIAL-RELEASE-GAPS.md`, `project-management/CURRENT-STATUS.md` and actual code; verify HEAD/PR before work. Update this file and CHANGELOG at end of each turn.


## Continuation: customer reservation selection (2026-10-17)

Added `apps/api/src/booking-choice.ts`, migration `0013_whatsapp_booking_choices.sql` and modifications to `apps/api/src/flows.ts`, `whatsapp.ts`, `services.ts`, `apps/web/public/app.js`, `index.html`. WhatsApp native interactive menus now select future, available departures and contracted hotel rooms before capturing name/party size or opening a published Meta Flow. Choice is stored in conversation state and bound to one-time Flow token; actual fare and inventory are read on booking submission, never trusted from client input. Basic published programs with no departure continue via old flow. Meta phone-number booking status lookup is tenant-scoped and only uses verified webhook sender. Human assignment lock stops agents replying to someone else's open takeover.

New complete workflow details: `docs/15-WHATSAPP-BOOKING-CHOICES.md`.

**Important:** migration 0013 is unexecuted. Do not assume the updated bot can start against old DB schema. Requires sequential migrations 0001..0013. Local isolated TS typecheck of newly authored booking-choice and flows source succeeded, NOT full repository / browser / real Meta or PostgreSQL acceptance. Owner wants ONE final full acceptance only after remaining feature build. No production deployment or merge. Continue using branch `feat/stage0-foundation` and draft PR #1; public repo by explicit owner decision. Never write secrets/PII.


### Additional workflow / screen changes
- WhatsApp `showMenu` supports `my-bookings`: SQL matches verified webhook sender and current tenant only; returns short statuses and travel date without exposing unrelated travelers. Staff "MY BOOKINGS" does not authenticate from a user-entered phone.
- Agency `wa-inbox` has local search/filter and manager reassign UI; backend requires row-locked handoff ownership. Demo chat state is cleared before exposing a new tenant inbox. No WebSocket/live notifications yet.
- Updated sources: `apps/api/src/whatsapp.ts`, `apps/web/public/operations.js`, `index.html`, `app.js`.
- New code has not gone through actual complete checkout, real PG migration/provider/browser acceptance; preserve final acceptance stage.
