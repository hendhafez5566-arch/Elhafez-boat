# CURRENT STATUS — General-purpose chatbot SaaS (2026-10-17)

**Owner's newest decision:** Elhafez Boat is a configurable chatbot-building SaaS for **ALL industries**, not a tourism-specific tool. It is still **NOT** an ERP or booking/accounting application. Scope: `docs/00-SCOPE-CHATBOT-ONLY.md`, which supersedes older tourism instructions.

Repository: `hendhafez5566-arch/Elhafez-boat` PUBLIC by choice; branch `feat/stage0-foundation`; DRAFT PR #1, not merged, not deployed.

## Generic feature code written on branch
- `apps/api/src/flow-engine.ts`: industry-neutral flow definition, validation, deterministic interpreter with nodes for START, TEXT, BUTTONS (max 3), LIST (max 10), INPUT/custom field, CONDITION, TAG, MEDIA (image/video/audio/document over HTTPS), LINK, HANDOFF, END. Validates IDs/destinations, reachable blocks and automatic loops.
- `apps/api/src/flow-service.ts`: tenant draft, published versioning, version-pinned conversation state, choice ID validation, saved answers/tags, human-handoff leads; default general preset when no flow is published. Actual WhatsApp signed webhook calls this service; legacy tourism-specific fallback is presently unreachable code to clean up.
- `packages/database/migrations/0015_generic_flows.sql`: tenant-isolated drafts, immutable published versions, conversation snapshots and lead custom fields.
- `apps/web/public/flow-builder.js`, `flow-builder.css`: visual block-list and per-node editor (NOT drag-and-drop yet), options, links, preview and save/publish; accessed from company's dashboard.
- `packages/database/migrations/0016_generic_catalog.sql` and `apps/api/src/catalog.ts`: arbitrary company products/services/offers, custom categories, description, advertised price text and links; draft/publish/archive. Not inventory or a purchase engine.
- Catalog responses match approved, published full item titles in customer text and offer direct interest/handoff, no invented facts.
- Staff inbox/qualified leads include dynamic custom answers; company UI nav now shows generic catalog and flow builder instead of tourism-only catalog. Old unsupported travel UI source remains dormant/historical.
- Presets for general business, shop, restaurant, clinic, real estate, education and tourism (as ONE example).
- Existing Meta signed webhook, outbox worker, basic team inbox/roles, customer consent and opt-out remain in development code.

## Verification honesty
Files committed through GitHub connector. Development-time isolated TypeScript/JavaScript syntax safeguards run on new engine/editor source; **NO clean checkout of the integrated repo, full database migration 0015–0016, live Meta sandbox, authenticated browser E2E or full acceptance has been executed**. No credentials or live customer messages.

## Important limitations / not done
- Card-style builder works with editable connections; **free canvas drag-and-drop has NOT been built**.
- No scheduled sequence builder, omnichannel live connectors, contact segmentation-based campaigns, full approved media template/carousel support or external safe API/Webhook workflow node yet.
- No true grounded LLM; published FAQ plus deterministic flows and exact approved catalog match only.
- Generic catalog currently supports approved text replies, not an auto-populated list node in published flows; company can manually author LIST choices.
- Many legacy reservation/inventory/finance modules remain in git history and some dead source. Don't revive them; safely retire before release.
- Need clean build with dependency lockfile and user-selected Meta business account setup after feature scope completed.

**Owner testing policy:** one final formal acceptance phase AFTER features are finished. No production-readiness claim now.
