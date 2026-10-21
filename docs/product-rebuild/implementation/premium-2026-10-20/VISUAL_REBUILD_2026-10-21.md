# Premium visual rebuild — 21 October 2026

Continues verified remote HEAD `2f0f77c52abe1dc298b968ca71f8644e3b2e10a4`, same `feat/premium-flow-builder-2026-10-20` / Draft PR #5. No runtime, schema, migration or provider code changes.

## Integrated A–D implementation

- Compact studio header; mounted secondary operations moved into one named, keyboard-accessible dialog. Existing readiness/review/diagnostic/experiment/consent/request controls remain original objects with their original handlers.
- Persistent desktop component library: 27 components, three task groups, SVG icons, descriptions, search/empty state, click and drag. Search includes advanced types and English IDs. Explicit mobile close; narrow-view transition dismisses the drawer without intercepting canvas gestures.
- Shared semantic icon/tone metadata for library and canvas cards, functional titles, readable message summaries, selected/hover/focus actions, measured ports and original edge management retained.
- Content-first inspector; existing advanced/type/bilingual/error controls are relocated, never recreated or removed. Optional message preview, character count, bounded plain-text emoji/token insertion and searchable authored variable picker; existing caret-aware context suggestions retained.
- Conversation preview and technical lab occupy independent surfaces. Existing shared-engine preview, channel selection, Mock persona/clock/event/delivery/replay and technical traces remain available. No external sends.
- Original flow-builder stylesheet consolidated through Chromium CSSOM, merging 26 repeated selectors; responsive and focus states retained. No extra stylesheet layered on top.

## Verification at first checkpoint

`npm run check`: TypeScript + build + **246 unit tests PASS**. `node --check` edited modules PASS. 46 migrations apply on a new local PostgreSQL16 database; three scale/localization PostgreSQL scenarios PASS, including 200/500 actual saved/published definitions, pinned old sessions, atomic501 rejection and tenant/RLS isolation. Existing scale/localization Chromium suite: **4 PASS**, covering 200/500 save/reopen,24 text edits,120 pans, keyboard zoom, LTR and emulated two-finger pinch. Physical device/screen-reader acceptance remains separate.

Matched authentic baseline images now captured from original HEAD web source against real authenticated API/PostgreSQL: 11-node tourism scenario with unchanged layout, Arabic,100% zoom,1440×1000; mobile390×844; separate500-node scene at a fixed repeated zoom. No generated images. Initial isolated presentation captures are retained under package-a/b/c/d as intermediate evidence, not runtime evidence.

After screenshots and deeper interaction regression are still in progress at this checkpoint. No blanket claim that all30 prior PASS contracts have been requalified.

## Reference review

Read repository BotSailor reports and inspected original masked screenshot003 (expanded categorized palette) and016 (12-node overview). Adopted categorized search, quiet build space and task-specific editing while keeping original Vessel purple identity and original icon artwork. The ZIP became available after Git fetch recovered. Official Manychat help URL attempted: `https://help.manychat.com/hc/en-us/articles/14281195087516-Flow-Builder-overview`; proxy rejected CONNECT with403. No fresh Manychat UI observation is claimed.

## Exact continuation

Finish matched After/interaction regression, review desktop/mobile screenshots, run remaining affected browser suites and inspect latest GitHub CI. Keep F01/F32 PARTIAL; providers/physical devices/owner visual acceptance remain explicit. No merge, Railway deployment, real provider account activation or customer message.
