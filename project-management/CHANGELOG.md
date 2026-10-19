## 2026-10-19 — PR #4 continuation: novice creation, conversation work and safe campaign review

Same branch `feat/codex-product-rebuild-2026-10-19`, continuing owner-designated Draft PR #4. Added a server-validated four-step setup dialog with retained back navigation and draft-only review, searchable template gallery, same-definition beginner branch editing, valid first-message insertion, contact-wide timeline pagination, all-or-nothing CRM bulk stages, three-pane inbox/mobile back navigation, per-conversation unsent reply/note preservation, inline private notes, channel-readiness directory and read-only consent/template campaign review with launch revalidation. No schema reset, real provider use, merge or deployment.

Development validation: 118 unit tests passed at initial expanded checkpoint; TypeScript/JS safeguards passed after later changes. Actual PostgreSQL timeline/bulk/role/campaign consent checks passed. Targeted Chromium passed setup/back/no-write review, simple/canvas branch preservation, 320/390 layout, inbox notes/context, channel states and campaign/CRM review with zero campaign jobs/outbox. Final full suite remains to run on the committed executable SHA, including the new unsent-draft switch probe. Test harness now uses independent disposable actors for load and each UI suite: reproduced max hits=601 against real 600/minute limiter, preserved the production limit rather than changing it. GitHub API remains Forbidden; remote CI outcome cannot currently be inspected. No new PR should be created: updates belong to owner-designated #4. Next: final comprehensive local acceptance, refresh committed screenshots/ledger, push this same branch.

## 2026-10-19 — Verified rebuild delivery (PARTIAL, no merge/deploy)

Branch `feat/codex-product-rebuild-2026-10-19` is pushed. Tested executable SHA: `cbf76676874b9e386e4ce904d347cb9234617571`; original handoff `b02a313`, target remains `ada4db6764c8ee8665764663b3a47351cf807637`. Final full runtime/Chromium acceptance exited 0; 117 unit tests passed with 0 failed/skipped; actual PostgreSQL/RLS/multi-bot/backfill/concurrency/routing/profile/pagination tests passed; fresh migrations 0001–0032 passed. Disposable 92-table row-fingerprint backup/restore proof is documented. Screenshot captures and exact limitations are in `docs/product-rebuild/EXECUTION-LEDGER.md`, `evidence/verification.json`, and `DATA-MIGRATION-AND-RECOVERY.md`.

Do not treat all 22 screens as complete: ledger explicitly records 3 DONE+TESTED in the stated local scope, 18 PARTIAL, 1 BLOCKED_PROVIDER. Formal owner UX acceptance/native 200% zoom and numerous nested/new screen workflows remain open. No real provider/paid AI/live sends, merge or Railway operations occurred.

Draft PR attempt failed: `Post https://api.github.com/graphql: Forbidden`. Branch push works; GitHub API/CI could not be read. The `api.github.com` network addition is saved as an unapplied cloud environment draft requiring user review/save/publication through environment settings, separate from Railway. Prepared PR body: `docs/product-rebuild/DRAFT-PR-BODY.md`; target ONLY `feat/stage0-foundation`. Next: restore permitted API access and create the single Draft PR, then continue remaining ledger items in the same branch. Do not ask for raw credentials in chat or assume Git authentication also authorizes API access. Last evidence commit changes docs/screenshots/CI fetch history only; no additional application changes after the tested SHA.

## 2026-10-19 — Batch C: runtime integrity, full-canvas workspace and real CRM (not a full release)

Implemented a dedicated independent-bot editor workspace with persistent save/publish/back controls, docked desktop inspector, mobile inspector, measured canvas fit and forward vertical edge routing. Bot selection survives cookie reload via a tenant-validated URL. Common customer fields use Arabic choices; technical field IDs are advanced. Added real PostgreSQL contact search/pagination, linked contact profiles/inbox navigation, per-bot session/data metrics, archive/restore, first-message/keyword configuration and verified-account route gates. Migration 0032 adds integrity constraints and lookup indexes. Migration 0029 now rejects insufficient migration-role privilege instead of silently skipping FORCE-RLS legacy data.

Verified before this commit: 117/117 unit tests; PostgreSQL non-owner/RLS tests, two bots + another company, concurrent draft conflict, independent immutable rollback, session pinning after publish/reroute, archive, real pagination/profile/metrics; full 0001–0032 fresh schema installation; 92-table fixture backup/restore fingerprints. Chromium passed original app suite and new create/three-buttons/name/phone/handoff/save/reload journeys; bot rename/keyword/local website route/unroute/archive/restore and profile-to-exact-conversation passed. Final source recheck after latest field-label/account-gate edits remains to be recorded by exact SHA. This does NOT certify all 22 screens, native 200% browser zoom, paid AI, provider integrations or commercial UX.

Screenshots: curated synthetic-only before/after PNGs in docs/product-rebuild/evidence; full generated screenshots remain ignored under acceptance-evidence and CI upload artifacts. API access to api.github.com remains proxy-blocked; network draft addition saved but not applied/published. One Draft PR is still pending. No main/target merge, Railway deploy or live provider action. Continue with final recheck, execution ledger, feature-branch push and Draft PR attempt.

## 2026-10-19 — Batch B: bot manager, routing and triggers (source implemented; acceptance open)

Added an explicit flow-storage boundary shared by default and independent bots; no SQL rewriting, changes to original step IDs or replacement of the runtime. Bot manager supports create/select/name/archive, Arabic templates with draft-only preview, bot-scoped keyword rules, connected-account routing, route removal and independent builder saves/publishes/history. Channel route uniqueness rejects ambiguity; old sessions remain pinned; archived routed bots are protected. New migrations 0030–0031 and real PostgreSQL tests cover routing/roles/isolation. A fresh second PostgreSQL 16 instance applied 0001–0031 and bot tests passed. Backup/restoration to a separate disposable database succeeded. 115 existing unit tests passed after storage refactor. Initial browser baseline passed, while new bot-browser automation exposed a session initialization/login race; correction and targeted rerun are in progress. Before screenshots are captured from original b02a313 assets against synthetic fixtures, not competitor references. No claim of full S01–S22 completion. GitHub API blocked by proxy CONNECT 403; requested api.github.com network addition saved as environment draft, not yet applied or published. No remote branch push/PR/merge/Railway/provider activation yet.

## 2026-10-19 — Independent bot rebuild, batch A (in progress)

Implementation branch: `feat/codex-product-rebuild-2026-10-19`, based on instructions SHA `b02a3132751ed0b6acbbc5f1a928b83b04dcb572` (target observed `ada4db6764c8ee8665764663b3a47351cf807637`). Added migration 0029, tenant/bot storage, legacy snapshot preserving original live tables, bot CRUD and scoped draft/publish/version API reusing existing validation. `npm ci --cache /tmp/elhafez-npm-cache --ignore-scripts --no-audit --no-fund` and `npm run typecheck` passed. This is NOT completed acceptance: database migration, browser, channel routing and S01–S22 remain open. GitHub API returns Forbidden; PR/CI not verified. No merge/deploy/provider activation. Next: disposable PostgreSQL verification and bot manager/browser integration. Migration rollback is application rollback to untouched legacy tables; retain additive bot tables, never delete customer data.

## 2026-10-19 — Continuing deep dual-audit remediation
Added secure cookie-backed reload, CSRF guard and independent tests, safe draft conflict JSON backup, explicit catalog currency and statuses, grouped persistent desktop nav, privacy/usage/templates tabs, CRM field labels, mobile above-fold Flow Builder changes, 320px Chromium screenshot/overflow checks and null-control bug fix. Green database/browser Verify evidence at SHA d08085ae, with later commits awaiting their own CI. Separate PR #3 remains DRAFT and no Railway/Meta deployment. See docs/35-DEEP-UI-UX-REBUILD-2026-10-19.md.

## 2026-10-19 — Source-only deep UI/UX rebuild from two audit packs

Professional workspace hierarchy and five-category navigation, compact dashboard/page titles, on-demand catalog/FAQ/campaign forms, protected BUTTONS/LIST conversions, basic builder mode, readable preview/inspector, notification dismissals, form/translation fixes and responsive CSS. Separate branch, no merge/production deploy. Detailed QA/VIS register `docs/35-DEEP-UI-UX-REBUILD-2026-10-19.md`.

## 2026-10-19 — Isolated UI/UX real-user audit remediation (DRAFT, not deployed)

- Audit basis: Cloud Browser checked 21 screens, with 20 documented issues and 98 scenarios (51 Pass, 17 Fail, 30 Blocked); neither mobile testing nor live Meta acceptance was completed by audit.
- Created branch `fix/ui-ux-audit-2026-10-19` and draft PR #2 against `feat/stage0-foundation` to isolate changes from the Railway-linked live branch.
- Code changes: flow geometry, phone validation, simulator preflight/handoff, navigation search, alert position, Arabic forms, analytics loading, provider-aware connectors, editable FAQ drafts, log readability, simplified toolbar and UI text contrast.
- Safety: no merge to the deploy branch, no Railway restart, no Meta authorization, no WhatsApp send, no existing tenant or customer data modified.
- Verification: source build/unit checks and isolated browser/PostgreSQL CI must pass on PR HEAD. Independent mobile visual acceptance and original 20 screenshots' reproduction remain **open**; functional UI edits are NOT deemed production-ready on code tests alone.
- Meta Coexistence self-service remains gated on official provider setup; session reload OBS-02 remains investigatory.

See `docs/UI-AUDIT-FIX-2026-10-19.md` for issue-to-change mapping and acceptance gaps.

## 2026-10-18 — Manual Railway test-number pilot staged (NO deployment)

Owner confirmed GitHub autodeploy disabled on new Railway project industrious-flow / Elhafez-boat service. Source scripts/railway-pilot.mjs and scripts/railway-pilot-setup.mjs provide a guarded all-in-one demo (web/API/worker) and first-run migrations/bootstrap for a fresh boat_pilot DB using a separate non-BYPASSRLS runtime role. Test scripts block AI provider configuration and non-pilot database targets. A second PostgreSQL service + 512MB volume, generated HTTPS test domain and isolated secret/DB connection variables are STAGED ONLY on Railway. No resources deployed, and old Railway/ERP projects unaffected.

Source branch feat/stage0-foundation, draft PR #1. Meta app secret and the official test WABA connection are still missing; no actual inbound/outbound bot message was tested. No live Coexistence with the owner's business phone. See docs/33-RAILWAY-MANUAL-PILOT.md. Railway bill overage cannot be guaranteed away: min hard compute limit $10 vs $5 included Hobby usage. Owner alone approves and triggers Apply Changes / Deploy after review, never the assistant. Initial admin setup secrets must be removed after first successful boot. Latest CI must be verified for exact HEAD.

## 2026-10-18 — Vessel extended page UI (source 8fcc8e13f)
Source updates: contextual Vessel headings on 18 existing business pages; catalog gets rendered-items-only search without changing CRUD; CRM uses customer identity/status cards; analytics turns tenant API daily activity into two-series bars. Existing IDs, permissions, API schemas, bot runtime and Meta connections are unchanged. New Chromium coverage added; final CI results for the ultimate documentation HEAD must be verified. No merge, deploy or paid/external-provider operations. Scope details: docs/32-VESSEL-PAGES.md.

## 2026-10-18 — Vessel visual workspace (structural redesign)

Implemented new narrow icon rail, searchable categorized navigation drawer, transformed company dashboard/real metrics/onboarding, re-composed Inbox and full-width bot Canvas with contextual palette. Actual DOM controls and endpoints preserved; no database, provider, Meta, Railway, production merge/deploy or paid dependency. Evidence: [docs/31-VESSEL-WORKSPACE.md](../docs/31-VESSEL-WORKSPACE.md). Final browser screenshot acceptance must be checked on the final HEAD. Full platform-wide nested-page redesign and live WhatsApp activation are NOT claimed complete.

---

## 2026-10-18 — Premium UI completion pass (verified source ea1e0e56)

- Canvas now uses measured collision-safe pointer positioning, topology aware auto layout, real branch-port connection controls and focus/immersive view.
- Inspector supports WhatsApp choice ordering and exact button/list count + length constraints; safe one-successor step deletion.
- Cross-platform visual improvements: accessible empty states, grouped CRM filters/actions, optional catalog metadata disclosure, localized roles/toasts, mobile and navigation retained.
- Added actual Chromium branching, collision, choice-limit/ordering and viewport assertions. Source run 39139907714 both jobs SUCCESS; see `docs/30-PREMIUM-UI-CLOSURE.md` for honest limits.

## Verified premium UI browser acceptance — 2026-10-18

Executable UI SHA: `f86e3e86ad19038aca380419d496d05738209878`.
CI run `39135107231` (and duplicate `39135109840`) concluded SUCCESS for both jobs: `checks` and `Disposable PostgreSQL and headless browser acceptance`. GitHub Actions browser screenshots artifact `12139014668` contains **90 real PNGs** (93 files including JSON evidence). No screenshot was AI generated. The earlier CI `39126328249` artifact `12136321724` supplies **82 earlier PNGs**; visual comparisons are genuine but fixture records may differ. Source-code commits after the verified SHA, if any, require a new corresponding CI check.

Verified logs include: Chrome contextual (+) insertion, live inspector text edit, zoom, fullscreen toggle, popup simulator desktop/mobile, palette drag/drop, draft retention across navigation, flow save/publish in isolated test, catalog CRUD, keyboard Tab, 63 page/viewport navigation captures, platform owner login/company creation, role/tenant controls; all prior container, worker, API and PostgreSQL test steps passed. This **does not** mean every nested form, screenreader/mobile device or advanced feature is independently UX-certified. Some flow-test screenshots contain deliberately generated, unreachable draft steps and warning banners; they are test evidence, not a polished recommended production journey. The focus screenshot was captured while scrolled away from canvas, so don't use it as proof of layout quality.

No new libraries, paid provider, WhatsApp account, Railway resource, merge, deployment, or billing commitment. External live Meta activation remains blocked and not tested.

## 2026-10-18 — Premium RTL SaaS visual rebuild (source, pending final acceptance)

- Replaced canvas card renderer with visual messages, choices, zoom/pan/auto-layout, highlighted paths and contextual output ports.
- Added searchable step insertion preserving target routes, collapsible palette, fullscreen canvas, inspector drawer with advanced developer options, and simulator dialog reusing existing preview engine.
- Refactored global design tokens, RTL layout and shared component baseline; introduced inline SVG navigation and matching platform owner styling.
- Added real Chromium interactions/screenshots for premium studio controls; old business/tenant/provider behavior retained. See docs/29-PREMIUM-UI-REBUILD.md for exact limitations.

# Visual bot studio refresh — 2026-10-18

On existing branch `feat/stage0-foundation`, draft PR #1, source commits `68495dc`, `9237158`, `0d00532`, and browser/test documentation `d466cc6`. Flow Builder now uses RTL 3-zone component palette / drag-drop canvas / live visual-only message inspector with BUTTONS/LIST previews and a preserved engine preview. Advanced subflows and reusable snippets remain available in a disclosure. Existing flow definitions, API, storage, business behavior, tenant security, WhatsApp, Meta setup and provider sends were not modified. Mobile layout is responsive. Chromium suite was expanded to check palette, buttons/list samples, and synthetic drag/drop; inspect final CI for PASS. Full UX/accessibility testing and platform-wide redesign are still NOT TESTED / NOT DONE. No deploy, merge, Railway or Meta account action. Details in `docs/28-CHATBOT-VISUAL-STUDIO.md`.

---

# Feature expansion — 2026-10-18 (source delivered; CI acceptance pending)

Branch `feat/stage0-foundation` / draft PR #1. Source changes: [reports 3cea98b](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/3cea98b7fdfa1f400f77cb35af0bcc2d25520da9), [AI 5ee7fad](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/5ee7fadbc154f0d24e25c4c1978d8da29964b13d), [CRM 03d1829](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/03d18292d3f5c4853b5d07097c242b91ad118300), [Meta comment automation eaeaff9](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/eaeaff90c49769a48bddf5cde65f71e673287d34).
No provider account was connected, used, or activated by this execution, and no merge, production deployment, or live outbound delivery occurred.

- **Analytics**: 7/30/90-day tenant-bound reports plus daily captured-lead series; this measures inquiries rather than revenue. UI and a nonzero percentage test updated. Earlier CI failures on intermediate source were a headless DOM test double lacking `setAttribute`; corrected by af822d7, requiring fresh green CI.
- **AI**: a read-only, bounded, approved-source local agent planner and Arabic interactive owner preview for answer, catalog, contact intent and human handoff. No model connection, autonomous action executor, external calling, or unsourced response generation. Existing production answering remains conservative and knowledge-grounded.
- **CRM**: manager/owner staff assignment with tenant membership checks, audit, and search / priority / recency / due-date sorting in lead UI. Source remains a lightweight lead CRM, not a deals/payments suite. Existing 200 lead-list bound remains.
- **Marketing**: signed Meta webhook comment change parsing (Facebook Page and Instagram), company-scoped keyword rules, deduped candidates, review/approve/skip UI, and durable claimed private-reply dispatch code. Schema migration 0027, FORCE RLS. Both rule matching and provider sending are separate: rules default disabled, sender is gated by explicit host environment `ENABLE_META_PRIVATE_REPLIES=true` and is **off**. An AUTO rule auto-approves a matching candidate only; no outbound send without separate host activation. Real Meta app permission and end-to-end provider acceptance remain untested. Provider 408/5xx/uncertain outcomes must be reconciled, never automatically replayed.
- **Usability**: prior 3-step Arabic wizard, industry/goal presets and checklist remain supported; no claim of independent usability certification.

New tests: `agent-planner.test.mjs`, `crm-assignment.test.mjs`, `comment-automation.test.mjs`; prior `insights-display.test.mjs` revised for the range selector. CI must be validated against the final SHA before any feature PASS statement. External provider conditions and other previous acceptance gaps still apply. Do not confuse local code completion with commercial product readiness.

---
## 2026-10-18 — Verified code correction: analytics percentage display

On the existing draft PR #1 branch, corrected the tenant insights UI to format the numeric lead-capture ratio *before* appending the Arabic percent symbol. Previously the UI passed e.g. `37.5%` to `Number()` and displayed zero. Added `tests/insights-display.test.mjs` to verify nonzero and zero UI values. This is a display correction only: no API, business figures, data migrations, outbound integrations, deployment, or account activation changed. The new commit needs matching CI evidence; no new CI success is claimed here. Existing broader commercial and feature limitations remain unchanged.

## Final isolated execution verification

CI 39108014870 PASS including Compose replicas/database outage/persistence/operational alarm and every restored-table fingerprint. Added platform-pool recovery, server CPU/RSS measurement and 4 security regression tests (local 78/78). Latest source d5ac76c CI 39108108402 also PASS both jobs, 78/78 plus full Compose/restore/browser/runtime. Detailed proof/remaining scope in TECHNICAL-EXECUTION-2026-10-18.md.

## 2026-10-18 — isolated technical execution

WhatsApp ambiguous-send regression fix; API/worker idle DB recovery; two-replica fault and throttle checks; engine microbenchmark; all-page Chrome viewport traversal; local provider fixtures; isolated Compose; backup fingerprints; read-only alarms; owner activation and maintenance guides. Evidence and untested scope in CURRENT-STATUS.md. No activation/merge/deploy.

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


## 2026-10-18 — advanced runtime continuation from da1c6a3
Implemented source: native Sheets/HubSpot/WooCommerce/Shopify connectors and owner UI, OAuth/refresh/encryption, contact-sync queues and CONNECTOR node; immutable pinned linked SUBFLOW compilation/field bindings/return and Canvas library editing; Messenger/Instagram/Telegram receive/send adapters with unified inbox, signed/secret webhooks, dedupe and uncertain-send quarantine; owner privacy/retention/export/anonymization; fail-closed ClamAV upload gating; PostgreSQL distributed limits, granular API-key routes, worker health/queue UI. Migration **0024** is required.

Build/TypeScript, changed JS syntax and static HTTP dashboard/assets passed locally. No live provider/scanner, browser/mobile, load/fault/restore or formal final acceptance was run. Development CI evidence is attached below.

**Not all seven areas are closed:** Meta Commerce product-card/catalog-template variants remain unsupported. Existing approved image/video carousel was preserved and gains a published generic-catalog image picker. External accounts, OAuth apps/permissions, Meta review, HTTPS and ClamAV still require configuration and activation evidence. Legacy un-attributed webhook payloads, historical data and backups need a separate erasure process. Read `docs/19-ADVANCED-RUNTIME.md` for exact behavior and constraints; no commercial readiness claim.


Latest source evidence: [a4be882](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/a4be882e220f51f1f907cb2d30cdc4b890994da7), correction [9a338d6](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/9a338d63641f5b445abad2aaf2fa4ad4bcc5d318). Development CI a4be882 run [39100381266](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100381266) SUCCESS: **55/55**, migrations **0001–0024**, real PostgreSQL RLS/privacy/rate checks. Full final acceptance and live provider/scanner activation remain unverified; Meta Commerce product-card/catalog-template source remains open. Latest-head evidence: VERIFICATION-ADVANCED-2026-10-18.md.

Latest source correction **9a338d6** also passed [push CI 39100475500](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100475500) and [PR CI 39100478270](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100478270): **55/55**, migration 0024 and PostgreSQL gate. Logs inspected directly. This is not the formal final acceptance campaign.


## 2026-10-18 — Meta Commerce continuation from 5c03106
Implemented source: tenant/account-bound generic-to-Meta catalog mapping, official CATALOG/SPM/MPM/PRODUCT Carousel components, exact named/numbered template variables, real mapping/product/section/card UI for individual sends and campaigns, queue snapshot and pre-dispatch revalidation, inbound cart/referred-product interest-to-staff handoff. Migration **0025** adds FORCE/RLS mappings; existing consent/usage/ownership and image/video carousel remain. No orders, inventory, payment or ERP created. Local build/syntax/HTTP and 70/70 unit checks passed; provider-contract/text-bound cases included. Live Meta credentials/Commerce permissions/approvals and comprehensive browser/fault/load/restore acceptance remain unverified. Exact implementation/activation limits: docs/20-META-COMMERCE.md. Earlier statements that all Commerce source variants are absent are superseded by this entry; source completion does not prove provider activation. CI/commit evidence follows below.


Commerce source delivery: [c2487df](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/c2487dfb0673f3a53d477dfcb53b9507c36b1975). Development [push CI 39103361252](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39103361252) SUCCESS: **70/70**, migrations **0001–0025**, actual PostgreSQL Commerce mapping cross-tenant read/insert denial, FORCE/RLS gate and cart-as-interest lead/handoff assertions. Job 117603998394 logs inspected. Local 70/70 also passed. External provider activation and full browser/fault/load/restore acceptance remain unverified; this evidence does not claim those passed.


## 2026-10-18 — actual runtime/browser/backup acceptance
- New `tests/runtime-acceptance.mjs`: two-tenant non-owner PostgreSQL role, auth/catalog/FAQ, real flow save/publish/preview, website lead/human handoff and dedupe/origin, worker heartbeat, DELAY continuation once, 40-request smoke and logout.
- New `tests/browser-acceptance.mjs`: Chrome DevTools login, dashboard/canvas desktop/mobile viewports and screenshots. Fixed race in test startup (wait for module login handler) rather than changing production auth.
- New `scripts/ci-backup-restore.sh`: disposable PostgreSQL `pg_dump` + `pg_restore` into a new test DB, with migration/company/bot/catalog verification.
- `.github/workflows/verify.yml`: new independent runtime acceptance job, real PostgreSQL/Chrome and screenshot artifact. Original check job retained.
- Confirmed CI [39105138303](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39105138303) SUCCESS across both jobs: 70/70 unit tests, migrations 0001–0025, RLS and new runtime/browser/restore checks.
- This does NOT prove live Meta/Google/ecommerce accounts, real ClamAV/AI, production load/security or commercial readiness. See `project-management/ACCEPTANCE-EXECUTION-2026-10-18.md`.


- Follow-up 2026-10-18: added security `.dockerignore`, container-image build/static HTTP smoke in CI, tested a `node:22-alpine` image and verified dashboard/Flow Builder/widget asset responses; [run 39105618688](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39105618688) SUCCESS with both acceptance and original check jobs.
