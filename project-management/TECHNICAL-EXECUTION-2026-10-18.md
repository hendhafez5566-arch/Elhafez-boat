# Technical execution — 2026-10-18

## Delivery and authorization

Continued actual HEAD `c0a3f27a85a405816b43a23f6f627d0387b8f287` on `feat/stage0-foundation`, PR #1 draft. No merge, deployment or external provider account activation. Tests used disposable fixtures only.

Source commits: [eec89da](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/eec89da93552ef4c7ff8a23a4be2f9b1802ae9be), [314a961](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/314a961ca205dad9f1da7d2732baf1bf9eb6ff61), [91eddd2](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/91eddd2858b1a6565fa0acc360d0cd8e1eb20a04), [76c4b89](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/76c4b896626eef67f3e7fcdd1436a9308d856708), [d5ac76c](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/d5ac76c9a6b431608db21f6fee254583d546a9a5).

## Repaired behavior

1. WhatsApp previously retried HTTP 5xx as PENDING although a send could already have been accepted. New shared production sender/disposition quarantines 5xx/408/network failure/invalid-success bodies as UNCERTAIN; 429 preserves bounded retry and explicit clear 4xx rejects permanently. No redirect forwarding; fixed provider host and validated account path; bounded response buffer. Tests call the actual production send function with an injected loopback transport, without adding a production simulator URL/environment bypass.
2. Idle PostgreSQL disconnect could emit an unhandled pool error and terminate API/worker/platform API processes. All three pools now handle/log a code and reconnect. Runtime tests terminate idle connections and reauthenticate/query successfully, including the platform pool; tenant tokens remain denied platform access.
3. Worker heartbeat could retain stale errors after successful recovery. Successful heartbeat clears the error code.
4. First isolated Compose run failed host-to-web access (curl exit 7). Web now has a separate ingress bridge while API/worker/DB remain on the internal network; localhost port and full database outage recovery then passed. No test assertion was removed.

## Executed evidence

[CI 39108014870](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39108014870) passed both jobs for source 76c4b89. Logs read directly. New security regression suite passed locally **78/78** and is in d5ac76c; its own CI is [39108108402](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39108108402), which also **PASSED both jobs**, including **78/78** regression tests, full runtime/Chrome/restore/Docker/Compose outage and worker alarm checks. Both job logs were inspected directly.

| Check | Result | Limits |
| --- | --- | --- |
| TypeScript/build and regression suite | PASS; 78/78 locally, zero skipped/fail | Existing baseline was 70; 4 delivery + 4 security cases added |
| Migrations and tenant RLS | PASS; 25 migrations, real restricted runtime role | Targeted fixture gates, not a full penetration audit |
| API/worker faults | PASS; API SIGKILL/restart; worker kill with pending delay recovered once; idle connection termination | Not a worker killed during an actual external provider send |
| Shared rate limit | PASS; 40 attempts, exactly 20 accepted and 20 rejected | Across independent clients with one shared identity |
| Two-replica HTTP read load | PASS; 400 requests, concurrency 40 | Catalog reads only, short CI sample |
| Engine microbenchmark | PASS; 4 threads, 16 logical tenants, 1600 clients, 160000 conversations / 320000 advances | In-memory engine, excludes HTTP/DB/queues/providers |
| Chromium | PASS; 19 owner pages × 3 viewports = 57 visits; actual login, editable canvas, logout, no JS exceptions/server 5xx; named buttons | Navigation/rendering coverage, not every form/action or WCAG certification |
| Screenshots | PASS; 60 actual PNGs | [Captured artifact](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39107646599/artifacts/12128977727); no credentials in archive |
| Provider simulators | PASS; production WhatsApp sender against HTTP fixture for 429/500/reset/redirect/malformed/oversized responses | Other requested providers have harness fixtures only; production connector OAuth/refresh/signature paths are not fully simulated |
| Security regression | PASS; raw HMAC tampering/forgery, GCM tampering/wrong/missing key, private/metadata/IPv6 SSRF boundaries, scope lookalikes | Not comprehensive SQLi/XSS/DNS-rebinding/browser privilege escalation testing |
| Restore | PASS; separate database, exact deterministic fingerprints of every present public-table row; 25 migrations, 2 companies, 2 published flows and catalog | --no-owner/--no-acl; no proof for unseeded media/ciphertext/pending queues or production grants |
| Docker/Compose | PASS; real image, migrations/grants, 2 API / 2 worker replicas, simulator suite, internal backend network, persistent row and whole DB stop/start without app restart | Disposable stack only; ClamAV not included |
| Local operational alarm | PASS in Compose; JSON count/code output, no secret/customer payloads | External notification delivery/scheduling is not configured |

### Measured HTTP resource sample (CI 39108014870)

400 authorized reads took **719.78 ms**, **555.73 requests/sec**; **P50 61.24 ms / P95 185.27 ms / P99 204.39 ms**. This sample includes worker startup and is not a sustained capacity guarantee.

| Process | CPU time during sample | Peak sampled RSS |
| --- | ---: | ---: |
| API | 400 ms | 80,130,048 bytes |
| API replica | 400 ms | 80,416,768 bytes |
| Worker | 0 ms at OS clock tick resolution | 68,214,784 bytes |
| Restarted worker | 160 ms | 66,428,928 bytes |

Earlier run 39107646599 measured 625.92 req/s (P50 47.88 / P95 177.55 / P99 186.05 ms) without resource sampling. These are separate runs; do not combine their values as one measurement. Peak RSS is sampled, not a guaranteed absolute peak; CPU excludes PostgreSQL. Local engine-only sample was 147.24 ms, P50 0.00117 / P95 0.00207 / P99 0.00419 ms per two-advance conversation, process CPU 731434 microseconds and peak sampled process RSS 145940480 bytes. Different machines/scope; not comparable to HTTP throughput.

### Latest source sample (d5ac76c, CI 39108108402)

**78/78 tests, zero failures/skips**, both jobs passed. 400 requests/concurrency 40/two APIs/two workers: **752.39 ms, 531.64 req/s, P50 66.08 / P95 184.46 / P99 218.88 ms**. API CPU 420/430 ms, peak sampled RSS 80,326,656/81,313,792 bytes; workers CPU 0/170 ms (clock tick resolution), sampled RSS 67,977,216/66,400,256 bytes. Same short catalog-only scope. [Latest screenshots and raw HTTP/browser metrics](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39108108402/artifacts/12129078178).

## Status and remaining scope

**PASS:** the targeted executed gates above. **FAIL:** no unresolved failure in the passing run; initial Compose ingress failure was fixed and retested. Any later CI failure must supersede this statement for that HEAD.

**BLOCKED / intentionally deferred by owner:** all live Meta/WhatsApp/Google/Shopify/HubSpot/WooCommerce/Telegram/AI-provider activation. No Railway connection or paid cloud deployment occurred.

**NOT TESTED:** sustained mixed-company HTTP/message/inbox/catalog/leads/subflow/delay load and PostgreSQL EXPLAIN/query bottleneck analysis; true in-flight external-send crash/receipt reconciliation; complete production connector adapter OAuth/refresh/signature/429/timeout/idempotency matrix; all browser buttons/forms/error states including platform admin UI, physical mobile and formal accessibility; real ClamAV/EICAR and scanner recovery; DB restore with deliberately seeded encrypted secrets/media/pending queues and separately restored least-privilege role grants; full privacy retention/deletion races, historical/backup erasure, and comprehensive SQLi/XSS/SSRF/DNS-rebinding/replay penetration campaign. These are real technical acceptance tasks, not all dependent on connecting live accounts.

The product is **not declared fully technically closed or commercially ready**. Owner activation is not the only outstanding action. See [owner checklist](../OWNER-ACTIVATION-CHECKLIST.md) and [operations/incident guide](../docs/21-OPERATIONS-ISOLATED.md).
