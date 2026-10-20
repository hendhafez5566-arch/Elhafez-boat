# Reproducible verification

Local environment: disposable `elhafez_ci`, PostgreSQL 17.11, a non-owner/non-superuser/non-BYPASSRLS application role, Node 24.19.0 and Chromium 154.0.8037.57. ClamAV 1.4.3 used the repository CI's small EICAR acceptance signature database: actual scanner protocol/private-media lifecycle, not production signature coverage.

## Unit and database

- `npm run check`: **142 passed, 0 failed, 0 skipped**; TypeScript build/typecheck passed.
- `MIGRATION_DATABASE_URL=<disposable-admin-url> npm run db:migrate`: existing migrations applied; no new migration needed.
- `CI_DB_INTEGRATION=1 MIGRATION_DATABASE_URL=<disposable-admin-url> node tests/db-integration.mjs`: PASS actual RLS/FORCE and cross-tenant denial.
- `MIGRATION_DATABASE_URL=<disposable-admin-url> node tests/bots-db.mjs`: PASS legacy backfill twice without version loss, immutable rollback, concurrent save (one success/one 409), pinned sessions, independent bots, tenant/role denial, routing, CRM, consent/campaign review without jobs, and team lifecycle.

New units verify seven input types, invalid dates/coordinates, error-state answer preservation, flat AND/OR truth tables, legacy definitions, stable choice IDs, a valid 100-node execution chain, ordered composite payloads, unsafe/nested content rejection, disconnected draft vs publish, SET_FIELD mapping, weighted boundaries/loop rejection, pinned subflow field/token bindings and notes excluded from messages.

## Combined API and Chromium command

```sh
CI_RUNTIME_ACCEPTANCE=1 CI_ACCEPTANCE_DISPOSABLE_DB=YES \
MIGRATION_DATABASE_URL=<disposable-admin-url> \
CLAMAV_SOCKET=<local-clamd-socket> CHROME_BIN=/usr/bin/chromium \
node tests/runtime-acceptance.mjs
```

The harness provisions a separate premium UI actor and invokes `premium-builder-browser.mjs` after existing broad/novice suites. Authentication, role and throttle budgets stay enabled. Provider transport is explicitly offline. Local publish tests create immutable fixture revisions, never application deployments or real account routing.

Premium Chromium proves cursor invariance at three points; no camera jump; actual pointer node drag and undo; live connection ghost/input drop; edge disconnect/undo/redo/reconnect/Escape; group clipboard with new IDs/internal edge; tourism greeting/menu/name/phone/compound Cairo branch/handoff with trace and synthetic values; save acknowledgment racing a newer edit; offline save and explicit reload recovery; optional autosave; actual stale-revision 409; 50/100-node save/reopen; **48 and 98 property input edits** with persisted readback; 390/768/1024/1440, map/search and CSS 200%; actual SET_FIELD/composite media/weighted-random preview and reopened properties.

Machine results: [results.json](../../evidence/premium-2026-10-20/results.json). Timings include navigation/render; edit batch timings include repeated real DOM input events. They are not p95 latency or sustained memory profiling.

Actual browser-UI zoom was unavailable in this headless configuration. The 200% screenshot exercises CSS zoom, and the older suite tests equivalent viewport reduction. This remains PARTIAL. Physical pinch, screen reader and a novice human usability session remain unverified.

## Diagnosed failures

- Retained established save-success wording for existing tests while adding persistent status.
- Broad Chromium caught a real drag-overlap regression from group movement. Fixed one collision-safe group translation using measured sizes; did not weaken the assertion.
- Broad media acceptance initially lacked CLAMAV_SOCKET. Actual local scanner with CI acceptance signature enabled upload/scan/private preview/delete.
- Repeated manual launches exhausted the real 10-per-600-second login window. Waited for its normal boundary and used separate actors in the combined harness. Production throttle code/limits are unchanged.

Final combined outcome and logs: `verification.txt`. No result establishes live provider readiness.
