# CURRENT STATUS — Elhafez Boat

Updated 2026-10-18 (Africa/Cairo). General-purpose chatbot SaaS for all businesses. No booking, accounting or fulfilment product.

**Status: substantial implementation delivered; NOT feature complete, NOT acceptance approved, NOT commercially ready.**

Branch `feat/stage0-foundation`, PR #1 remains unmerged. Verified starting GitHub HEAD: `3f28a2df03174288947e9ed255c1eb41dde43cd5`.
Implementation: https://github.com/hendhafez5566-arch/Elhafez-boat/commit/e38fbdb0f7b20769b8746a441eb839b8ca333506

## Source actually added/connected
- Restored missing `apps/api/src/catalog.ts` and migration `0016_generic_catalog.sql`; the old status reports incorrectly said these existed. Tenant catalog CRUD/status API and existing company UI now have real source behind their imports. Editing a published item returns it to DRAFT.
- Canvas with draggable nodes, pointer/touch pan, wheel zoom, arrows, click-to-connect ports, duplicate, bounded undo/redo, saved layout and explicit validation. Editing drafts permits incomplete graph links; publish still strictly validates topology/channel limits.
- Version history UI and rollback API: rollback creates a new immutable publication; active sessions stay pinned.
- Added executable QUESTION, KEYWORD, CATALOG, AI and WEBHOOK nodes. Existing START/TEXT/BUTTONS/LIST/INPUT/CONDITION/TAG/MEDIA/LINK/HANDOFF/END remain. Catalog is dynamically rendered as approved text (first ten entries, no pagination). KEYWORD is a graph branch, not a global trigger system.
- Authenticated preview calls the same server interpreter. Preview does not enqueue webhook jobs or send WhatsApp messages. Optional AI preview consumes logged AI usage. Clearly labelled offline demo stays separate.
- Optional per-company AI settings, monthly cap, approved FAQ/catalog source selection, source-ID audit, exact-answer fallback, uncertain-answer handoff and environment-configured OpenAI-compatible provider. Provider selects a source ID; business answers are copied from approved content, not generated prices. No live provider was exercised.
- Inbox per-user unread counts/read markers, closed/assigned/unread filters, saved replies, internal notes and close action. Existing lock-based staff takeover remains. Generic lead presentation no longer uses traveler-specific columns.
- Outbound HTTPS integration configuration, flow job enqueue, worker delivery with five attempts, audit and idempotency header. Exact host allowlist; public IPv4 DNS validation and pinned lookup; no redirects, IP literals, URL credentials or query secrets. Optional HMAC signing secret is environment-only. Receiver must implement idempotency; retries can deliver more than once.
- Individual approved static templates can be scheduled 1 minute–30 days ahead. Consent/subscription/window rules are rechecked by existing worker. This is not a bulk campaign or sequence builder.
- Owner-issued hashed 90-day access keys, scoped to catalog/lead GET endpoints, revocation, audit and one-time display UI.
- Retired active legacy `/programs`, `/bookings`, `/departures`, `/offers`, `/bot` endpoint families with HTTP 410. Dashboard no longer requests old tourism resources; generic pages are allowlisted. Historical migrations/data and some dormant legacy source/HTML are intentionally preserved.
- Removed invalid non-code `inventory.ts`. Replaced invalid `tests/db-integration.mjs` placeholder with a real disposable PostgreSQL RLS gate. Added regression tests, dependency lockfile, test build prerequisite and reproducible Docker dependency install.

## Verification actually performed
- Clean `npm ci --ignore-scripts --no-audit --no-fund` succeeded (22 packages); TypeScript/build succeeded.
- JavaScript syntax checks succeeded for changed browser modules, server and new test entrypoints.
- Static HTTP smoke: dashboard and `/flow-canvas.js` returned 200 with expected content type in a local server process.
- `git diff --check` passed.
- No local unit/integration acceptance run: comprehensive acceptance remains deferred until remaining build scope is completed, per owner instruction. GitHub CI ran independently on `e38fbdb`: 38 tests, 34 passed / 4 failed. All nine new generic-flow regressions passed. Four failures target unchanged legacy program/booking services (createProgram total fixture, invalid booking phone fixtures, confirm query-count expectation); baseline was not rerun, and these are unresolved. DB migration/RLS steps were skipped after the unit failure. Evidence: https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39070131242 .
- PostgreSQL/Docker executables and live database credentials are unavailable here. Real migration/RLS, concurrency and backup/restore were NOT run locally.
- Playwright package exists but Chromium executable does not. Browser download returned invalid/empty ZIP data; authenticated browser/mobile acceptance and screenshots were NOT obtained.
- No Meta account/token, provider AI key or approved outbound destination credentials were supplied. No live customer traffic or commercial deployment.

See REMAINING.md for explicit unfinished scope and docs/11-LOCAL-SETUP.md for startup.
