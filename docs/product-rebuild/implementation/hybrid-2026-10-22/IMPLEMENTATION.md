> Continuation on 22 October: the authentic approved HTML is now supplied and checksum-verified. The responsive shared simulator dock and contextual Basic/Canvas workspace are implemented on `feat/approved-hybrid-ui`. See [current implementation, evidence and remaining qualification](../hybrid-approved-2026-10-22/REVIEW.md). The first-slice statements below describe historical PR #6, not the current continuation. No claim of full pixel parity or owner approval.

# Elhafez Boat — approved BotSailor × Manychat hybrid integration

Date: 22 October 2026. Branch: `feat/hybrid-builder-approved-2026-10-22`. Draft PR: #6.

## Owner-approved source of truth

The owner approved **Elhafez_Hybrid_BotSailor_Manychat_Interactive.html** in this project conversation (SHA-256 `9fbca0448e1e0a07f6c5dc6b1008b324bd8de6f7fc787c9cf5fa0328547d0b1b`). This source file is a standalone visual/interaction prototype, **not** working backend code. The separately approved BotSailor-inspired concept and screenshots are visual references only; no source-code copying from competitors.

**Required experience, not only restyling:** advanced visual graph with connection-aware insertion and BotSailor-style palette; beginner-friendly sequential editor and templates inspired by Manychat; editing via existing source Inspector; true shared-engine conversation simulator; responsive mobile.

## First implemented vertical slice

- `apps/web/public/flow-basic-builder.js`: new, accessible guided timeline that traverses real flow graphs from `startId` using the existing `graphOutputs`, avoids infinite cycles, flags unreachable nodes, and renders node-specific content and branch destinations.
- `apps/web/public/flow-builder.js`: wires guided mode to the **single authoritative in-memory flow draft**, real Editor, insertion dialog, activity templates, Simulator and Canvas. No duplicated save state, persisted contract, API or interpreter.
- `apps/web/public/flow-builder.css`: responsive beginner-mode layout, task-first cards, semantic type identity, route actions and readable Arabic typography. Existing advanced mode remains intact.
- `apps/web/server.mjs`: explicitly allowlists the new ES module so the real authenticated app can load, without widening the public asset surface.
- New Node tests for read-only cycles/delegation and asset/syntax checks, plus authenticated Chromium scenario in `tests/premium-builder-browser.mjs` with desktop/mobile screenshots and draft roundtrip invariant.

## Non-negotiable guards

1. Do **not** copy the standalone HTML fake persistence/interpreter into production. Both views must always display and mutate the same already-secured draft and call the same existing save/publish flows.
2. No live WhatsApp/Meta/AI provider activation, deployment, messages or repository merges in this PR.
3. Templates must use the existing replacement confirmation. Duplicated/unsupported nodes may be displayed but must not bypass real engine/channel validation.
4. Existing 30 PASS and six PARTIAL qualification statements are unchanged pending independent feature acceptance.
5. A screenshot from the standalone HTML is **not** evidence of a production integrated interface. Only authenticated actual Chromium images of this branch establish UI execution.

## Acceptance and remaining parity

### First-slice acceptance
- [x] Guided mode has a real linked step timeline with condition and choice routes.
- [x] Editing/adding/scenario preview reuse the current production UI callbacks.
- [x] Returning to visual mode uses the current graph rather than re-importing JSON.
- [x] Unit and smoke integration checks added.
- [ ] Latest commit full PostgreSQL/Chromium CI green.
- [ ] Owner review of actual integrated screenshots.
- [ ] Authenticating and saving a new flow via the beginner UI, including branch creation, confirmed by the main workflow.

### Still not delivered by the first slice
- Persistent side-by-side chat simulator (current shared simulator opens as a modal).
- Complete editor equivalence with approved standalone styling and all block card variants.
- Fully qualified mobile touch usability and accessibility on physical devices.
- All advanced tools documented in the hybrid spec integrated into one product-wide navigation; no redesign of other product areas.

Keep the PR **Draft** and do not claim visual/functional completion until evidence passes both independent checks and owner approval.
