# Current continuation — 21 October 2026

[CONTINUATION_HANDOVER_2026-10-21.md](CONTINUATION_HANDOVER_2026-10-21.md) is the current continuation: functional source bddfa02; 22 PASS / 14 PARTIAL; 221 units/typecheck/build; 42 migrations; 20 new PG and 15 new Chromium scenarios. Full native source CI 39568310794 SUCCESS; replay source CI 39569623866 in progress at writing. Historical checkpoints below remain historical. Visual approval pending.

# Latest verified continuation — 21 October 2026

[COMPLETION_2026-10-21.md](COMPLETION_2026-10-21.md) supersedes the historical checkpoint below: source ab042d0, 14 PASS / 22 PARTIAL, 194 units, 38 migrations, 65 dedicated browser checks, full runtime + restore + latest Node 22/Compose PASS locally. Remote Actions UNVERIFIED (Forbidden); visual approval pending.

# Calendar package — 21 October 2026

[SCHEDULE_CHECKPOINT.md](SCHEDULE_CHECKPOINT.md): customer timezones, long closed calendars and exact wait inspection/cancellation. 194 units, 6 real PG and 3 new desktop/mobile browser checks PASS. Matrix 14 PASS / 22 PARTIAL. Visual approval pending.

# Native result package — 21 October 2026

[CONNECTOR_CHECKPOINT.md](CONNECTOR_CHECKPOINT.md): shared existing queues/runtime with committed waits/results, no resend, privacy/operations and real desktop/mobile UI. 189 units, 13 new PG scenarios and 3 new Chromium checks PASS; 13 PASS / 23 PARTIAL.

# Current package — 21 October 2026

See [AUTHORING_CHECKPOINT.md](AUTHORING_CHECKPOINT.md): unified readiness/version comparison, safe resource remapping and revision-bound independent reviews. 185 units, 10 new PostgreSQL and 5 real desktop/mobile Chromium checks PASS. Matrix 13 PASS / 23 PARTIAL; visual approval pending.

## Current final handover

[CI-CLOSURE.md](CI-CLOSURE.md) supersedes prior pending gates: 10 PASS / 26 PARTIAL; full local acceptance, backup/restore and packaged smoke pass. Remote CI remains unverified (Forbidden). No release/visual approval implied.

## Integrated content, actions and drawing checkpoint — continued from d551ef0

Same branch / Draft PR #5. New end-to-end functionality targets **F03/F05/F06/F25/F31** together:
- Ordered legacy TEXT/BUTTONS blocks now support CARD and GALLERY, preserving the existing single interpreter/storage contract. Structured card/gallery/action controls, gallery reorder, safe URLs, images and bounded total ten cards; composite content precedes the final interactive prompt. No parallel MESSAGE engine or schema migration.
- Native Website Chat cards/carousels, shared-engine rich simulator; Messenger/Instagram generic-template contracts; explicit ordered image/text/link fallbacks on WhatsApp/Telegram. Unsupported native WhatsApp carousels are never sent. Channel preflight and fallback simulator reflect the contract; provider activation is not claimed.
- Button effects atomically validate/apply typed fields and add/remove tags before following their existing stable-ID route; URL actions never execute effects. Existing assign/node/URL contracts retained. Real website replay tests prove one persisted result and CRM value.
- Persistent group folding keeps external edge identities, search reopens hidden nodes, shortest-path breadcrumbs and explicit path focus; existing minimap/navigation retained. Selection translation clamps the whole group without distorting offsets. Actual rectangle/Shift selection, alignment/distribution and group drag tested.
- Fixed two user-visible issues exposed by these tests: website composite messages shared transaction timestamps and sorted by random UUID; new delivery now assigns strictly increasing timestamps while holding the existing conversation lock. Save acknowledgments replaced the flow object while leaving editor/drag closures attached to the old object; matching acknowledgments now rebind the editor/canvas while preserving the in-flight-newer-edit guard and camera.

Actually run: TypeScript/build and **177 Unit PASS**; **5 new real PostgreSQL/website/CRM scenarios PASS**; existing **14 controls** and **19 request** PostgreSQL scenarios, bots/CRM/team/legacy and forced RLS PASS. Dedicated actual API/PostgreSQL/Chromium: **8 checks PASS**, including a real mobile widget and persisted group drag after saving. Evidence: `../../evidence/integrated-2026-10-20/` and `INTEGRATED_VERIFICATION.txt`.

The full combined acceptance is the next gate before changing the five matrix statuses. Canonical totals remain conservatively 5 PASS / 31 PARTIAL at this source checkpoint. F23 is unchanged and does not block independent functionality. No real provider/customer sends, new branch/PR, merge or production deployment. Radical redesign remains deferred; these are functional components, not visual approval.

## Latest saved batch — request privacy lifecycle and CI-equivalent acceptance

Source checkpoints already verified on the same GitHub branch/Draft PR #5: `8dffe74` contracts, `6f41af8` durable worker, `7979892` initial full evidence, **`cfeb13e8ada09f53976cc51a08ab156b7f109c37`** widget/privacy-compatible contact-before-conversation locks and exact isolated HMAC fixture checks. This follow-up completes the new response-data privacy lifecycle and saves the final repeated evidence. No new branch, merge or deployment.

New response fields are now scrubbed together with integration request payloads during authorized contact erasure, completion is disabled and pending requested jobs become CANCELLED. In-flight/UNCERTAIN requested jobs follow the existing platform policy: owner erasure returns 409 until reconciliation; retention defers. Tests reconcile only synthetic attempts explicitly, then prove response/payload erasure, cancellation and zero later HTTP/continuation. This does not implement an operator reconciliation UI/API: that is a real remaining F23 gap, and no external effect is inferred from a timeout.

Latest checks actually run: **171 Unit PASS** and TypeScript/build; **19 durable integration PostgreSQL scenarios PASS**, including real contact-lock/poll race and two privacy scenarios; repeated existing setup/media/inbox/integration checks PASS. Existing 14 control/trace, legacy/bots/team/CRM/RLS and migration rerun were also run earlier this session. [Latest request/privacy log](request-privacy-verification.txt).

The full CI-equivalent command with **CI_LOCAL_CLOSURE=1** exited **0** on request/concurrency source `cfeb13e`, including mixed HTTP workload, OAuth/provider fixtures, exact HMAC checks, native social fixtures, privacy races, real ClamAV, API/delay crash checks and all broad/novice/premium/trace/request Chromium suites. [Complete log](request-ci-equivalent-acceptance.txt). The subsequent privacy delta is verified by its 19-scenario PostgreSQL and Unit rerun; the earlier full process is not relabeled as testing code written after it loaded.

Actual current application screenshots and machine results: [request inspector](../../evidence/requests-2026-10-20/request-inspector.png), [Mock mapped-response preview](../../evidence/requests-2026-10-20/mock-response-success.png), combined premium/trace results and updated source/image SHA-256 manifest in the same folder. Prior trace screenshots remain unchanged. All provider traffic uses local mock transports; no live Meta/WhatsApp/AI/customer sends. ClamAV signatures are CI-only qualification.

GitHub CI history: contract Verify **964 SUCCESS**. Verify **966** and the evidence-only successor exposed the old cumulative-fixture count; source fix is `cfeb13e`. On Verify **970 / 39477200993**, Unit/TypeScript/DB `checks` succeeded and full runtime acceptance was in progress at writing. Inspect the newest HEAD/run separately before claiming overall CI green. No test weakening or production guard changes.

Matrix remains **5 PASS / 31 PARTIAL / 0 wholly BLOCKED**. F23 stays PARTIAL. **Next functional task:** scoped request-job diagnostics plus explicit audited operator reconciliation of UNCERTAIN attempts (never automatic POST replay), then native CONNECTOR response/error continuation using its existing queue. Other true gaps remain those in F01–F36.md: cards/gallery and native channel coverage, consent/human policies, scheduling extremes, funnel/experiment/delivery correlation, tab-close recovery and advanced drawing/device/accessibility acceptance. Meta/WhatsApp/AI external qualification remains blocked within PARTIAL items. Radical redesign remains deferred; earlier screenshots were not owner-approved. Do not repeat saved controls, traces or request runtime.

## Request concurrency and CI fixture correction — follow-up to `7979892`

Inspection of GitHub Verify 966 found its Unit/DB checks successful, but its additional local-closure acceptance failed because the old HMAC test counted three earlier request-fixture calls along with its own two. The test now snapshots the call list before dispatch and still asserts exactly two new requests and exact signatures/keys. No count or signature requirement was relaxed.

Repeating with `CI_LOCAL_CLOSURE=1` also exposed a real contact/conversation deadlock between widget polling and response continuation (PostgreSQL 40P01). The new request worker now locks **contact before conversation**, matching Website Chat/privacy, and then session/job, in claim/result/completion transactions. Candidate readiness is rechecked after locks, so a competing worker cannot reinterpret a newly claimed POST as expired. Busy claims skip without dispatch; response persistence waits safely for contact-first visitors. A deterministic PostgreSQL test holds the actual contact lock, observes the worker waiting on that contact before conversation, polls/locks the conversation, and then verifies one successful continuation and one HTTP attempt.

Actually rerun: TypeScript/build, **171 Unit PASS**, **17 durable integration PostgreSQL scenarios PASS** (previous 16 plus real lock-order race). Full acceptance with the same extra CI local-closure setting is running; do not treat the preceding narrower EXIT 0 as proof of this pending repeat. No schema/provider changes. F23 stays PARTIAL, totals 5 PASS / 31 PARTIAL / 0 wholly BLOCKED. No merge/deploy or independent redesign.

## Final verification of saved runtime `6f41af8`

Remote functional checkpoint: **6f41af89841bf76c31b562b0c85105bd97e56d16** (after contract checkpoint **8dffe747e07c44cb84ebcea87fd97d9500333836**). Both were pushed immediately after stable tests; remote/local trees and branch HEAD verified. Same Draft PR #5, same target `feat/stage0-foundation` at `cc702b7`; no merge/deploy. The follow-up is evidence/handoff only.

`npm run check`: 171/171, zero failed/skipped; 16 durable request PostgreSQL scenarios and 14 existing controls/trace scenarios; bots/CRM/team/legacy/RLS and local media/setup/inbox regressions; migration rerun: all EXIT 0. Combined `CI_RUNTIME_ACCEPTANCE=1 CI_ACCEPTANCE_DISPOSABLE_DB=YES CI_TRACE_BROWSER=1 ... node tests/runtime-acceptance.mjs`: **EXIT 0**. Includes actual public API/widget -> worker -> production HTTP boundary against loopback fixtures for mapped success, HTTP 429 and timeout, one POST attempt per wait; API SIGKILL/restart and delay worker competition; broad and novice UI; premium 50/100 nodes, 48/98 real edits, save/reopen, offline/409 recovery, mobile/RTL, CSS 200% (not browser UI zoom); ordered actual trace, request inspector/Mock branches and logout. Campaign review created zero campaign jobs/outbound. No live customer/provider traffic.

Evidence: [complete combined log](request-combined-acceptance.txt), [unit/database/browser/migration log](request-runtime-verification.txt), [request inspector](../../evidence/requests-2026-10-20/request-inspector.png), [Mock response preview](../../evidence/requests-2026-10-20/mock-response-success.png), machine results and SHA-256 manifest in that same evidence folder. Earlier trace screenshot bytes retained; re-run trace results copied into the request evidence folder. ClamAV uses the small CI acceptance signature database, not production signature qualification.

GitHub CI: contract checkpoint `8dffe74`, Verify **964 / 39473977403**, completed SUCCESS. Runtime checkpoint `6f41af8`, Verify **966 / 39476327203**, was IN_PROGRESS when this evidence was written; inspect actual latest Actions status before claiming final CI success. These local results do not assert remote CI completion.

Status unchanged: **5 PASS / 31 PARTIAL / 0 wholly BLOCKED**; F23 delivered request runtime but native connector/provider contracts and qualification remain. Next functional step is bounded CONNECTOR response/error continuation through its existing jobs, followed by channel/composite-card and experiment/funnel gaps. Real Meta/WhatsApp/AI qualification remains an external dependency. Radical redesign remains deferred and earlier images were not approved.

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

## Durable F23 runtime checkpoint — 20 October 2026

Continued from verified remote `8dffe747e07c44cb84ebcea87fd97d9500333836`, on the same execution branch and Draft PR #5. Migration **0035** extends the existing integration jobs, preserves old rows/RLS and published definitions, and adds one unique tenant/conversation/wait-token request. Existing fire-and-forget WEBHOOK jobs retain their existing semantics.

The worker commits a claim before HTTP, stores only bounded mapped response fields in a separate transaction, and resumes only the same pinned version/node/wait token. Success, HTTP/mapping/type errors, disabled integration and deadlines take explicit graph routes. POST has **one dispatch attempt**, including 429/transport ambiguity: an interrupted/unknown attempt becomes UNCERTAIN and is never automatically resent. This is not a guarantee of an external effect: a crash after claim can leave an unexecuted request; a receiver must honor the stable job idempotency key to deduplicate its own effects. GET alone can retry bounded safe transient failures with the same key. Existing timeout jobs remain the deadline mechanism.

Completion retries recover local delivery/transaction failures from the stored response without HTTP replay (five bounded continuation attempts). New inbound text cannot re-enqueue a waiting request. Restart/human takeover, consent, active subscription, service window and disabled/expired/reauthorization-required accounts are rechecked before dispatch/continuation. Late results do not assign fields. Response assignment validates all declared variable types atomically. No full response or credentials enter trace events. HTTPS allowlist, public DNS pinning, no redirect, encrypted authentication and 64-KiB response limits remain. DNS and HTTP share the bounded request deadline. GET fields are encoded query parameters; HMAC signs method/target/query/job key, with explicit `get-v1` signature version. Legacy POST HMAC remains compatible.

A PostgreSQL test exposed terminal destinations restarting instead of being entered after a continuation. Trusted internal entry now treats END/HANDOFF/INPUT as a fresh destination, with a regression unit and actual database success/error/timeout checks. Public preview cannot set this internal flag.

Actually run at this checkpoint: TypeScript/build and **171 Unit PASS**; **16 new PostgreSQL scenarios PASS** under a real non-owner/non-BYPASSRLS role; existing **14 control/trace scenarios PASS**; legacy bots/CRM/team, forced RLS, local ClamAV/media/setup/inbox and migration re-run PASS. Dedicated Chromium request editor/API checks: three PASS. Full combined acceptance is still running at this functional checkpoint; final results follow separately. Logs: request-runtime-verification.txt. The full public widget/API -> restricted worker -> production HTTP boundary already passes mapped success, HTTP failure and timeout with one POST per wait against a **loopback mock**, never a real provider. Worker interruption here is a simulated expired committed lease, not an actual SIGKILL during integration HTTP; the existing broad runtime suite separately kills API/delay workers.

F23 remains **PARTIAL**: native CONNECTOR nodes still enqueue their existing fire-and-forget provider jobs and do not implement this response-continuation contract; provider-specific response/error mapping, provider qualification, configurable non-JSON/header contracts and production crash/load qualification remain. Totals remain **5 PASS / 31 PARTIAL / 0 wholly BLOCKED**. Meta/WhatsApp/AI external qualification remains blocked within PARTIAL F24/F29/F30. No merge/deploy/provider activation. Radical visual redesign is deferred, and earlier screenshots do not constitute owner approval.

Next: finish/inspect combined API/Chromium and GitHub CI, then extend the existing CONNECTOR contracts with scoped bounded response/error mapping (no parallel queue and no real provider), or proceed to adjacent message/channel gaps from the matrix. Do not repeat the saved request worker or earlier control/trace work.
