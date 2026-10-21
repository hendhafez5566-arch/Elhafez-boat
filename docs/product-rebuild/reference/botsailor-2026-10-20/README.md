# ELHAFEZ BOAT — Flow Builder premium rebuild / BotSailor 2026 benchmark

**Reference date:** 20 October 2026. **Status:** reference materials only; no product code has been changed by this handoff.

## Start here (Codex)

1. [CODEX_HANDOFF_REVIEW.md](CODEX_HANDOFF_REVIEW.md): controlling handoff, scope, conflict-resolution, preservation and acceptance.
2. [FLOW_BUILDER_PARITY_F01_F36.md](FLOW_BUILDER_PARITY_F01_F36.md): **AUTHORITATIVE F01–F36 requirement IDs** from the original source review.
3. [CODEX_IMPLEMENTATION_SPEC_FROM_WORK.md](CODEX_IMPLEMENTATION_SPEC_FROM_WORK.md): original full Work implementation proposal. Treat its suggested data model and palette as candidates, not approved code/data migration.
4. [BOTSAILOR_ORIGINAL_AUDIT_REPORTS.md](BOTSAILOR_ORIGINAL_AUDIT_REPORTS.md): unabridged consolidation of the original BotSailor audit Markdown reports, including direct evidence observations, UX, feature matrix, recovery findings, source links and acceptance tests.
5. [FLOW_BUILDER_DEEP_AUDIT.md](FLOW_BUILDER_DEEP_AUDIT.md): individual flow editor observational report.
6. [ELHAFEZ_PRODUCT_UX_CODE_AUDIT.md](ELHAFEZ_PRODUCT_UX_CODE_AUDIT.md): prior code-based UX assessment; **not** browser acceptance on the deployed platform.
7. [BOTSAILOR_EVIDENCE_REDACTED.zip](BOTSAILOR_EVIDENCE_REDACTED.zip): ZIP containing original audit documents and **32 selected screenshots** from the browser test with account-label areas masked. Excludes 7 duplicative 500-error page images, the login screenshot, and the first 500-flow screenshot. The combined Markdown refers to some excluded image IDs; those are preserved as textual observations, not image proofs.

## Required priority and source-of-truth rules

- Keep F01–F36 from **FLOW_BUILDER_PARITY_F01_F36.md** as canonical keys. The 36-item competitor table in the Work ZIP has a **different ID scheme**. Map it into F01–F36 using a crosswalk; do not silently equate numbers.
- A01–A51 are **proposed future acceptance scenarios**, NOT 51 passing tests. A01–A43 concern the builder; A44–A51 concern broader SaaS.
- BotSailor audit symbols: **T** action and outcome tested in account; **V** visual UI only; **D** public docs only; **B** blocked; **U** not verified; **P** new design idea.
- The BotSailor audit tested a 12-node/11-edge draft, but following a server error only 10 nodes/9 edges reopened. Investigate resilience; don't claim the root cause of BotSailor's save failure.
- Original comparison with authenticated Elhafez user UI was **not performed**. Baseline the CURRENT Elhafez code and carry out real Chromium acceptance on our version.

## Mandatory product goals

- Professional no-code canvas: zoom to cursor, visible zoom %, smooth pan/touch, minimap, fit and focus, durable layout, graph search, grouping and fast keyboard editing.
- Graph edge management: drag-to-connect with visible preview, disconnect, delete/select/reconnect edges, inserting a node from a free output, routing and spatial layout without overlaps.
- Blocks and UX: beautiful premium cards/ports/arrows, Arabic RTL, consistent product visual identity and iconography; elegant component library, rich message editor, properties and phone-like preview.
- Logic and runtime: typed customer input, robust validations and retry/timeout/skip, compound conditions, variables, customer attributes, triggers/actions, handoff/pause/resume, fallbacks, schedules/consent, smart delays and safe integrations.
- Recovery and releases: correct drafts, optimistic revision conflict 409, undo/redo, safe autosave and retries, versioning, no silent data loss, deterministic simulator (trace/variables) and pre-publish validations.
- Preserve existing multitenancy, permissions, saved bots and previous published versions, real message engine and channel limitations. Never fake live provider support, AI approval or live message delivery.
- Test actual UX and code (real PostgreSQL/API/Chromium) including 390/768/1024/1440 viewports, zoom up to browser 200%, 50/100-node large graphs, one/two editing sessions, dropped network, save conflict, errors and visual screenshots.

## Constraints and branch strategy

- Repository: `hendhafez5566-arch/Elhafez-boat`.
- Handoff documentation branch: `docs/botsailor-flow-builder-handoff-2026-10-20` based on staging `feat/stage0-foundation` at `cc702b795f1c7aa0d0b75fec6655574f4f2ec57b`.
- The staging branch has Railway auto-deployment. **Do not merge docs/implementation to staging or `main` and do not publish or execute provider actions** without a separate owner approval. Prefer one feature branch derived from this documentation branch and a **draft PR targeting staging** for review.
- Read `AGENTS.md`, current quality gates, status/handover and every existing flow engine/editor/provider adapter before editing. If present-day HEAD has progressed, rebase/reconcile safely; never force-push.
- Premium appearance matters as much as function; no series of cosmetic CSS overrides. Preserve the product's existing Vessel identity unless the owner approves a new visual identity.
- The evidence ZIP includes screenshots of a THIRD-PARTY PRODUCT provided for reference. Don't reuse competitors' copyrighted branding/artwork in the shipped UI.
