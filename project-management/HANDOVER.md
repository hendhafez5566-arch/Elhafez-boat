# HANDOVER — advanced continuation 2026-10-18

Continue `hendhafez5566-arch/Elhafez-boat`, branch `feat/stage0-foundation`, draft PR #1. Never merge/deploy or revive ERP/booking services. Verify actual remote HEAD, not an older summary. This delivery started at da1c6a3 and pushed source a4be882 plus identity correction 9a338d6; links/evidence in CURRENT-STATUS.md.

## Runtime and source map

- `subflows.ts`: tenant library immutable versions; compile pinned calls at publish, namespace IDs, alias field bindings, END returns, depth five/expanded graph 100. `flow-service.ts` stores source_definition for edit/rollback, compiled definition for session pinning; retain both. Existing snippet library/group metadata remains.
- `connectors.ts` + `provider-http.ts`: Google OAuth/PKCE/refresh, HubSpot/Shopify code exchange, Shopify HMAC, Woo consumer keys, per-tenant encrypted credentials and mapping, stable contact/email IDs, bounded queued sync and SSRF-safe pinned provider transport. Google uses dedicated sheet column A for contact UUID; no arbitrary formulas. Ambiguous Sheets requests are quarantined; reconcile before retry. Runtime flow CONNECTOR never dispatches during preview.
- `social.ts` + `channels.ts`: Messenger Page token, Instagram Login professional account, Telegram private bots. Raw Meta webhook HMAC checked before JSON; Telegram secret validated before mutation. Shared engine/leads/inbox and service/opt-out gates. Provider messages use supported formats; short opaque callback mapping. Commit PROCESSING before HTTP; unknown outcomes become UNCERTAIN, do not auto-resend. Accounts may reconnect only within the company already owning the routing entry.
- `privacy.ts` + `media-scan.ts`: owner-only policy/export/anonymization; hourly opt-in old closed-contact cleanup, no unapproved historical bulk deletion. In-flight/uncertain delivery prevents erasure. clamd Unix-socket INSTREAM; uploads stay PENDING/private until CLEAN, malware QUARANTINED. Historical media also requires rescan. Public CLEAN media links are bearer capabilities for provider fetch.
- `rate-limit.ts`, `access-keys.ts`, `workspace.ts`, worker: PostgreSQL atomic shared counters, narrow route/method scopes, hashed identity/IP, trusted gateway only; health and queue views, periodic expired bucket/OAuth cleanup. API/worker errors log codes rather than provider/customer bodies. Staff notifications continue DB-backed polling, not browser push.
- `advanced-ui.js` plus current app/builder/workspace modules: real authenticated connectors/channels/privacy settings, library editor mode, OAuth/rotation, resource selection, queue display. No seeded customer data.

## Setup

Apply migrations **0001–0024** with the migration role; grant new tenant tables and opaque routing/rate/OAuth tables to a non-owner/non-BYPASSRLS runtime role. Preserve existing encryption master keys. Configure .env.example values including shared RATE_LIMIT_SECRET, trusted gateway IPs, APP_PUBLIC_ORIGIN and optional provider apps/approved hosts/ClamAV socket. All exact callback/webhook URLs, account types, permissions and operational caveats are in docs/19-ADVANCED-RUNTIME.md.

Run npm ci → npm run build → npm run db:migrate → provision owner with documented bootstrap env → start dev:api, dev:web, dev:worker in separate processes. Dashboard http://127.0.0.1:3000; login with provisioned company slug/email/password. No default/shared credentials. See docs/11-LOCAL-SETUP.md.

## Evidence and next action

Local build/syntax/DOM/HTTP/diff safeguards passed. Development CI a4be882 push run 39100381266 and PR run 39100384190 SUCCESS: 55/55 tests, migrations 0001–0024, real PostgreSQL RLS/isolation/privacy/rate gate. Read VERIFICATION-ADVANCED-2026-10-18.md for latest-head CI. Do not equate CI with final acceptance.

**Still open source:** Meta Commerce product-card and catalog-template variants. Existing approved media carousel is preserved, with generic-catalog image selection, not Commerce catalog capability. No actual Google/CRM/store/social/Meta/ClamAV live operation has been verified. Historical data/backups/remote deletion and old unattributed generic webhook payloads need separate privacy handling. No screenshot/browser/mobile/load/restore evidence. Formal comprehensive acceptance remains the final separate campaign after scope closure/agreement.

GitHub pushes use Git-data connector because shell git has no write credential; compare constructed tree to local committed tree and update ref with expected SHA, never force over an unexpected head. Local git commit IDs may differ from connector commit IDs while trees match. Final public evidence must use remote commit IDs.

Latest source correction **9a338d6** also passed [push CI 39100475500](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100475500) and [PR CI 39100478270](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100478270): **55/55**, migration 0024 and PostgreSQL gate. Logs inspected directly. This is not the formal final acceptance campaign.


## 2026-10-18 — Meta Commerce continuation from 5c03106
Implemented source: tenant/account-bound generic-to-Meta catalog mapping, official CATALOG/SPM/MPM/PRODUCT Carousel components, exact named/numbered template variables, real mapping/product/section/card UI for individual sends and campaigns, queue snapshot and pre-dispatch revalidation, inbound cart/referred-product interest-to-staff handoff. Migration **0025** adds FORCE/RLS mappings; existing consent/usage/ownership and image/video carousel remain. No orders, inventory, payment or ERP created. Local build/syntax/HTTP and 70/70 unit checks passed; provider-contract/text-bound cases included. Live Meta credentials/Commerce permissions/approvals and comprehensive browser/fault/load/restore acceptance remain unverified. Exact implementation/activation limits: docs/20-META-COMMERCE.md. Earlier statements that all Commerce source variants are absent are superseded by this entry; source completion does not prove provider activation. CI/commit evidence follows below.


Commerce source delivery: [c2487df](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/c2487dfb0673f3a53d477dfcb53b9507c36b1975). Development [push CI 39103361252](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39103361252) SUCCESS: **70/70**, migrations **0001–0025**, actual PostgreSQL Commerce mapping cross-tenant read/insert denial, FORCE/RLS gate and cart-as-interest lead/handoff assertions. Job 117603998394 logs inspected. Local 70/70 also passed. External provider activation and full browser/fault/load/restore acceptance remain unverified; this evidence does not claim those passed.


## NEW acceptance handover — 2026-10-18
Last **confirmed passing runtime evidence**: [CI run 39105138303](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39105138303); see `project-management/ACCEPTANCE-EXECUTION-2026-10-18.md`. New files `tests/runtime-acceptance.mjs`, `tests/browser-acceptance.mjs` and `scripts/ci-backup-restore.sh`; `.github/workflows/verify.yml` gained independent `acceptance-runtime` gate. Existing 70/70 tests, 25 migrations, RLS and real nonowner runtime/auth/widget/worker/delay/Chrome/pg_dump-restore passed in CI. Five screenshot PNGs are available as an artifact (not fabricated screenshots). Browser login test originally submitted before module load; fixed waiting for `onsubmit` initialization. The main application was not changed for that test issue.

Do NOT claim live Meta/Google/Shopify/Messenger/Instagram/Telegram/ClamAV/remote-AI performance; these depend on external accounts and/or production environment. Provider-specific failover/security/load and live pilot remain essential, PR #1 DRAFT/UNMERGED. Verify current HEAD before changes; this entry supersedes older notes claiming **no browser acceptance**.
