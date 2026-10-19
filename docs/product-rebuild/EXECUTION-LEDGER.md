# Product rebuild execution ledger — 19 October 2026

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
