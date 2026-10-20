# Premium Flow Studio — implementation and acceptance

This is a substantial **incomplete** implementation batch, not certification of F01–F36 parity. Canonical requirements remain the handoff's `FLOW_BUILDER_PARITY_F01_F36.md`. No merge, Railway deployment, real provider account, campaign launch or real customer delivery occurred.

## Branch and compatibility

- Started from the confirmed remote handoff HEAD `9196603a5955f91ae27c15641741298ebcd0073c`. Staging remained `cc702b795f1c7aa0d0b75fec6655574f4f2ec57b` when rechecked.
- Implementation branch: `feat/premium-flow-builder-2026-10-20`; Draft PR targets `feat/stage0-foundation` only.
- Preserved the existing `nodes` plus embedded `next/yes/no/choices[].next` contract. Canvas ports use stable **choice IDs**, not array offsets. No database migration or replacement graph store.
- Optional `INPUT.validation`, `CONDITION.rules/match`, `TEXT.blocks`, node `label/note`, and additive executable `SET_FIELD` / `RANDOMIZER` types. Existing definitions retain their IDs and legacy behavior. Published versions remain immutable and active sessions remain pinned through the existing service.
- Pinned subflow compilation remaps structured condition fields, variable tokens, field assignments and all weighted destinations. Parent/child isolation and expansion limits remain in force.
- Standard drafts remain capped at **100 nodes**; automatic execution allows 120 transitions so valid 100-node sequential graphs can execute. This does not promise support for 200/500-node authoring.

## Implemented source changes

Canvas navigation now has visible zoom percentage, 100%, fit, wheel pan, Ctrl/Command-wheel cursor zoom, background drag, Space/middle-button pan, minimap and graph search. Normal zoom is bounded at 10–200%; fit may reach 10% on large graphs. Text becomes small at fit: use search/focus to edit at 100%.

Connections have keyboard-focusable wide hit paths, selection controls, explicit disconnect, reconnect, self/output-target rejection, a live drag ghost, Escape cancellation, and contextual component insertion. Selection supports Shift and a background rectangle, group movement, internal copy/paste with new IDs and internal links only, duplicate/delete, alignment/distribution and snapped dragging. Graph layouts no longer silently rearrange saved positions when selecting/rendering. Line paths follow movement and finalize after release.

The studio stylesheet replaces the accumulated builder layers in `vessel.css`; the builder now owns its canvas/palette/inspector/simulator and responsive rules. It retains the Vessel violet identity. Nodes have consistent SVG icons, ports, selected states and labels. Desktop properties dock beside the canvas; mobile properties occupy a separate panel. Opening properties no longer focuses or rescales the camera.

The existing rich editor now supports ordered additional text, HTTPS media and link content on a legacy TEXT node. Existing button/list/media editing is retained. Questions add explicit phone/email/number/text/date/zoned-datetime/coordinate validation, bounds and error messages. Invalid input preserves prior answers. Flat AND/OR rules support text, existence and numeric comparisons. Field assignments support bounded `{{field}}` references; weighted random branches validate a 100% total. Simulation uses the real engine, displays trace and synthetic values, highlights the current step, and mocks AI rather than contacting a provider. Internal notes never enter messages.

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

## Remaining implementation, not hypothetical risks

Full input retry/skip/no-reply scheduling and persisted error/timeout branches; compound date/tag/nested conditions; typed variable registry/autocomplete; inline START triggers; CRM remove-tag/assignment/stage actions; timezone-aware smart delays; persistent experiment allocation and conversion analytics; channel-specific capability preflight; multi-action/URL buttons inside the flow; galleries/carousels and WhatsApp Flows authoring; AI generation and text improvement; integration response mapping with error/timeout branches; collaborative review threads; production per-step trace and analytics; group folding; pinch gesture, screen-reader acceptance, actual browser-UI zoom 200%, and sustained memory/performance profiling. These are not certified by the screenshots or tests in this batch.
