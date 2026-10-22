# Test and release gates — independent proof, not cosmetic CI

## Baseline
- Read repository `AGENTS.md`, exact base HEAD, latest CI and current schema/migration baseline.
- Current Railway production points to `feat/stage0-foundation`; branch `docs/codex-product-rebuild-2026-10-19` is **docs-only**. Create a new implementation branch based on it, one Draft PR targeting `feat/stage0-foundation`. Do not merge/deploy without owner consent.
- Disposable tenant fixtures and isolated PostgreSQL. No actual Meta OAuth/WhatsApp send, no paid AI calls, no production messages.

## Data integrity and multi-bot
- Tenant A: bot-1 + bot-2, different draft/publish config; editing and publishing bot-1 cannot alter bot-2.
- Tenant B cannot read/write tenant A bots, media/knowledge references or routing.
- Migrate existing tenant-only draft and ALL published versions to one deterministic legacy bot preserving step IDs/content/revisions; idempotent re-run and dry-run test.
- Route each inbound event to the correct connected channel/account/bot; ambiguous route yields a controlled error not random bot selection.
- Server-side owner/manager/agent/viewer and SaaS admin checks, origin/CSRF/cookie, secrets, webhook signatures, no actual contacts copied to test DB.
- Existing basic owner registration/inbox/flow and backup/restore smoke must still pass.

## Real novice journey
First login → create bot → choose Arabic template → write welcoming text → three button outputs → collect name + phone → branch → assign to staff → simulate → save draft → refresh browser → verify same bot + state → permitted sandbox publish → edit different bot → verify first bot unchanged.

## Canvas-specific
Click Start output, show appropriate component picker; Text/Buttons/List/Row inspector; connect branch output to distinct nodes; keyboard/mouse drag; delete/undo/redo; pan/zoom, long graph focusing; test reusable simple view with identical data. No lost choice IDs or routes on compatible type changes. Concurrent draft conflict offers safe backup and comparison, never silent overwrite. Publish blocks dangling invalid branch edges.

## Browser/mobile evidence
Actual Chromium/browser interaction at 1366×900, 768×1024, 390×844, 320×700 and zoom 200%, screenshots **from Elhafez Boat**, before/after per important page. Check unintended horizontal overflow, Arabic clipped select, disabled/working buttons, empty/error/loading, modal keyboard focus/Escape, hamburger and drawers, search/pagination, simulator scroll, human handoff control. Green CI alone is NOT acceptance of owner-perceived ease.

## Delivery evidence
For each S01–S22: source commit/file, function+API test result, browser screenshot path, PASS/FAIL/NOT_RUN and blocker; keep `project-management/CURRENT-STATUS.md`, `HANDOVER.md`, `REMAINING.md` and CHANGELOG accurate.

**Release gate:** tested latest SHA, multi-bot migration rollback proof, actual UI acceptance by owner, verified privacy & permissions, no secretly enabled provider, owner explicitly requests merge/deploy. No production Railway operation in this handoff.
