# Premium Flow Studio — implementation and acceptance

This is a substantial **incomplete** implementation batch, not certification of F01–F36 parity. Canonical requirements remain the handoff's `FLOW_BUILDER_PARITY_F01_F36.md`. No merge, Railway deployment, real provider account, campaign launch or real customer delivery occurred.

## Continuation from a4ced99 — durable runtime and advanced authoring

Continued on the existing branch and Draft [PR #5](https://github.com/hendhafez5566-arch/Elhafez-boat/pull/5), with remote HEAD verified as `a4ced99ee3bbf7e4f2dd8448c19bfb27887607ca` before editing. Target remained `cc702b795f1c7aa0d0b75fec6655574f4f2ec57b`.

This batch implements saved input/choice policies (attempt limits, fallback, optional skip and no-reply deadlines), UUID wait tokens and real worker continuation. Invalid replies preserve the deadline. Expired replies take the timeout path. A stale worker cannot resume a later visit to the same question. Database/application clock differences requeue premature jobs. Runtime counters/experiments are stored separately from answers.

Advanced authoring adds recursive AND/OR groups, date/tag/membership operators, nine typed variable kinds and contact/session scopes, inline START triggers committed only at publication, remove-tag and actual CRM stage/tenant-member assignment, smart date/field/business-hours schedules, sticky weighted branches and explicit goals. Session-scoped values stay out of CRM, including manual human-keyword handoff. Pinned subflows remap the new fields and ports without changing published source definitions.

Five-channel capability checks gate URL button combinations at publication and execution. URL actions render as website anchors, Telegram URL buttons, Messenger web URLs and single WhatsApp CTA URLs. Structural/channel preflight returns errors/warnings with node navigation; full provider readiness remains separate. Real transition outcomes/timings are persisted in an RLS table and exposed through tenant/bot/version analytics; simulator requests write no events.

Safe provider-dependent internals are explicit **MOCK / Sandbox**. Draft generation and text suggestions require review/accept/reject and use the existing draft/Undo path. Output is deterministic local template/whitespace work, not AI. Multi-screen form drafts have a bounded internal schema, required/email local validation and ordinary JSON/draft roundtrip. They are **not Meta Flow JSON, linked provider assets, or approved WhatsApp forms**.

Current canonical status: **5 PASS / 31 PARTIAL**. F08/F09 meet their stated criteria; F24/F29/F30 move from wholly blocked to partial internal implementation, with external provider portions still blocked. Remaining requirements are listed per row in [F01-F36.md](F01-F36.md).

## Branch and compatibility

- Started from the confirmed remote handoff HEAD `9196603a5955f91ae27c15641741298ebcd0073c`. Staging remained `cc702b795f1c7aa0d0b75fec6655574f4f2ec57b` when rechecked.
- Implementation branch: `feat/premium-flow-builder-2026-10-20`; Draft PR targets `feat/stage0-foundation` only.
- Preserved the existing `nodes` plus embedded `next/yes/no/choices[].next` contract. Canvas ports use stable **choice IDs**, not array offsets. The continuation adds migration `0033_flow_runtime_controls.sql`: default-empty session runtime state, nullable wait token and a tenant-scoped RLS transition-events table. Existing node IDs, answers, old delay jobs and immutable versions are preserved; there is no replacement graph store.
- Optional `INPUT.validation`, `CONDITION.rules/match`, `TEXT.blocks`, node `label/note`, and additive executable `SET_FIELD` / `RANDOMIZER` types. Existing definitions retain their IDs and legacy behavior. Published versions remain immutable and active sessions remain pinned through the existing service.
- Pinned subflow compilation remaps structured condition fields, variable tokens, field assignments and all weighted destinations. Parent/child isolation and expansion limits remain in force.
- Standard drafts remain capped at **100 nodes**; automatic execution allows 120 transitions so valid 100-node sequential graphs can execute. This does not promise support for 200/500-node authoring.

## Implemented source changes

Canvas navigation now has visible zoom percentage, 100%, fit, wheel pan, Ctrl/Command-wheel cursor zoom, background drag, Space/middle-button pan, minimap and graph search. Normal zoom is bounded at 10–200%; fit may reach 10% on large graphs. Text becomes small at fit: use search/focus to edit at 100%.

Connections have keyboard-focusable wide hit paths, selection controls, explicit disconnect, reconnect, self/output-target rejection, a live drag ghost, Escape cancellation, and contextual component insertion. Selection supports Shift and a background rectangle, group movement, internal copy/paste with new IDs and internal links only, duplicate/delete, alignment/distribution and snapped dragging. Graph layouts no longer silently rearrange saved positions when selecting/rendering. Line paths follow movement and finalize after release.

The studio stylesheet replaces the accumulated builder layers in `vessel.css`; the builder now owns its canvas/palette/inspector/simulator and responsive rules. It retains the Vessel violet identity. Nodes have consistent SVG icons, ports, selected states and labels. Desktop properties dock beside the canvas; mobile properties occupy a separate panel. Opening properties no longer focuses or rescales the camera.

The existing rich editor now supports ordered additional text, HTTPS media and link content on a legacy TEXT node. Existing button/list/media editing is retained. Questions add explicit phone/email/number/text/date/zoned-datetime/coordinate validation, bounds and error messages. Invalid input preserves prior answers. Nested AND/OR rules support text, existence, numeric, date, membership and tag comparisons. Field assignments support bounded `{{field}}` references; weighted random branches validate a 100% total. Simulation uses the real engine, displays trace and synthetic values, highlights the current step, and mocks AI rather than contacting a provider. Internal notes never enter messages.

Saving now captures an immutable request snapshot: an old acknowledgment cannot overwrite later edits or mark them clean. Saving, failure and conflict status remain visible; local session recovery is scoped by tenant/user/bot. Recovery is offered explicitly on reload and removed on logout. Optional debounced autosave is off by default. Existing 409 merge review, immutable releases, import inspection and rollback are retained.

## Verification and evidence

Commands, actual outcomes and limits: [TESTS.md](TESTS.md). Canonical status and competitor crosswalk: [F01-F36.md](F01-F36.md). Future acceptance scenario status: [A01-A43.md](A01-A43.md).

Real Chromium screenshots (synthetic isolated fixtures):

- [Tourism canvas](../../evidence/premium-2026-10-20/tourism-canvas.png)
- [Compound condition inspector](../../evidence/premium-2026-10-20/compound-inspector.png)
- [Simulator trace and values](../../evidence/premium-2026-10-20/simulator-trace.png)
- [Composite message editor](../../evidence/premium-2026-10-20/composite-message-editor.png)
- [Weighted branch editor](../../evidence/premium-2026-10-20/weighted-randomizer-editor.png)
- [Revision conflict](../../evidence/premium-2026-10-20/revision-conflict.png)
- [100-node navigation](../../evidence/premium-2026-10-20/canvas-100-nodes.png)
- [1440](../../evidence/premium-2026-10-20/studio-1440.png), [1024](../../evidence/premium-2026-10-20/studio-1024.png), [768](../../evidence/premium-2026-10-20/studio-768.png), [390](../../evidence/premium-2026-10-20/studio-390.png), [CSS zoom 200%](../../evidence/premium-2026-10-20/studio-200-percent.png)

## Continuation screenshots

Actual Chromium captures from the updated application and synthetic fixtures:

- [Durable input policies](../../evidence/continuation-2026-10-20/durable-input-inspector.png)
- [Timeout simulator and trace](../../evidence/continuation-2026-10-20/durable-timeout-simulator.png)
- [Nested conditions](../../evidence/continuation-2026-10-20/nested-condition-inspector.png)
- [START draft triggers](../../evidence/continuation-2026-10-20/draft-trigger-inspector.png)
- [Text proposal review](../../evidence/continuation-2026-10-20/mock-text-review.png)
- [Multi-screen form draft](../../evidence/continuation-2026-10-20/multiscreen-form-draft.png) and [local sandbox](../../evidence/continuation-2026-10-20/multiscreen-form-sandbox.png)
- [Mock draft review](../../evidence/continuation-2026-10-20/mock-draft-review.png)
- [Desktop](../../evidence/continuation-2026-10-20/studio-1440.png), [mobile](../../evidence/continuation-2026-10-20/studio-390.png), [CSS 200%](../../evidence/continuation-2026-10-20/studio-200-percent.png)

## Remaining implementation

Integration response mapping/request controls with asynchronous timeout/429/error flow routes; composite button/card/gallery/carousel nodes; broader channel/event triggers and full channel-native presentation/readiness; consent actions/metadata; configurable human availability/pause/resume policies; customer-derived timezones and closed calendars longer than eight days; experiment attribution/funnel overlays/abandonment; ordered per-session failure/correlation exploration; review/comment threads; external-reference remapping; group folding and pinch; physical devices/screen readers/actual browser-UI 200% and sustained memory profiling; durable recovery after closing the tab/browser and cross-tab lease/idempotency. Actual AI generation/rewriting and Meta multi-screen form compilation/reference/approval/live qualification remain external and implementation dependencies.
