## 2026-10-21 — Canvas CI navigation repaired and exercised

Continues verified `8b08b38d6b9f44a1c60f8ab8f6c8ba32ba475da2`, same branch and Draft PR #5. Read both failed run jobs39627663985/39627652504 and actual logs: integrated test tried to click a hidden advanced-tools summary inside the closed operations dialog. Reproduced original Timeout in local Chromium against real isolated PostgreSQL/API. Reused existing named `studioClick` navigation to open the actual settings dialog before disclosure/action; no forced clicks or deleted assertions. Added persisted vertical alignment/distribution and two-Undo coordinate restoration assertions. All9 integrated Chromium checks now PASS, including horizontal layout, rectangle/group drag, collapse/search/path focus, actual widget/card/gallery and simulation. TypeScript/build246 units PASS;47 migrations,3 scale/RLS/bilingual PG and5 rich-content PG PASS. Remote full CI remains pending the correction push. Matrix30 PASS/6 PARTIAL retained. Next: verify this commit's Actions, finish reviewed visual refinements and refresh matched evidence; physical-device/screen-reader/provider/owner review remain open. No merge/deploy/customer send.


## Visual/interaction refinement checkpoint

- Expanded Canvas area through shared238/336px library/inspector tokens; reduced toolbar padding; improved library/card type/message readability while retaining286px graph geometry and original identity.
- Message/card creation actions now use scoped wrapping groups; cards have bounded fieldsets; explanatory copy is a separate readable block.
- Fixed mobile minimap rules being overridden by later desktop rules; actual390/768/1024 Zoom/Fit and overlap/overflow assertions pass. Added clear accessible names to Zoom controls and operations-dialog keyboard focus.
- Display/tools menu now links directly to existing selection arrangement tools.
- Real pointer-drag acceptance uncovered two history checkpoints per library drop and a rejected500-node drop potentially moving the current selection. Position is now passed into the existing addNode operation before its single checkpoint. Click addition and original handlers are preserved.
- Initial hidden Canvas rendering used zero-size cards and stale fallback port positions. A pending-geometry flag now remeasures once the Canvas becomes visible; measured endpoint regression passes and paths stay in the actual gaps. No layout, engine or database format changes.

Local:246 units/TS/build;28 existing premium Chromium checks;12 matched tourism/Canvas/mobile/large-graph checks;4 scale/LTR/pinch checks. Independent9 integrated rich/widget/selection checks also run. Current source remote full CI remains a separate gate. Before images preserved; After captures refreshed from authenticated real PostgreSQL/API/Chromium with the same logical11-node fixture, saved layout,Arabic100%,1440x1000 and390x844. Synthetic IDs differ from the previous session's disposable database; no same-ID claim across sessions.


## Recovery navigation correction after full CI

CI39633357324 on0ac38b4 passed the integrated Canvas suite, then exposed the same legacy disclosure assumption in flow-recovery-browser.mjs. It now reveals the actual named save setting through studio-navigation and closes the operations dialog before editing/saving. All original recovery assertions retained. Actual local7 request-operations PG cases,6 operations Chromium and4 persistent-profile restart/cross-tab/logout Chromium cases PASS. Full remote CI on this correction is pending. No application/data changes in this correction.

