# Reproducible verification

Local environment: disposable `elhafez_ci`, PostgreSQL 17.11, a non-owner/non-superuser/non-BYPASSRLS application role, Node 24.19.0 and Chromium 154.0.8037.57. ClamAV 1.4.3 used the repository CI's small EICAR acceptance signature database: actual scanner protocol/private-media lifecycle, not production signature coverage.

## Unit and database

- `npm run check`: **161 passed, 0 failed, 0 skipped**; TypeScript build/typecheck passed.
- `MIGRATION_DATABASE_URL=<disposable-admin-url> npm run db:migrate`: additive migrations 0033 and 0034 applied to the disposable database; second migration run succeeds unchanged.
- `CI_DB_INTEGRATION=1 MIGRATION_DATABASE_URL=<disposable-admin-url> node tests/db-integration.mjs`: PASS actual RLS/FORCE and cross-tenant denial.
- `MIGRATION_DATABASE_URL=<disposable-admin-url> node tests/bots-db.mjs`: PASS legacy backfill twice without version loss, immutable rollback, concurrent save (one success/one 409), pinned sessions, independent bots, tenant/role denial, routing, CRM, consent/campaign review without jobs, and team lifecycle.

New units verify seven input types, invalid dates/coordinates, error-state answer preservation, flat AND/OR truth tables, legacy definitions, stable choice IDs, a valid 100-node execution chain, ordered composite payloads, unsafe/nested content rejection, disconnected draft vs publish, SET_FIELD mapping, weighted boundaries/loop rejection, pinned subflow field/token bindings and notes excluded from messages.

Continuation units (`tests/flow-controls.test.mjs`, 16 tests) exercise immutable deadlines, retry exhaustion, explicit optional skip, stale tokens, late answers, nested AND/OR, date/tag/membership semantics, typed enum/boolean constraints, overnight/weekend/holiday/DST scheduling, sticky experiments/goals, URL routing/compatibility, draft trigger validation, explicit bounded MOCK assistance, internal multi-screen forms and recursive subflow mapping.

`MIGRATION_DATABASE_URL=<disposable-admin-url> node tests/flow-controls-db.mjs`: **14 scenarios PASS**, using a newly created non-owner/non-BYPASSRLS role and separate tenants. Separate transactions reload retry/deadline metadata; actual worker delivers timeout exactly once; premature clocks requeue; same-node stale-token and late-answer guards pass; simultaneous reply/worker takes one timeout transition; real CRM stage/assignee writes and session-only scope survive human-keyword handoff; persisted events exclude preview/answers; real RLS/foreign-bot denial and foreign-assignee publication rollback preserve the pinned version. Four trace scenarios additionally validate execution ordinals, exact microsecond cursor pages, tenant/wrong-bot denial, old unordered events and saved FAILED job snapshots. Legacy null-bot pinned sessions remain executable and contribute only to the legacy bot report. No external provider call.

`tests/flow-controls-http.mjs` is invoked by the runtime harness on the loopback web gateway: actual authenticated five-channel lint (including Messenger 640-character URL-template bound), deterministic timeout, malformed runtime rejection, explicit MOCK-only assistance and post-logout 401. This also passed as a standalone targeted HTTP run.

## Combined API and Chromium command

```sh
CI_RUNTIME_ACCEPTANCE=1 CI_ACCEPTANCE_DISPOSABLE_DB=YES \
MIGRATION_DATABASE_URL=<disposable-admin-url> \
CLAMAV_SOCKET=<local-clamd-socket> CHROME_BIN=/usr/bin/chromium \
node tests/runtime-acceptance.mjs
```

The full combined run passed the broad, novice and premium Chromium suites. A follow-up `CI_BOT_BROWSER_ONLY=1` run repeated API/runtime, novice/premium and the new HTTP checks after legacy analytics coverage was added; that flag deliberately skips only the already-passed broad suite. Final UUID-boundary hardening is covered by Unit and targeted HTTP checks.

The harness provisions a separate premium UI actor and invokes `premium-builder-browser.mjs` after existing broad/novice suites. Authentication, role and throttle budgets stay enabled. Provider transport is explicitly offline. Local publish tests create immutable fixture revisions, never application deployments or real account routing.

Premium Chromium proves cursor invariance at three points; no camera jump; actual pointer node drag and undo; live connection ghost/input drop; edge disconnect/undo/redo/reconnect/Escape; group clipboard with new IDs/internal edge; tourism greeting/menu/name/phone/compound Cairo branch/handoff with trace and synthetic values; save acknowledgment racing a newer edit; offline save and explicit reload recovery; optional autosave; actual stale-revision 409; 50/100-node save/reopen; **48 and 98 property input edits** with persisted readback; 390/768/1024/1440, map/search and CSS 200%; actual SET_FIELD/composite media/weighted-random preview and reopened properties.

Machine results: [current results.json](../../evidence/continuation-2026-10-20/results.json); [initial batch](../../evidence/premium-2026-10-20/results.json). Timings include navigation/render; edit batch timings include repeated real DOM input events. They are not p95 latency or sustained memory profiling.

Actual browser-UI zoom was unavailable in this headless configuration. The 200% screenshot exercises CSS zoom, and the older suite tests equivalent viewport reduction. This remains PARTIAL. Physical pinch, screen reader and a novice human usability session remain unverified.

The continuation Chromium suite also edits and saves timeout seconds through the real inspector; advances simulated time; skips optional input; reopens nested groups; authors START triggers without activating them; checks actual HTTP preflight, malformed simulation/mode rejection and empty actual analytics after previews; rejects/accepts a text proposal; edits and previews a two-screen form with browser required/email constraints; saves internal forms; rejects a generated draft and accepts/undoes one without publication. Screenshot artifacts contain only synthetic authoring values.

Set `PREMIUM_EVIDENCE_DIR=docs/product-rebuild/evidence/continuation-2026-10-20` on the command to retain initial-batch evidence separately.

## Final trace acceptance checkpoint

Executable source is pushed and verified as `f7651bedb086fcc7f39ef75e616920b63a0e91a5`, after the prior functional checkpoint `66031dd20bcb1301a0cb8282e4a2dbc64aa7999c`. The final combined command adds `CI_TRACE_BROWSER=1`; prepare its isolated fixture with `TRACE_BROWSER_FIXTURE=1 ... node tests/flow-controls-db.mjs` before starting background workers. Existing API/runtime, broad, novice, premium and the new committed-trace browser suites all passed, followed by zero campaign jobs/outbound messages and post-logout rejection. Premium screenshots for this final repeat were written to a scratch directory to preserve the already-committed first-batch images. Four trace screenshots and six dedicated trace checks are committed under `../../evidence/traces-2026-10-20/`.

Current results: 161 Unit, 14 PostgreSQL control/trace scenarios, real RLS and independent-bot/legacy/team/CRM tests, full API/runtime/broad/novice/premium/trace Chromium all PASS locally. Migration re-run and JS syntax checks PASS. Remote GitHub Actions completion is not claimed. See `verification.txt`, `TRACE_CHECKPOINT.md`, and `CHECKPOINTS.md`.

## Diagnosed failures

- Nested condition select names initially included option text in their implicit label. Added explicit accessible names to field controls; title-reorder acceptance now targets the explicit title name instead of all labeled inputs.
- A premature-clock worker probe identified the need to requeue an early continuation rather than mark it done; the new PostgreSQL scenario verifies this behavior.
- Retained established save-success wording for existing tests while adding persistent status.
- Broad Chromium caught a real drag-overlap regression from group movement. Fixed one collision-safe group translation using measured sizes; did not weaken the assertion.
- Broad media acceptance initially lacked CLAMAV_SOCKET. Actual local scanner with CI acceptance signature enabled upload/scan/private preview/delete.
- Repeated manual launches exhausted the real 10-per-600-second login window. Waited for its normal boundary and used separate actors in the combined harness. Production throttle code/limits are unchanged.

Final combined outcome and logs: `verification.txt`. No result establishes live provider readiness.

Final targeted Chromium rerun also verifies initial fit waits for the hidden workspace to become visible; source stylesheet port rules retain their own font and size instead of inheriting generic button text.
