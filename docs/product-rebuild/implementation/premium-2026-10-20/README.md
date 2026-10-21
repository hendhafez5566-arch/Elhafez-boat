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

# Premium Flow Studio — implementation and acceptance

This is a substantial **incomplete** implementation batch, not certification of F01–F36 parity. Canonical requirements remain the handoff's `FLOW_BUILDER_PARITY_F01_F36.md`. No merge, Railway deployment, real provider account, campaign launch or real customer delivery occurred.

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

## Durable F23 runtime checkpoint — 20 October 2026

Continued from verified remote `8dffe747e07c44cb84ebcea87fd97d9500333836`, on the same execution branch and Draft PR #5. Migration **0035** extends the existing integration jobs, preserves old rows/RLS and published definitions, and adds one unique tenant/conversation/wait-token request. Existing fire-and-forget WEBHOOK jobs retain their existing semantics.

The worker commits a claim before HTTP, stores only bounded mapped response fields in a separate transaction, and resumes only the same pinned version/node/wait token. Success, HTTP/mapping/type errors, disabled integration and deadlines take explicit graph routes. POST has **one dispatch attempt**, including 429/transport ambiguity: an interrupted/unknown attempt becomes UNCERTAIN and is never automatically resent. This is not a guarantee of an external effect: a crash after claim can leave an unexecuted request; a receiver must honor the stable job idempotency key to deduplicate its own effects. GET alone can retry bounded safe transient failures with the same key. Existing timeout jobs remain the deadline mechanism.

Completion retries recover local delivery/transaction failures from the stored response without HTTP replay (five bounded continuation attempts). New inbound text cannot re-enqueue a waiting request. Restart/human takeover, consent, active subscription, service window and disabled/expired/reauthorization-required accounts are rechecked before dispatch/continuation. Late results do not assign fields. Response assignment validates all declared variable types atomically. No full response or credentials enter trace events. HTTPS allowlist, public DNS pinning, no redirect, encrypted authentication and 64-KiB response limits remain. DNS and HTTP share the bounded request deadline. GET fields are encoded query parameters; HMAC signs method/target/query/job key, with explicit `get-v1` signature version. Legacy POST HMAC remains compatible.

A PostgreSQL test exposed terminal destinations restarting instead of being entered after a continuation. Trusted internal entry now treats END/HANDOFF/INPUT as a fresh destination, with a regression unit and actual database success/error/timeout checks. Public preview cannot set this internal flag.

Actually run at this checkpoint: TypeScript/build and **171 Unit PASS**; **16 new PostgreSQL scenarios PASS** under a real non-owner/non-BYPASSRLS role; existing **14 control/trace scenarios PASS**; legacy bots/CRM/team, forced RLS, local ClamAV/media/setup/inbox and migration re-run PASS. Dedicated Chromium request editor/API checks and the full combined acceptance results are recorded in TESTS.md and request-runtime-verification.txt as they finish. The full public widget/API -> restricted worker -> production HTTP boundary already passes mapped success, HTTP failure and timeout with one POST per wait against a **loopback mock**, never a real provider. Worker interruption here is a simulated expired committed lease, not an actual SIGKILL during integration HTTP; the existing broad runtime suite separately kills API/delay workers.

F23 remains **PARTIAL**: native CONNECTOR nodes still enqueue their existing fire-and-forget provider jobs and do not implement this response-continuation contract; provider-specific response/error mapping, provider qualification, configurable non-JSON/header contracts and production crash/load qualification remain. Totals remain **5 PASS / 31 PARTIAL / 0 wholly BLOCKED**. Meta/WhatsApp/AI external qualification remains blocked within PARTIAL F24/F29/F30. No merge/deploy/provider activation. Radical visual redesign is deferred, and earlier screenshots do not constitute owner approval.

Next: finish/inspect combined API/Chromium and GitHub CI, then extend the existing CONNECTOR contracts with scoped bounded response/error mapping (no parallel queue and no real provider), or proceed to adjacent message/channel gaps from the matrix. Do not repeat the saved request worker or earlier control/trace work.

## Continuation from a4ced99 — durable runtime and advanced authoring

Continued on the existing branch and Draft [PR #5](https://github.com/hendhafez5566-arch/Elhafez-boat/pull/5), with remote HEAD verified as `a4ced99ee3bbf7e4f2dd8448c19bfb27887607ca` before editing. Target remained `cc702b795f1c7aa0d0b75fec6655574f4f2ec57b`.

This batch implements saved input/choice policies (attempt limits, fallback, optional skip and no-reply deadlines), UUID wait tokens and real worker continuation. Invalid replies preserve the deadline. Expired replies take the timeout path. A stale worker cannot resume a later visit to the same question. Database/application clock differences requeue premature jobs. Runtime counters/experiments are stored separately from answers.

Advanced authoring adds recursive AND/OR groups, date/tag/membership operators, nine typed variable kinds and contact/session scopes, inline START triggers committed only at publication, remove-tag and actual CRM stage/tenant-member assignment, smart date/field/business-hours schedules, sticky weighted branches and explicit goals. Session-scoped values stay out of CRM, including manual human-keyword handoff. Pinned subflows remap the new fields and ports without changing published source definitions.

Five-channel capability checks gate URL button combinations at publication and execution. URL actions render as website anchors, Telegram URL buttons, Messenger web URLs and single WhatsApp CTA URLs. Structural/channel preflight returns errors/warnings with node navigation; full provider readiness remains separate. Real transition outcomes/timings are persisted in an RLS table and exposed through tenant/bot/version analytics; simulator requests write no events.

Safe provider-dependent internals are explicit **MOCK / Sandbox**. Draft generation and text suggestions require review/accept/reject and use the existing draft/Undo path. Output is deterministic local template/whitespace work, not AI. Multi-screen form drafts have a bounded internal schema, required/email local validation and ordinary JSON/draft roundtrip. They are **not Meta Flow JSON, linked provider assets, or approved WhatsApp forms**.

Current canonical status: **5 PASS / 31 PARTIAL**. F08/F09 meet their stated criteria; F24/F29/F30 move from wholly blocked to partial internal implementation, with external provider portions still blocked. Remaining requirements are listed per row in [F01-F36.md](F01-F36.md).

## Branch and compatibility

- Started from the confirmed remote handoff HEAD `9196603a5955f91ae27c15641741298ebcd0073c`. Staging remained `cc702b795f1c7aa0d0b75fec6655574f4f2ec57b` when rechecked.
- Implementation branch: `feat/premium-flow-builder-2026-10-20`; Draft PR targets `feat/stage0-foundation` only.
- Preserved the existing `nodes` plus embedded `next/yes/no/choices[].next` contract. Canvas ports use stable **choice IDs**, not array offsets. The continuation adds migration `0033_flow_runtime_controls.sql`: default-empty session runtime state, nullable wait token and a tenant-scoped RLS transition-events table. Existing node IDs, answers, old delay jobs and immutable versions are preserved; there is no replacement graph store.
- Optional `INPUT.validation`, `CONDITION.rules/match`, `TEXT.blocks`, node `label/note`, and additive executable `SET_FIELD` / `RANDOMIZER` types. Existing definitions retain their IDs and legacy behavior. Published versions remain immutable and active sessions remain pinned through the existing service.
- Pinned subflow compilation remaps structured condition fields, variable tokens, field assignments and all weighted destinations. Parent/child isolation and expansion limits remain in force.
- Standard drafts remain capped at **100 nodes**; automatic execution allows 120 transitions so valid 100-node sequential graphs can execute. This does not promise support for 200/500-node authoring.

## Implemented source changes

Canvas navigation now has visible zoom percentage, 100%, fit, wheel pan, Ctrl/Command-wheel cursor zoom, background drag, Space/middle-button pan, minimap and graph search. Normal zoom is bounded at 10–200%; fit may reach 10% on large graphs. Text becomes small at fit: use search/focus to edit at 100%.

Connections have keyboard-focusable wide hit paths, selection controls, explicit disconnect, reconnect, self/output-target rejection, a live drag ghost, Escape cancellation, and contextual component insertion. Selection supports Shift and a background rectangle, group movement, internal copy/paste with new IDs and internal links only, duplicate/delete, alignment/distribution and snapped dragging. Graph layouts no longer silently rearrange saved positions when selecting/rendering. Line paths follow movement and finalize after release.

The studio stylesheet replaces the accumulated builder layers in `vessel.css`; the builder now owns its canvas/palette/inspector/simulator and responsive rules. It retains the Vessel violet identity. Nodes have consistent SVG icons, ports, selected states and labels. Desktop properties dock beside the canvas; mobile properties occupy a separate panel. Opening properties no longer focuses or rescales the camera.

The existing rich editor now supports ordered additional text, HTTPS media and link content on a legacy TEXT node. Existing button/list/media editing is retained. Questions add explicit phone/email/number/text/date/zoned-datetime/coordinate validation, bounds and error messages. Invalid input preserves prior answers. Nested AND/OR rules support text, existence, numeric, date, membership and tag comparisons. Field assignments support bounded `{{field}}` references; weighted random branches validate a 100% total. Simulation uses the real engine, displays trace and synthetic values, highlights the current step, and mocks AI rather than contacting a provider. Internal notes never enter messages.

Saving now captures an immutable request snapshot: an old acknowledgment cannot overwrite later edits or mark them clean. Saving, failure and conflict status remain visible; local session recovery is scoped by tenant/user/bot. Recovery is offered explicitly on reload and removed on logout. Optional debounced autosave is off by default. Existing 409 merge review, immutable releases, import inspection and rollback are retained.

## Verification and evidence

Commands, actual outcomes and limits: [TESTS.md](TESTS.md). Canonical status and competitor crosswalk: [F01-F36.md](F01-F36.md). Future acceptance scenario status: [A01-A43.md](A01-A43.md).

Real Chromium screenshots (synthetic isolated fixtures):

- [Tourism canvas](../../evidence/premium-2026-10-20/tourism-canvas.png)
- [Compound condition inspector](../../evidence/premium-2026-10-20/compound-inspector.png)
- [Simulator trace and values](../../evidence/premium-2026-10-20/simulator-trace.png)
- [Composite message editor](../../evidence/premium-2026-10-20/composite-message-editor.png)
- [Weighted branch editor](../../evidence/premium-2026-10-20/weighted-randomizer-editor.png)
- [Revision conflict](../../evidence/premium-2026-10-20/revision-conflict.png)
- [100-node navigation](../../evidence/premium-2026-10-20/canvas-100-nodes.png)
- [1440](../../evidence/premium-2026-10-20/studio-1440.png), [1024](../../evidence/premium-2026-10-20/studio-1024.png), [768](../../evidence/premium-2026-10-20/studio-768.png), [390](../../evidence/premium-2026-10-20/studio-390.png), [CSS zoom 200%](../../evidence/premium-2026-10-20/studio-200-percent.png)

## Continuation screenshots

Actual Chromium captures from the updated application and synthetic fixtures:

- [Durable input policies](../../evidence/continuation-2026-10-20/durable-input-inspector.png)
- [Timeout simulator and trace](../../evidence/continuation-2026-10-20/durable-timeout-simulator.png)
- [Nested conditions](../../evidence/continuation-2026-10-20/nested-condition-inspector.png)
- [START draft triggers](../../evidence/continuation-2026-10-20/draft-trigger-inspector.png)
- [Text proposal review](../../evidence/continuation-2026-10-20/mock-text-review.png)
- [Multi-screen form draft](../../evidence/continuation-2026-10-20/multiscreen-form-draft.png) and [local sandbox](../../evidence/continuation-2026-10-20/multiscreen-form-sandbox.png)
- [Mock draft review](../../evidence/continuation-2026-10-20/mock-draft-review.png)
- [Desktop](../../evidence/continuation-2026-10-20/studio-1440.png), [mobile](../../evidence/continuation-2026-10-20/studio-390.png), [CSS 200%](../../evidence/continuation-2026-10-20/studio-200-percent.png)

## Conversation diagnostics checkpoint

Checkpoint one is saved remotely at `66031dd20bcb1301a0cb8282e4a2dbc64aa7999c`. The next coherent batch adds execution IDs and step order to new events (migration 0034), preserves old events with explicit unknown order, provides exact microsecond cursor paging, and shows actual conversation traces without answers or message bodies. Bot/tenant scope is verified before events are read. The view shows the pinned revision/current step, saved wait and continuation-job status; selecting a current draft node changes selection only. Logout invalidates pending views. The diagnostic control remains available on mobile and in simple mode.

Targeted validation: 161 Unit tests, 14 actual PostgreSQL scenarios and six Chromium/HTTP scenarios pass. Full API/runtime, broad, novice, premium and committed-trace Chromium acceptance subsequently passed on the final executable source `f7651be`; results and resumable GitHub checkpoints are saved in [CHECKPOINTS.md](CHECKPOINTS.md). See [TRACE_CHECKPOINT.md](TRACE_CHECKPOINT.md).

- [Actual session list](../../evidence/traces-2026-10-20/actual-session-list.png)
- [Ordered committed trace](../../evidence/traces-2026-10-20/ordered-conversation-trace.png)
- [Saved failed-wait diagnostic](../../evidence/traces-2026-10-20/failed-wait-diagnostic.png)
- [390px RTL trace](../../evidence/traces-2026-10-20/mobile-conversation-trace.png)

**Owner visual note:** a radical visual redesign has not been approved. Existing screenshots were judged a limited visual change. This continuation implements functionality and does not constitute visual sign-off; visual feedback and remaining functional gaps will be combined in a later assignment.

## Remaining implementation

Integration response mapping/request controls with asynchronous timeout/429/error flow routes; composite button/card/gallery/carousel nodes; broader channel/event triggers and full channel-native presentation/readiness; consent actions/metadata; configurable human availability/pause/resume policies; customer-derived timezones and closed calendars longer than eight days; experiment attribution/funnel overlays/abandonment; failed-transaction and full inbound/outbound correlation exploration; review/comment threads; external-reference remapping; group folding and pinch; physical devices/screen readers/actual browser-UI 200% and sustained memory profiling; durable recovery after closing the tab/browser and cross-tab lease/idempotency. Actual AI generation/rewriting and Meta multi-screen form compilation/reference/approval/live qualification remain external and implementation dependencies.
