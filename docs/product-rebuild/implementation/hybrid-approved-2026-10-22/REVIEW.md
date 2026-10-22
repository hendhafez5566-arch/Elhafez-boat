# Approved hybrid UI — implementation review

22 October 2026. Branch `feat/approved-hybrid-ui`, based on the verified remote `feat/stage0-foundation` at `9f074a6f138a8db5046899128edcb3414afa930a`.
Application/test source commit: `6f3dcfe648620e77bed141c4f80f7414f8966086`. This report and evidence are a following documentation commit. No merge, Railway deployment, external-account connection or customer message was performed.

## Delivered behavior

The existing Basic Builder and Canvas still use the same authoritative flow object, authenticated draft save API, history, Inspector and server interpreter. No schema, migration, dependency, lockfile or execution contract changed.

- Rebuilt the workspace composition around the approved blue/white header, left searchable grouped library, broad canvas, compact cards, readable message previews and route ports. Existing channel validation, publishing and advanced tools remain accessible.
- Basic cards show their actual connected destinations, open destination editors directly, support context duplication and insertion between steps, count current nodes and retain disconnected-step warnings. Templates still use existing replacement confirmation. Both modes retain their changes after authenticated save/reload.
- Added a persistent desktop conversation-preview dock by moving the existing simulator elements, without copying state, implementing another interpreter, or adding another preview endpoint. Below 1100px the same simulator uses its existing modal; resizing an open dock preserves it in the modal. Escape closes the dock and restores focus.
- Preserved the existing full modal simulator entry alongside the new dock to maintain authoring/diagnostic workflows and browser acceptance. Kept draft-save status visible in all views, including mobile.
- Moved essential history controls to the common header, reduced repeated preview controls, and adapted the mobile header, timeline and preview.
- Fixed a Canvas geometry defect: forward edges with 24–99px clear separation previously took the backwards-loop route. They now use the direct forward curve. Node identities, positions, connection keys and runtime routing are unchanged.

## Verified checks

| Check | Actual result |
| --- | --- |
| `npm ci --cache /tmp/elhafez-npm-cache --ignore-scripts --no-audit --no-fund` | Installed from unchanged lockfile with verification enabled |
| `npm run check` | TypeScript, build, **250 tests passed; 0 failed** |
| Existing migrations on newly created disposable `elhafez_ci` | Passed; no production database involved |
| `CI_DB_INTEGRATION=1 node tests/db-integration.mjs` | PostgreSQL tenant read/update/insert isolation and RLS/FORCE flags passed |
| `node tests/bots-db.mjs` | Bot independence, pinned versions, optimistic revision conflict, tenant isolation and role restrictions passed; detailed log linked below |
| `node tests/flow-context-policy-db.mjs` | Four consent/privacy/transaction/RLS scenarios passed and generated isolated browser account |
| `node tests/flow-context-policy-browser.mjs` | Three authenticated Chromium regression scenarios passed, including mobile autocomplete and channel capability matrix |
| `node tests/hybrid-approved-browser.mjs` | Nine grouped scenarios passed; no page errors; eleven actual app screenshots |
| Existing premium Chromium suite | 29 checks passed; pointer/port drag, clipboard/history, recovery, autosave, conflicts, layout/property editing and real simulation |
| Offline governance and browser gate | Three PostgreSQL and two Chromium scenarios passed; real mobile save notice retained |
| Rendered production-CSS contrast | 183 pairs passed; 27 distinct SVGs/descriptions; not exhaustive WCAG certification |
| Production Docker build | Node 22/Alpine multi-stage image built successfully, final image `sha256:16112d6a38cd7db419be87567022dcc24b482b1ba4066dc966805397cd41df08` |
| `tests/hybrid-package-smoke.mjs` inside final image | Database health, real authentication, bots API and four builder assets passed |

The Docker build used the repository Dockerfile with only an ephemeral BuildKit CA-secret mount added to its dependency-install RUN in `/tmp/elhafez-Dockerfile`. The environment's trusted proxy CA was supplied to npm via `NODE_EXTRA_CA_CERTS`; TLS and artifact integrity checks stayed enabled. No CA, credentials or test fixture was baked into the image. `BUILDX_CONFIG` and npm cache used writable `/tmp` locations.

Chromium acceptance creates a real bot from a tourism template, configures a representative eight-step draft through the real API, then edits messages in Basic, removes/recreates choices using the actual editor and wires all three to distinct destinations. It inserts a connected message, switches both views, saves/reloads, duplicates/undoes/redoes/deletes, creates a second independent bot, and runs the real server simulation through choice → input → condition → staff handoff. Desktop viewport is 1490×940; mobile is 390×844. Samples are synthetic; there is no real provider account.

## Visual review and evidence

[Side-by-side reference comparison](VISUAL-COMPARISON.md). All app captures are from the authenticated modified platform. `reference-*.png` alone are renders of the supplied original prototype, explicitly **not** implementation evidence. The attachment checksum exactly matches the original approved checksum despite the attached README's older statement that it was unavailable.

[Evidence directory](../../evidence/hybrid-approved-2026-10-22/) contains the screenshot manifest, nine browser outcomes, underlying unit/PostgreSQL/browser/package logs and eleven actual app images. Source and screenshot SHA-256 values are recorded in `manifest.json`.

## Limits and remaining acceptance

- This is implemented product UI, with successful local functional and packaged-runtime checks; it is **not a claim of 100% pixel or feature parity**. The production editor retains channel/role validation, publishing, runtime metadata, semantic block icons and advanced configuration absent from the visual prototype. Resulting header and card dimensions/content differ. Production form editing continues through the real Inspector rather than the prototype's fake configuration panel.
- Existing complex media/gallery, every advanced component, all CRM/inbox/campaign workflows, full historical acceptance suites and physical-device/accessibility qualification were not reaccepted by this focused campaign. Existing qualification limits remain in force. No new media capability or live channel acceptance is claimed.
- No Railway rollout, production-data change, provider send, or owner visual approval has occurred.
- Draft PR [#7](https://github.com/hendhafez5566-arch/Elhafez-boat/pull/7) was created successfully, and `gh pr view` verified `isDraft: true` and base `feat/stage0-foundation`. The pushed code/evidence commit was `13299d916d7cbaad1bcf66a964fdf4cd3e3e8071`; the following documentation commit records the PR. API CONNECT requests initially failed, but the actual native GitHub CLI operation later succeeded without additional credentials. An `api.github.com` domain addition was saved in the environment configuration draft, preserving presets; no claim is made that the draft was published or caused the later success. The first broad CI revision exposed a hidden mobile save-notice regression; the corrected exact offline-form gate now passes locally. Newest-head full CI is running and is not claimed green. CI is checked separately for the newest pushed HEAD.

## Reproduction

Use the existing checkout; each cloud task is already isolated and does not need a worktree. Install with the frozen npm lockfile and build. Run database suites only against a newly created disposable PostgreSQL database named `elhafez_ci`, using `MIGRATION_DATABASE_URL`; never a customer database. The context-policy DB suite generates the ignored, mode-0600 `acceptance-evidence/variable-context-account.json` with a non-owner/non-BYPASSRLS runtime role. Do not commit or print that file.

Start compiled API and web separately with that runtime connection, a fresh local `RATE_LIMIT_SECRET`, `PORT=4100`, `WEB_PORT=3100` and `API_INTERNAL_ORIGIN=http://127.0.0.1:4100`. No worker or external provider is required for authenticated draft authoring/server preview. Then run `WEB_BASE_URL=http://127.0.0.1:3100 node tests/hybrid-approved-browser.mjs` with system Chromium. The package smoke script expects the same ignored fixture mounted read-only at `/run/test-account.json`; pass it through stdin to `docker exec -i <local-test-container> node --input-type=module`. Keep disposable credentials out of command output and Git.
