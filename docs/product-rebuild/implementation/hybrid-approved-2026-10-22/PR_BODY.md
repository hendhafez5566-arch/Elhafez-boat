The approved hybrid reference previously had only a first Basic-mode slice in the platform: preview was modal-only and the library, header, cards and route editing retained the older presentation. This change integrates the approved workspace into the real shared draft, adds a responsive desktop dock for the existing server simulator, enables contextual Basic duplication/destination editing/insertion, and fixes unnecessary connection loops between nearby forward cards.

The engine, schema, lockfile, authentication, tenant boundaries and save/publish APIs are unchanged. No merge, Railway deployment, external account connection or real provider message is part of this delivery.

Validation: TypeScript/build and 250 unit tests pass; focused PostgreSQL bot/RLS/role checks pass; nine hybrid Chromium groups and three context-policy browser regressions pass; final production Node22/Alpine image builds and passes actual DB-health/login/bot-API/asset smoke checks. Screenshot manifest, original-reference comparison, exact commands and scope limits are in `docs/product-rebuild/implementation/hybrid-approved-2026-10-22/REVIEW.md`.

Keep this PR Draft. Owner visual approval, physical-device qualification, and broader historical/external acceptance remain pending; no 100% parity claim.
