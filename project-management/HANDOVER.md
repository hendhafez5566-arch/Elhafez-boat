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
Clean npm ci (21 packages), build/TypeScript, 12 JS syntax checks, DOM reference/ID safeguards, static HTTP serving for nine assets and diff checks passed. No local comprehensive unit/DB/browser/provider/performance/restore acceptance. Inspect current GitHub CI for its exact head/result; do not reuse earlier results. Newly added tests include core regression and the PostgreSQL RLS gate now includes all new tenant runtime tables.

Apply migration 0022 after previous migrations, configure grants/environment, then use docs/11-LOCAL-SETUP.md. Remaining native connectors/advanced formats/retention and final acceptance are explicitly open. No commercial readiness percentage, no merge or deployment.
