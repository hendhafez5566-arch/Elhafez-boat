# Handover — Elhafez Boat, 2026-10-18

## Authoritative scope
General chatbot SaaS for ALL businesses. No internal reservations, travelers, inventory, accounting, payments or fulfilment. Stay on `feat/stage0-foundation`, PR #1; no merge/commercial deploy.

## Actual execution checkpoint
Baseline `3f28a2df03174288947e9ed255c1eb41dde43cd5`.
Source implementation: https://github.com/hendhafez5566-arch/Elhafez-boat/commit/e38fbdb0f7b20769b8746a441eb839b8ca333506
Read CURRENT-STATUS.md and REMAINING.md before continuing. This delivery is intentionally NOT marked feature complete.

## Important source locations
- `flow-engine.ts`: deterministic graph schema/validation, draft topology option, canvas layout, QUESTION/KEYWORD and pending async-node execution.
- `flow-service.ts`: draft/publication/rollback, version-pinned sessions, dynamic catalog/AI/webhook resolution and preview dry-run flag. Never remove dry-run suppression of outbound webhook side effects.
- `catalog.ts`, migration 0016: missing files restored; approved informational items only.
- `ai.ts`, migration 0017: tenant AI settings, quota, approved source selection/extraction, source audit and fallback. AI provider never supplies factual business response text directly.
- `inbox.ts`, migration 0018: saved replies and notes; whatsapp.ts adds read markers/filter fields and closure.
- `integrations.ts`, migration 0019: exact environment host allowlist, DNS validation, pinned IPv4 HTTPS, no redirect, queue/retry/audit and optional HMAC. Idempotency header requires receiver support.
- `templates.ts`, migration 0020: scheduled individual static templates; worker checks consent/window/subscription at dispatch. No campaigns.
- `access-keys.ts`, migration 0021: hashed scoped read keys, routing digest table and revocation.
- `flow-canvas.js`/`flow-builder.js`: canvas + existing properties UI; authenticated preview uses shared server interpreter. Demo is labelled, browser-only and has reduced node simulation.
- server.ts: active old tourism route families return 410. Historical SQL migrations are untouched; dormant old modules/HTML still need cleanup.
- tests/generic-flow.test.mjs: new regression coverage prepared. tests/db-integration.mjs now contains actual PostgreSQL RLS checks instead of an invalid reference-error sentence.

## Evidence and constraints
Local build/TypeScript, changed JS syntax, static HTTP serving and git whitespace checks passed. No local unit/DB/browser/provider/performance/restore acceptance executed. PostgreSQL/Docker and live credentials absent; Chromium download failed. Existing CI ran on e38fbdb: 34/38 passed, all nine new regressions passed; four failures in unchanged legacy services. Migration/RLS steps skipped. Run 39070131242 is FAILURE; do not report green CI.

Direct git push lacks credentials in the shell. Source was uploaded through GitHub Git-data connector, with the created remote tree SHA checked equal to the local code tree. Never force over an unexpected branch head.

Startup: docs/11-LOCAL-SETUP.md. Finish remaining approved build scope, then ONE comprehensive acceptance campaign. No claims of live WhatsApp, AI, website chat or commercial readiness without evidence.
