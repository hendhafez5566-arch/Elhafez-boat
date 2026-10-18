# Handover — 2026-10-18 continuation

Repo hendhafez5566-arch/Elhafez-boat; branch feat/stage0-foundation; PR #1 stays draft/unmerged. This session verified remote starting HEAD d31c20e31ce6d92cf86829d14ef65574b01d0b2c and continued its identical local tree. GitHub upload uses Git-data connector, with remote tree equality checked against local content; direct shell push has no credentials. Never force over an unexpected head.

## Read first
AGENTS.md, docs/00-SCOPE-CHATBOT-ONLY.md, CURRENT-STATUS.md, REMAINING.md and docs/17-LEGACY-RETIREMENT.md. Product is for all companies, not reservations or ERP. Final comprehensive acceptance remains one separate last stage.

## Current execution architecture
- flow-engine/service: DELAY, dynamic paginated catalog snapshots, triggered entry, pinned revisions and optimistic draft save. Persist only catalog-generated runtime state: do not persist AI/webhook conversions as future answers/actions.
- delay-scheduler: locks conversation then job/session, validates version/node, respects human ownership/opt-out/subscription/window. Delay chains upsert the same per-conversation job after completing the previous step. Worker task transactions are separate from Meta dispatch.
- channels: neutral delivery boundary for WhatsApp outbox and durable website message payloads. Final handoff acknowledgements explicitly permit delivery after ownership changes.
- website/public-tenant: hashed visitor sessions and opaque routing, exact origin authorization on every call, receipt dedupe, send budget/rate controls, shared bot runtime and unified staff inbox. Managed website contacts have NULL phone, never fabricated numbers.
- media: bounded DB bytea uploads, signatures/MIME, public bearer URLs, deletion safeguard and managed-format validation. MEDIA_PUBLIC_ORIGIN must be configured for Meta to fetch them; no virus-scanning claim.
- template-components/templates: validated supported provider components; remote approved metadata; stale refresh, variables/media/interactive replies. Unsupported carousel/auth/named forms remain rejected. Provider operation remains unverified.
- campaigns: frozen consenting segment recipients and approved-template steps, cancellation, job state and bounded transient refresh retries. Worker checks consent/subscription/authorization and counts dispatch budget. No nonconsensual free-text campaign endpoint.
- usage/workspace: daily limits, admin-set caps, operational jobs, notifications and per-message read marks. Outbox commits PROCESSING before outbound HTTP; abandoned claims become UNCERTAIN and must not auto-resend.
- integrations/integration-secrets: public DNS checks plus pinned IPv4 HTTPS, exact allowlist, encrypted per-integration credentials and audited replacement/disable. Receivers must honor idempotency keys.
- app/workspace-ui/extensions/widget: real modular RTL screens. Old fake/demo tourism workspace has been removed; flow preview is separately labelled. Forms and private data clear on logout/session changes.
- services now contains security/transaction primitives only; team-directory replaces obsolete bot-config. Removed booking-choice/flows/contracts workspace, legacy UI and associated obsolete tests. Historical migrations/data remain intact. scripts/clean-build.mjs prevents old emitted JS shipping.

## Evidence and next action
Clean npm ci (21 packages), build/TypeScript, 12 JS syntax checks, DOM reference/ID safeguards, static HTTP serving for nine assets and diff checks passed. No local comprehensive unit/DB/browser/provider/performance/restore acceptance. CI on 7fc36262f120560582d86c9614ded23e71fd3aa1 passed 28/28 unit tests, migrations 0001–0022 and PostgreSQL catalog-isolation/RLS gate (run 39072771700). Follow-up startup scripts use compiled JS; latest-head CI must be read separately. Newly added tests include core regression and the PostgreSQL RLS gate now includes all new tenant runtime tables.

Apply migration 0022 after previous migrations, configure grants/environment, then use docs/11-LOCAL-SETUP.md. Remaining native connectors/advanced formats/retention and final acceptance are explicitly open. No commercial readiness percentage, no merge or deployment.

Implementation commit: https://github.com/hendhafez5566-arch/Elhafez-boat/commit/7fc36262f120560582d86c9614ded23e71fd3aa1
CI evidence: https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39072771700
See VERIFICATION-2026-10-18.md for exact limits of those checks.


## Continuation 2026-10-18: reusable sections, canvas groups, approved Meta carousel

- Branch `feat/stage0-foundation`, PR #1 remains DRAFT/UNMERGED.
- New `apps/api/src/flow-reuse.ts` and `packages/database/migrations/0023_reusable_flow_sections.sql`. Library is strict linear copied fragments only, max 100 per tenant, max 20 steps/entry, per-tenant RLS/FORCE and audited RBAC.
- `apps/api/src/flow-engine.ts` now validates optional `groups` metadata; `apps/web/public/flow-canvas.js`, `flow-builder.js`, `flow-builder.css` implement Shift-selection/grouping and reusable-fragment saving/inserting via real API.
- `apps/api/src/template-components.ts`, `templates.ts`, `apps/web/public/workspace-ui.js`, `style.css` support only Meta-approved MARKETING IMAGE/VIDEO CAROUSEL with 2–10 fixed approved cards, card-specific HTTPS/media/body/button values. Existing consent/queue/Meta provider approval remain required; unsupported variants rejected.
- Added `tests/flow-reuse.test.mjs` (7), `tests/template-carousel.test.mjs` (8), updated PostgreSQL `tests/db-integration.mjs`.
- Development CI run [39076237206](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39076237206) SUCCESS: **43/43**, migration **0023** applied, RLS/FORCE snippet and catalog isolation. Latest documentation commit unverified separately; check HEAD and CI before next action.
- Read `docs/18-FLOW-REUSE-AND-CAROUSEL.md` for exact limitations, especially **copies rather than linked subflows** and **NO real Meta carousel delivery proof**.
- Next source opportunities: true linked subflows, dedicated connector adapters for Sheets/CRM/ecommerce (OAuth/credentials required), other Meta template shapes if explicitly supported, retention/security controls. Keep owner request: one formal comprehensive final acceptance after feature build, no ERP/reservation expansion.


## 2026-10-18 — advanced runtime continuation from da1c6a3
Implemented source: native Sheets/HubSpot/WooCommerce/Shopify connectors and owner UI, OAuth/refresh/encryption, contact-sync queues and CONNECTOR node; immutable pinned linked SUBFLOW compilation/field bindings/return and Canvas library editing; Messenger/Instagram/Telegram receive/send adapters with unified inbox, signed/secret webhooks, dedupe and uncertain-send quarantine; owner privacy/retention/export/anonymization; fail-closed ClamAV upload gating; PostgreSQL distributed limits, granular API-key routes, worker health/queue UI. Migration **0024** is required.

Build/TypeScript, changed JS syntax and static HTTP dashboard/assets passed locally. No live provider/scanner, browser/mobile, load/fault/restore or formal final acceptance was run. Development CI result must be attached after push.

**Not all seven areas are closed:** Meta Commerce product-card/catalog-template variants remain unsupported. Existing approved image/video carousel was preserved and gains a published generic-catalog image picker. External accounts, OAuth apps/permissions, Meta review, HTTPS and ClamAV still require configuration and activation evidence. Legacy un-attributed webhook payloads, historical data and backups need a separate erasure process. Read `docs/19-ADVANCED-RUNTIME.md` for exact behavior and constraints; no commercial readiness claim.
