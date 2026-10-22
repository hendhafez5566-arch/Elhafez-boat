# PR #7 — final correction and acceptance

Branch: `feat/approved-hybrid-ui`. PR: [#7, Draft](https://github.com/hendhafez5566-arch/Elhafez-boat/pull/7). Source/test commit: `314e54b3f7ffbfa956e03470721fd2e5e4321801`; following evidence/documentation commit is the delivery HEAD. No merge, main update or Railway deployment.

## Confirmed failure and production fix

The branded back button retained its old text but gained an accessible `ELHAFEZ BOAT` wordmark. Its computed name consequently stopped being exactly `إدارة البوتات`. The shared browser navigation helper correctly rejected it. The 500-node/mobile case exposed the regression, but the node count was not its cause.

The production button now has a stable explicit Arabic accessible name and tooltip, independent of decorative branding and view/viewport changes. Desktop also displays a real Arabic navigation caption under the wordmark. It remains the same real button and original navigation handler, including unsaved-draft protection. No synthetic click, test selector workaround, reduced assertion, disabled test, engine change or hidden alternate navigation was added.

A second real navigation regression surfaced in the independent-bot runtime suite: `app.js` reset fullscreen text using `.builder-view-actions button:last-child`. After toolbar composition changed, that selector addressed the preview button and renamed it to “ملء الشاشة” when leaving the builder. The actual fullscreen control now has a stable `.builder-focus-toggle` identity, and navigation resets only that control. No positional selector is used for this transition. The new hybrid browser scenario saves, leaves to the real manager, reopens the bot and starts the original modal simulator through its still-correct visible button.

The first complete push run passed, but the matching PR run exposed a timing-dependent recovery problem. Turning autosave on called `markDirty()` and immediately scheduled a write of an already-restored, unreviewed draft. Under slower timing this ran before the second tab's storage event. Autosave opt-in now changes the preference and cancels an old timer; it applies to the next actual user edit, while the existing manual Save remains available for the recovered copy. The unmodified four-part `exerciseRecovery` test passes, and an added real browser check proves both no write on the toggle alone and a real write on the next edit. No timeout/expectation was relaxed.

`visual-rebuild-browser.mjs` now additionally waits for the actual accessible button after the mobile Basic → desktop transition and captures the full 500-step Basic view. The existing authoring helper captures the real manager immediately after the original navigation succeeds. Every existing assertion remains intact.

## Final local execution

- `npm run check`: TypeScript/build and **250/250 unit tests passed**, zero failed.
- `tests/flow-scale-locale-db.mjs`: **3/3** PostgreSQL large-graph, language and isolation scenarios passed.
- `CI_DB_INTEGRATION=1 node tests/db-integration.mjs`: cross-tenant read/update/insert denial and RLS/FORCE flag checks passed.
- `tests/bots-db.mjs`: independent bots, optimistic revision conflicts, tenant/role boundaries, pinned runtime, routing and associated CRM/team/campaign checks passed.
- **Unmodified historical assertions** in `tests/visual-rebuild-browser.mjs`: **19/19** grouped scenarios passed. Includes 500-node storage/reload, 499 connections, mobile Basic, desktop manager navigation, real blank-bot UI authoring, three destinations, gallery, input, condition, handoff, save/reopen and shared-engine simulation. No page errors.
- `tests/hybrid-approved-browser.mjs`: **11/11** grouped scenarios passed, covering view switching, insertion/editing/duplication/history/delete, independent bots, saved draft roundtrip, server preview, mobile layout and real manager-return-preview roundtrip.
- The original four-part persistent-profile recovery scenario passed: closed tab, browser restart, cross-tab backup/autosave/409 protection and logout cleanup. [Actual recovery evidence](../../evidence/hybrid-pr7-final-2026-10-22/recovery/).
- Production Node22/Alpine multi-stage Docker build passed. Image: `sha256:cc5b51d56da94ce662237d86ec33344a595c1fd6a9b3f5803fbb166bb66306e4`. Its actual packaged API/web passed real database health, authentication, bot API and four builder-asset requests. The ephemeral proxy CA mount preserves TLS and checksum verification; no secrets or session CA were baked into the image.

Database checks use the existing migrations on the isolated `elhafez_ci` fixture, never production. No database schema or lockfile changed. These final runs supplement the prior premium 29-browser-check and 183-contrast-pair evidence; the full GitHub workflow runs all historical suites, backup/restore, Docker and isolated Compose separately.

## Visual and interaction review

[Updated side-by-side reference comparison](VISUAL-COMPARISON.md) uses actual final-source authenticated screenshots at the same 1490×940 size as the supplied approved reference. The source checksum remains verified. The production UI retains the approved open Canvas, left searchable grouped library, compact message cards/ports, Basic sequence, contextual insertion/destination editing and the real shared preview dock.

[Full final historical Chromium evidence](../../evidence/hybrid-pr7-final-2026-10-22/visual/) includes message/button/gallery/condition editors, desktop/mobile Canvas, real preview and UI-authored bot. Specifically:

- [500-step Basic after mobile → desktop, with visible Arabic manager control](../../evidence/hybrid-pr7-final-2026-10-22/visual/21-basic-500-desktop-navigation.png)
- [Actual bot manager reached through that control](../../evidence/hybrid-pr7-final-2026-10-22/visual/22-bot-manager-navigation.png)
- [Bot authored entirely through visible controls](../../evidence/hybrid-pr7-final-2026-10-22/visual/12-authored-tourism-workspace.png)
- [Preview preserved after leaving/reopening the bot](../../evidence/hybrid-approved-2026-10-22/12-manager-return-preview.png)
- [That bot's real server-backed conversation](../../evidence/hybrid-pr7-final-2026-10-22/visual/11-authored-tourism-preview.png)

[Manifest and command logs](../../evidence/hybrid-pr7-final-2026-10-22/) bind final source hashes and screenshots. No standalone prototype image is labelled implementation evidence.

## Exact-HEAD CI receipt

The final acceptance receipt is posted on PR #7 **after** both push and pull-request `Verify` workflow runs finish for the exact delivery HEAD. It records the complete SHA, both run URLs and job outcomes. This separate receipt avoids changing the commit while documenting its checks. Historical red runs remain visible and are not presented as current results. Do not infer a pass from an earlier SHA.

## Remaining differences and limits

No separate fake draft, interpreter or unsupported production component was introduced. The platform deliberately retains its real publishing/validation/history controls, channel capability information, semantic icons, advanced Inspector and safety messages; the approved prototype did not contain all of those. Thus content, some toolbar/card dimensions and the Inspector structure differ. No 100% pixel-parity, live-provider or physical-device qualification claim is made. Owner visual acceptance remains required; this task does not merge or deploy.
