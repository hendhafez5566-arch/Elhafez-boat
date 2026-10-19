# Elhafez Boat — Codex product rebuild handoff (19 October 2026)

**Owner outcome:** Rebuild the Arabic-first general-purpose chatbot SaaS into an easy-to-use, commercially credible product. User-provided BotSailor screenshots/video and the Manychat benchmark are **references to interaction patterns**, not copyrighted product assets to copy or proof of integration functionality.

## Start here, in order
1. `AGENTS.md` and `docs/00-SCOPE-CHATBOT-ONLY.md` (current product/business guardrails).
2. `docs/product-rebuild/CODEX_INSTRUCTIONS.md` — exact execution mandate.
3. `docs/product-rebuild/PRODUCT_ARCHITECTURE.md` — actual product gap and migration safety.
4. `docs/product-rebuild/SCREEN_MATRIX.md` — all 22 screens and priority.
5. `docs/product-rebuild/QUALITY_GATES.md` — real testing and release gates.
6. `docs/product-rebuild/EVIDENCE_INDEX.md` — user screenshot/video evidence, what is/was verified, links to older audits.
7. Existing source + audit: `docs/35-DEEP-UI-UX-REBUILD-2026-10-19.md`, `docs/UI-AUDIT-FIX-2026-10-19.md`, `docs/29-PREMIUM-UI-REBUILD.md`, `project-management/CURRENT-STATUS.md`, `REMAINING.md`, `HANDOVER.md`.

**IMPORTANT:** This documentation is a handoff, NOT an implemented feature or deployed redesign. The currently published UI before the new rebuild is on `feat/stage0-foundation` at `ada4db6764c8ee8665764663b3a47351cf807637` (verify actual HEAD). This branch `docs/codex-product-rebuild-2026-10-19` contains reference documents only. **Work from this branch and make a NEW isolated implementation branch** or use an explicitly agreed handoff policy, targeting `feat/stage0-foundation` via ONE draft PR. No production deployment, no merge, no third-party connection without explicit owner permission.

## Why this rebuild is different
Older PR #2/#3 addressed specific 15 functional QA and 26 visual observations, with CI/Chromium checks; owner still found the product **confusing, poor, technical and uncompetitive** after shipping. Do not repeat cosmetic CSS patches and mistake green CI for UX acceptance. User's benchmark shows distinct bot/account selection, contextual tools, full-canvas editor, progressive disclosure and uncomplicated Arabic setup.

## Security/rights of references
Repository is PUBLIC. Raw owner-provided BotSailor screenshots/video, private workspace screenshots/ZIP files, and embedded audited screenshots are intentionally not copied verbatim to GitHub because of visible account names/phone numbers and possible private data. A sanitized reduced-resolution layout sheet is included if upload succeeds; `EVIDENCE_INDEX.md` contains detailed observation/storyboard and official reference links. Ask the owner for original private source ZIP/video only if higher resolution is essential, and review through authorized private channels. Do not commit raw credentials, customer contacts or third-party logos into the shipping app.

## Direct visual references

- [Bot workspace layout diagram](diagrams/bot-workspace-IA.svg)
- [Target flow-builder layout diagram](diagrams/builder-target-wireframe.svg)
