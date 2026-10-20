# 20 October 2026 — Builder collaboration/recovery batch

Same implementation branch and [Draft PR #4](https://github.com/hendhafez5566-arch/Elhafez-boat/pull/4), continuing `a781bab`. Tested executable commit: **`b592b7b2d12b178b1e093defc03501d581077540`**. Final evidence commit changes reports/images only. No schema migration, merge, Railway operation, paid AI or real provider connection/send.

## Implemented and verified

**S05/S06/S07 — still PARTIAL overall:** the editor now keeps the last loaded/saved server definition as a comparison base. On a real 409, independent edits can be combined; overlapping fields require an explicit local/server selection. Choice arrays, deletion versus edit, same-ID additions and incompatible node types are treated conservatively, retaining literal IDs and destinations rather than guessing. Canonical comparison avoids false differences from object property order. The combined candidate passes the real authenticated flow/subflow compiler before replacing local editor state. Applying review writes nothing to the server; the subsequent save uses the latest observed optimistic revision, so another intervening save still produces a conflict. Undo retains local work. Scope guards protect against changed company/bot/editor state during async review, and logout clears recovery snapshots/UI.

Backup restore now accepts plain definitions or the existing download wrapper, limits files to 1 MiB, rejects malformed JSON, validates through the real compiler, confirms local replacement and preserves undo/redo. An imported historical revision never replaces the current save revision. Restore neither saves nor publishes automatically. Current limitation: merge/import requires a fully valid compilable graph, so unfinished/dangling drafts can still be downloaded/edited manually but cannot be applied through this recovery path. This is conservative structural combination, not proof that every merged conversation has the intended business behavior; operator review remains necessary.

## Evidence and results

- `npm run check`: **127 passed, 0 failed, 0 skipped**, including 9 new tests for independent edits, overlaps, deletion/edit conflicts, additions/order, atomic type/choice handling, layout changes, immutability and compiler rejection of a structurally combined but dangling graph.
- Full `CI_RUNTIME_ACCEPTANCE=1 CI_ACCEPTANCE_DISPOSABLE_DB=YES CHROME_BIN=/usr/bin/chromium MIGRATION_DATABASE_URL=postgresql://postgres:…@127.0.0.1:5432/elhafez_ci node tests/runtime-acceptance.mjs`: **exit 0 on b592b7b**, both original and extended Chromium suites. Actual PostgreSQL/runtime/API/worker recovery, roles, tenant boundaries, throttles and existing local website/campaign journeys remain passing. Provider transport stays offline.
- Browser conflict case uses an authenticated external API update while the browser retains a local edit. One overlapping greeting requires a decision; the independent server name change survives. Applying review leaves server revision/content unchanged; explicit save stores the chosen greeting plus server name, keeps choice IDs and leaves the bot unpublished.
- Browser file case uses Chromium's real file selection: malformed JSON rejected, valid wrapped backup compiled/restored, server unchanged before save, undo/redo preserved, explicit save succeeds with current revision and published remains null.
- 81 broad page/viewport visits remain loading/named-control checks, not functional certification of every screen. Real 1366/320 conflict screenshots and 320 restore screenshot were visually inspected; no horizontal overflow. Full keyboard/screen-reader/native 200%/physical-device acceptance is still open.

Actual images: [conflict desktop](evidence/conflict-review-1366.png), [conflict 320px with both versions visible](evidence/conflict-review-320.png), [restored draft 320px](evidence/conflict-restored-draft-320.png). [Machine-readable proof](evidence/conflict-recovery-verification.json). Historical actual builder before images remain under `evidence/rebuild-before-*`; this batch does not claim a separate screenshot of the former conflict dialog.

S05/S06/S07/S22 remain PARTIAL. Full company onboarding, dense/cyclic/accessible canvas acceptance, remaining campaign template shapes, inbox concurrency/provider matrices, reporting and other partial rows remain open. Previously completed bot/gallery/CRM work is unchanged. GitHub API still returns Forbidden; no remote CI-success claim. Push this feature branch only, no replacement PR.

---

# Usability batch after 741e6cb — locally verified, PR #4 remains PARTIAL

Application commit `a3b6418`, final executable/test commit `8f0ad62`, same branch and [Draft PR #4](https://github.com/hendhafez5566-arch/Elhafez-boat/pull/4). No migration, merge, Railway deployment, paid AI or real provider connection/send.

- **S02 PARTIAL:** ready-customer actions now open the exact inbox thread rather than the general list; Arabic channel labels/numbers, real empty state and retry retaining prior metrics. Exact-thread navigation tested in Chromium. The full dashboard KPI/action/error-state specification remains open.
- **S05–S07 PARTIAL:** condition fields discover answers collected by the current flow; `exists` hides the irrelevant comparison value while preserving it for other operators; Arabic media-kind choices. Actual UI inserts CONDITION/MEDIA/LINK into a branch and saves typed fields without fetching the media. Desktop/320px inspector screenshots. Dense cyclic gestures, long beginner journeys and full keyboard/screen-reader acceptance remain open.
- **S10 PARTIAL:** website assignment, staff reply, release to bot, takeover and close now exercised through the browser with stored messages and reply-enabled-state assertions. Late handoff completion cannot reopen a previous thread after switching customers. This verifies disposable Website Chat only; real provider send/delivery acceptance and the complete concurrency/failure matrix remain open.
- **S13 PARTIAL:** four-step creation (supported WhatsApp channel/name, audience, content, schedule/review) replaces the long form. Back retains values, each step validates, final review renders actual template text/values, save creates a real draft. At least one message is retained, logout clears tenant-specific authoring data, review/launch remain separate. Browser checks actual visible expanded form, saves a draft and verifies reset. All complex template/media/commerce shapes and deeper audience selection UX remain open; no launch performed.
- **S14 PARTIAL:** UTC calendar-day boundaries now match report buckets and zero-filled 7/30/90-day charts; current follow-up tasks are explicitly distinguished from period-created records. Retry retains prior data, channel names are Arabic. PostgreSQL checks inclusive/exclusive first-day boundary, daily sum/KPI reconciliation, Asia/Tokyo session invariance and foreign-company isolation. Browser switches actual 7/90-day API reports. Comparative-period/KPI acceptance and remaining export/report UX remain open.
- **S22 PARTIAL:** real 1366/390/320 campaign, 1366/320 dashboard/inspector/inbox/analytics PNGs, no horizontal overflow. Native 200% zoom, physical devices and full screen-reader acceptance remain open. Other ledger states are unchanged.

## Verification and defect diagnosis

`npm run check`: **118 pass, 0 fail, 0 skip**. `node tests/bots-db.mjs` against disposable PostgreSQL on 5433: PASS including new UTC boundary tests. `CI_DB_INTEGRATION=1 node tests/db-integration.mjs`: PASS. Full `CI_RUNTIME_ACCEPTANCE=1 CI_ACCEPTANCE_DISPOSABLE_DB=YES CHROME_BIN=/usr/bin/chromium node tests/runtime-acceptance.mjs` on PostgreSQL 5432: exit 0, both browser suites, roles, 81 broad page/viewport visits, worker/API recovery, throttle and real local functional journeys. Final rerun on `8f0ad62` with `CI_BOT_BROWSER_ONLY=1`: exit 0; it skips only the already-passed broad UI child and repeats real database/API/worker and all new functional browser journeys. Campaign checks report zero queued jobs/outbound messages from review. Provider transport stays offline.

A real recovery failure was reproduced: a checked-out PostgreSQL worker client could emit an unhandled error between queries and terminate the worker. Client-lifetime error listeners now complement pool idle-error handling; query rejection/rollback and pg connection retirement remain intact. Recovery passed in subsequent runs. A unit DOM fixture was extended with querySelector support for loading-state cleanup; assertions remain intact. Browser screenshot review caught an initially collapsed authoring panel; tests now require actual visible expanded form and allow paint before capture. No assertions/limits were weakened.

## Actual evidence

- Campaign [desktop](evidence/wizard-campaign-1366.png), [390px](evidence/wizard-campaign-390.png), [320px](evidence/wizard-campaign-320.png); previous actual list/form layout: [before desktop](evidence/continuation-campaign-review-1366.png), [before 320px](evidence/continuation-campaign-review-320.png).
- Condition inspector [desktop](evidence/wizard-condition-1366.png) / [320px](evidence/wizard-condition-320.png).
- Manual inbox after close [desktop](evidence/wizard-inbox-closed-1366.png) / [320px](evidence/wizard-inbox-closed-320.png).
- Dashboard [desktop](evidence/wizard-dashboard-1366.png) / [320px](evidence/wizard-dashboard-320.png).
- Analytics [desktop](evidence/wizard-analytics-1366.png) / [320px](evidence/wizard-analytics-320.png).
- [Machine-readable results](evidence/usability-verification.json), [81 broad page visits](evidence/usability-browser-pages.json). Broad visits do not certify all screen actions. Screenshots contain synthetic fixtures only.

Git fetch confirmed remote feature head was `741e6cb` before work. GitHub API returns Forbidden, so remote CI success cannot be asserted. Target branch remained `ada4db6764c8ee8665764663b3a47351cf807637`. Push only this feature branch. Do not create a second PR or merge/deploy.

---

# PR #4 continuation — 19 October 2026

Same implementation branch: `feat/codex-product-rebuild-2026-10-19`. The owner identifies the existing Draft PR as [#4](https://github.com/hendhafez5566-arch/Elhafez-boat/pull/4); the historical statement below that no PR existed is superseded. Do not create a replacement PR. GitHub API still returns Forbidden in this runtime, so remote CI/PR metadata cannot be verified here. Changes are pushed to the same head branch only.

Executable batch: `bd3042d` (novice creation, step/branch editing, contact work and safe campaign review), with final workspace/acceptance refinement `907144450e8490fcb11e32a7786cfb7f1a5ac49d`. Full core runtime/Chromium suite exited 0; final targeted runtime/Chromium rerun exited 0 after template-view separation and stronger mobile/first-insertion probes. `npm run check`: 118 passed, 0 failed, 0 skipped. PostgreSQL integration and new data/security cases passed. No real provider account or paid request, merge, Railway deploy or real customer message was used.

## Delivered in this continuation

- **S01/S03:** searchable gallery with real template previews; four-step novice dialog (goal, business/greeting, deferred channel, review). Back retains answers. Server preview and creation share validated template preparation. Review creates no bot; creation saves one independent draft and opens the beginner editor. Optional phone collection changes actual routing, not a visual toggle. Existing quick creation remains available.
- **S05–S07:** beginner step cards show explicit choice destinations and contextual insertion; edit one branch without losing its stable action ID or former destination. Same flow switches between steps and canvas. First insertion into a blank Start now creates a valid terminal chain, tested through server validation. Branch reply shortcut added to inspector. Existing visual editing, undo/redo and publication pipeline remain.
- **S10:** real contact panel in inbox, paginated contact context, Arabic message/channel/status labels, mobile conversation back navigation, inline internal notes and conversation-bound unsent reply/note drafts. Thread switching cannot transfer one customer's draft into another customer's reply box. Note API remains internal and role-checked.
- **S11/S12:** explicit filter chips, current-page selection, bounded all-or-nothing bulk stage update (1–50 IDs, server role/tenant checks), and contact-wide paginated conversation history with actual last activity and links to the selected real thread. No bulk consent change or outbound action.
- **S13:** review before campaign launch reports actual segment/consent/opt-out/phone counts and approved content/schedule. Review queues zero jobs and makes no provider request. Launch revalidates the review, including template values and disconnected/expired account state. No campaign was launched by acceptance.
- **S17:** website/WhatsApp/social directory from actual saved configuration and bot routing. Readiness is described as local metadata; official connection controls remain separate and owner-restricted. Technical credential form is collapsed rather than being the first task presented.

## Acceptance and CI diagnosis

An initial extended UI run hit the real per-user 600/minute limiter after reusing the pressure-test actor (`max(hits)=601`). The test harness now provisions separate disposable actors for pressure, broad UI and novice UI; production limits are unchanged, and the 20-accepted/20-denied throttle check remains intact. Browser fetch assertions now preserve non-2xx HTTP status instead of treating error JSON as list data. This is a locally reproduced harness defect; it is not a claim about an unread remote CI run.

New PostgreSQL checks prove company-wide contact-history pages, all-or-nothing bulk changes and viewer/foreign-company denial. Campaign review checks real consent/opt-out counts, cross-company/agent denial and unchanged campaign queue counts. Targeted Chromium covers wizard back/review/no-write, gallery search, simple/canvas branch preservation, mobile layouts, private note persistence, channel directory, campaign review without launch and bulk CRM action. The final expanded run additionally checks unsent-reply preservation across actual thread switches and server-validates first insertion.

## Committed browser evidence

All images below come from Chromium against isolated PostgreSQL fixtures. They contain no real provider/customer account data. The prior delivery's before images remain under `evidence/rebuild-before-*`; current continuation images illustrate the actual new workflows, not a new competitor mockup.

- [Setup review, desktop](evidence/continuation-setup-review-1366.png) / [setup fields, 320px](evidence/continuation-setup-fields-320.png)
- [Searchable gallery, 320px](evidence/continuation-template-gallery-320.png)
- [Beginner steps, desktop](evidence/continuation-simple-editor-1366.png) / [390px](evidence/continuation-simple-editor-390.png) / [320px](evidence/continuation-simple-editor-320.png)
- [Same flow in canvas](evidence/continuation-canvas-1366.png)
- [Inbox context, desktop](evidence/continuation-inbox-context-1366.png) / [private note and retained draft, 320px](evidence/continuation-inbox-note-320.png)
- [CRM bulk action, 320px](evidence/continuation-crm-bulk-320.png)
- [Campaign no-send review, desktop](evidence/continuation-campaign-review-1366.png) / [320px](evidence/continuation-campaign-review-320.png)
- [Channel-readiness directory](evidence/continuation-channel-directory-1366.png)

Validation commands: `npm run check`; `CI_DB_INTEGRATION=1 node tests/db-integration.mjs`; `node tests/bots-db.mjs` with the named disposable migration database; `CI_RUNTIME_ACCEPTANCE=1 CI_ACCEPTANCE_DISPOSABLE_DB=YES CHROME_BIN=/usr/bin/chromium node tests/runtime-acceptance.mjs`. Full run exercised existing API/worker recovery, throttle, catalog/role/graph/browser checks and both UI suites. Targeted rerun used `CI_BOT_BROWSER_ONLY=1` and retained the real API/worker/database checks, skipping only the already-passed broad UI script. No production rate-limit configuration changed.

## Status changes and remaining work

| ID | Current status | What changed / remaining limitation |
|---|---|---|
| S01 | PARTIAL | Per-bot business/channel-deferred setup is implemented; full new-company registration/onboarding remains separate. |
| S03 | DONE+TESTED (local scope) | Search/preview/use-template-to-independent-draft implemented and exercised; three supported templates, no fabricated provider behavior. |
| S05 | PARTIAL | Real beginner branch editing now tested; independent novice acceptance of dense conditions and very long workflows remains open. |
| S06/S07 | PARTIAL | Context insertion/first-message integrity improved; not every MEDIA/CONDITION/advanced inspector or dense gesture is independently certified. |
| S10 | PARTIAL | Three-pane/mobile context, notes and reply-draft isolation implemented; full nested manual-send/takeover/assignment browser matrix remains open. |
| S11 | DONE+TESTED (local scope) | PostgreSQL paging/search plus visible chips and permission-safe atomic bulk stages. |
| S12 | DONE+TESTED (local scope) | Paginated contact-wide conversation history, real fields/activity and exact thread linkage. Message history retains the existing bounded API; this is not an unlimited export. |
| S13 | PARTIAL | Real no-send review and launch gate implemented; full channel/audience/content/schedule creation wizard and every template shape remain open. |
| S17 | PARTIAL | Actual channel directory implemented; live account/provider acceptance is prohibited without separate consent. |
| S22 | PARTIAL | New 320/390 novice/gallery/inbox/campaign checks; native 200% browser zoom, physical devices and full screen-reader review still unverified. |

Other S01–S22 entries below retain their previous status. None was marked complete merely because its page loaded. Remaining priorities: full company onboarding; dense/accessible beginner and advanced editing; manual inbox action matrix; complete campaign creation wizard; remaining media/analytics/integrations/team/owner UX cases. S16 live AI/provider activation remains blocked by the owner's restriction, not simulated as complete.

---

# Historical delivery snapshot before this continuation — 19 October 2026

**Delivery remains PARTIAL.** This is executable implementation, not completion of all S01–S22 or commercial acceptance. No merge, Railway deployment, real provider authentication, paid AI request or real customer message was performed.

- Instructions/base: `b02a3132751ed0b6acbbc5f1a928b83b04dcb572`.
- Implementation branch: `feat/codex-product-rebuild-2026-10-19`.
- Target observed unchanged: `feat/stage0-foundation` at `ada4db6764c8ee8665764663b3a47351cf807637`.
- Executable commits: `280a3be` (storage/API), `21f5fbd` (manager/routing/triggers), `d3fcca4` (canvas/CRM/integrity), `cbf76676874b9e386e4ce904d347cb9234617571` (independent-bot onboarding readiness).
- Branch push succeeded. **Draft PR not created:** `gh pr create --draft --base feat/stage0-foundation` returned `Post https://api.github.com/graphql: Forbidden`. Read-only API calls also fail at the proxy CONNECT boundary. An additive `api.github.com` domain requirement was saved in the cloud environment draft; it is not applied or published. Git access working does not establish API authentication.
- Latest tested executable SHA: `cbf76676874b9e386e4ce904d347cb9234617571`. Full runtime/Chromium acceptance exited 0, including both original and new bot-management journeys. The following evidence/configuration commit changes documentation, images and CI checkout history only. No remote CI-success claim is made.

## What changed

Tenant/bot composite storage, deterministic additive legacy backfill, independent drafts/releases/history/rollback, explicit unique channel routes, pinned sessions, scoped keyword/first-message rules, archive/restore and real session metrics. The same validation, shared-resource checks, tenant permissions and runtime remain in use. Legacy default APIs remain authoritative and accessible.

The independent-bot editor has a dedicated full viewport task layout, persistent save/publish/back controls, a docked desktop inspector and mobile step/inspector behavior. Selection survives authenticated reload. Common contact fields use Arabic choices with technical identifiers in advanced settings. CRM now searches/pages in PostgreSQL, exposes a permission-scoped profile and opens that lead's exact conversation.

## S01–S22

`DONE+TESTED` below is limited to the described local scope. Existing pages were preserved and exercised; a visited page does not certify every nested form. Screenshot names under `acceptance-evidence/` refer to generated local/CI artifacts; curated public-safe comparisons are committed under `evidence/`.

| ID | Status | Source and executed evidence | Remaining gap |
|---|---|---|---|
| S01 | PARTIAL | `bot-manager.js`, `bot-templates.ts`, `app.js`; first bot + template + server preview + retained draft in Chromium | Full company/business/channel onboarding wizard not rebuilt. Publication stores an independent release; channel activation is a separate guarded assignment. |
| S02 | PARTIAL | `app.js`, `vessel.js`; real company metrics/readiness and inherited dashboard browser tests; `overview-desktop.png` | Complete new dashboard visual acceptance and all error/zero states remain open. |
| S03 | PARTIAL | `bot-templates.ts`, `bot-manager.js`; blank/service/lead templates, preview, copy into a new independent draft; unit and browser tests | No standalone searchable gallery. |
| S04 | DONE+TESTED | `bots.ts`, `bot-manager.js`, migrations 0029–0032; PostgreSQL two-bot isolation + browser create/select/rename/archive/restore; `rebuild-after-manager-1366.png` | Provider connection truth remains metadata-only until separately approved provider acceptance. |
| S05 | PARTIAL | `flow-builder.js`, `flow-onboarding.js`; existing step mode/wizard, same definition, undo/redo; inherited Chromium journeys | Dedicated novice acceptance of complex branching/conditions across all screen sizes remains open. |
| S06 | PARTIAL | `flow-builder.js`, `flow-canvas.js`, `flow-geometry.js`, `vessel.css`; connector insertion, drag, zoom, undo, branching and full workspace; before/after captures | Dense cyclic graphs, every keyboard gesture and owner-perceived readability are not comprehensively certified. |
| S07 | PARTIAL | `flow-builder.js`; real text/buttons/list/input inspector, 3/10 limits, stable IDs, Arabic field selection; source/unit/browser coverage | Every MEDIA/CONDITION/LINK/advanced inspector variant not independently browser-tested. |
| S08 | DONE+TESTED | `flow-service.ts`, `flow-builder.js`; actual draft interpreter, name/phone validation, three buttons, handoff, unchanged lead totals; `rebuild-after-data-capture-handoff-320.png` | Does not certify live provider rendering or delivery. |
| S09 | DONE+TESTED | `bot-routing.ts`, `triggers.ts`, `bots.ts`; API/DB namespace isolation, unique assignment, publish target validation, pinned runtime; keyword and website route/unroute in browser | Real external account activation deliberately unrun. |
| S10 | PARTIAL | `workspace-ui.js`, `inbox.ts`; existing inbox/handoff/manual API guards and exact profile-to-thread browser journey; `wa-inbox-desktop.png` | Complete new three-pane inbox design and every note/send/takeover gesture on mobile remain open. |
| S11 | PARTIAL | `chatbot-leads.ts`, `workspace-ui.js`; actual PostgreSQL search/count/20-row pages, disjoint second page, literal wildcard and cross-company tests | Filter chips and permission-safe bulk editing are not implemented as a new workflow. |
| S12 | PARTIAL | `leadProfile`, `workspace-ui.js`; actual contact/fields/30-message transcript, tenant denial, exact linked inbox; `rebuild-after-contact-profile-200-percent.png` | A complete cross-conversation contact activity timeline is not implemented. |
| S13 | PARTIAL | Existing `campaigns.ts`, `extensions.js` preserved; `campaigns-desktop.png`; existing consent/window guards | Full rebuilt audience/schedule/confirmation wizard and no-send acceptance matrix remain open. |
| S14 | PARTIAL | `botInsights`, existing `analytics.ts`/`insights-ui.js`; genuine per-bot saved-session/field counts, cross-tenant tests; `analytics-desktop.png` | New period/trend UX and full KPI acceptance not completed; session counts explicitly are not unique people or delivery. |
| S15 | PARTIAL | Existing `catalog.ts`, `media.ts`, `media-scan.ts`; real catalog CRUD/XSS browser checks; `catalog-desktop.png`, `media-desktop.png` | Full new media workflow and local real-scanner acceptance not performed in this execution. |
| S16 | BLOCKED_PROVIDER | Existing AI/source configuration preserved; `ai-settings-desktop.png` | No paid AI or live provider activation authorized; no fabricated AI acceptance. |
| S17 | PARTIAL | Existing signup/channel code plus `bot-routing.ts`; verified/unexpired WhatsApp metadata required for new assignments; DB rejection tests; `channels-desktop.png` | Full channel directory redesign and real provider acceptance unrun by explicit owner restriction. |
| S18 | PARTIAL | Existing integration/secrets/SSRF checks preserved; browser rejects unsafe host; `integrations-desktop.png` | Full rebuilt integrations UX and provider failure matrix remain open. |
| S19 | PARTIAL | Existing team/invite APIs; real owner/manager/agent/viewer browser and cross-bot/tenant DB checks; `team-desktop.png` | Complete independent team/invitation/error-state UX audit remains open. |
| S20 | PARTIAL | Existing company entitlement/plan/usage reads; `usage-desktop.png`; inactive subscriptions still block mutations | No payment/subscription provider or new billing workflow implemented. |
| S21 | PARTIAL | Existing `platform.ts` and owner portal; actual platform login, fixture company/invite creation, logout; company token denied platform access | Complete new portal/logs UX and all owner operations not rebuilt. |
| S22 | PARTIAL | Chromium at 1366, 768, 390, 320; manager/canvas overflow checks, existing keyboard and mobile suite; 683px/2x-density desktop equivalent | Native browser 200% zoom, physical devices, full WCAG/screen-reader review and independent owner UX acceptance are NOT certified. |

## Tests and limits

- `npm run check`: **117 passed, 0 failed, 0 skipped**; includes TypeScript build and industry-independent template execution/phone validation.
- `CI_DB_INTEGRATION=1 node tests/db-integration.mjs`: PostgreSQL tenant isolation and FORCE RLS passed.
- `node tests/bots-db.mjs` with disposable migration URL: actual non-owner/non-BYPASSRLS connection; privileged-backfill guard, exact legacy definitions/revisions, repeated copy, independent draft/publication, immutable rollback, concurrent conflict, roles, another tenant, connected/expired-account route gates, stable pinned version after reroute, archive, metrics, profile and real pagination passed.
- Fresh database: all migrations **0001–0032** applied. Existing migration ledger makes repeated `npm run db:migrate` skip already-applied migrations. No reset/delete operation used.
- Disposable backup: pg_dump/pg_restore to another database matched entire-row fingerprints on **92 public tables** at the snapshot. This is not production recovery certification.
- `tests/runtime-acceptance.mjs`: real API/web/worker with isolated fixtures and offline provider transport; no live Meta account or real message. Original suite checks role/session/tenant boundaries, website messaging/handoff, delay worker and recovery, graph and catalog behavior and 81 page/viewport visits. New browser suite checks independent bots, capture/handoff preview, save/reload, management, route/unroute and exact CRM conversation.
- Current local run does not exercise the workflow's Docker Compose/ClamAV/production image steps. Remote CI could not be inspected because GitHub API is blocked.

## Images

Before assets are reconstructed from exact original handoff commit with `git archive`, against synthetic local test fixtures. After assets use this implementation. These are actual app captures, not vendor images or mockups; fixture definitions may differ, so they are not a pixel-identical experiment.

- [Before desktop](evidence/rebuild-before-builder-1366.png) / [After desktop](evidence/rebuild-after-builder-1366.png)
- [Before 320px](evidence/rebuild-before-builder-320.png) / [After 320px](evidence/rebuild-after-builder-320.png)
- [Bot manager desktop](evidence/rebuild-after-manager-1366.png) / [Bot manager 320px](evidence/rebuild-after-manager-320.png)
- [Name/phone/handoff preview](evidence/rebuild-after-data-capture-handoff-320.png)
- [Contact profile at 200%-equivalent viewport](evidence/rebuild-after-contact-profile-200-percent.png)

## Next exact action

Apply the saved `api.github.com` domain addition through cloud environment settings and publish that cloud configuration if required by the product. This is environment configuration, **not a Railway deployment**. Retry the Draft PR creation with the prepared body, targeting only `feat/stage0-foundation`; working Git credentials do not prove API authorization, so diagnose any remaining API error rather than requesting secret values in chat.

Continue the PARTIAL items above in the same implementation branch/one draft PR, prioritizing S01/S03 novice onboarding/gallery, S05–S07 dense/accessible editing, S10–S12 complete inbox/contact workflows, then the remaining S13–S22 UI and acceptance gaps. Do not merge, deploy, activate providers or describe this as the finished 22-screen rebuild.
