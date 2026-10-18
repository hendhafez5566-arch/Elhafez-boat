# Verified executable-source acceptance — 2026-10-18

**PASS:** source [f82fda3](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/f82fda33efff23bbb6318208e4d88371bf574356), [CI 39126328249](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39126328249), both jobs SUCCESS; runtime job 117672117913 logs inspected. Supersedes all at-submission pending rows and intermediate failures below. No executable edits in this evidence-only update.

| Final check | Result | Actual evidence |
| --- | --- | --- |
| TypeScript/build/unit/regression | PASS | 99/99; zero fail/skip |
| Migration and tenant security | PASS | 28 migrations, RLS/FORCE gates, actor/cookie/tenant binding, phone takeover denied |
| Coexistence authorization success/cancel/expiry/reuse/failure | PASS with provider fixtures | Real HTTP API, PostgreSQL, code exchange/debug/asset checks, invalid Origin/cookie denied |
| Cloud path and registration separation | PASS with provider fixtures | Cloud authorization and register once; repeat denied; Coexistence refuses register; denied provider grant sanitized |
| Business-app Echo | PASS | Signed HTTP webhook, outbound source, human handoff, duplicate one row, no bot send |
| Customer message -> buttons/list/input -> CRM -> employee | PASS with provider fixtures | Real published engine, generated WhatsApp payloads, custom interest persisted, handoff/manual outbox reply |
| History and delayed events | PASS | Consent + once-only request, no reopened 24h window; progress cannot regress; delayed account event cannot re-enable connection |
| Actual Chromium self-service | PASS with SDK/transport fixtures | Two Arabic paths, authorized phone selection backed by real API/DB, cancelled popup, truthful incomplete-reception state, desktop/mobile screenshots |
| Broader UI | PASS for executed scope | 63 screen/viewport visits, guide/draft save/publish, catalog CRUD, roles and platform-admin company creation; not every action |
| Reliability and restore | PASS | API/worker faults, in-flight UNCERTAIN/receipt correlation, RLS grants/seeded media/keys/queue restore, real ClamAV, two-API/two-worker Compose DB outage |
| Local no-hosting alternative | PASS in disposable CI | Compose local overlay parsed/executed, owner bootstrap, actual login with random private credentials |
| Live Meta SDK/popup, eligibility and real phone | BLOCKED / NOT TESTED | Not authorized, no approved app/domain/number used |
| Complete historical media/edit/revoke and all-device/accessibility/security certification | NOT TESTED in full | Unsupported mutations do not execute the bot; old media not automatically downloaded |
| Additional cloud expenditure | None created | Railway read-only inventory/CPU/RAM; no changes, services, upgrades, domains or live Meta billable actions |

The browser bridge rewrites only test-harness Origin/cookie handling between loopback HTTP and the configured test HTTPS origin; production keeps strict Origin, HttpOnly/Secure cookies and no simulation switch. This is not a live TLS/Meta acceptance. Source uses only official provider endpoints; platform review/configuration flags default off.

Actual browser evidence: [82 PNG screenshots and metrics](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39126328249/artifacts/12136321724), including four dedicated self-service journey screenshots. Archive SHA256 `9c791334985a82e15420214386cffd3192ad5f88743e15f297fe70bac7244a1c`. These depict disposable fixtures, not an actual Meta account.

Source history: [d23f886](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/d23f8869cc78967fc76ef91d2b71149db40024c7), [bbb52f3](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/bbb52f3a08d4b846ca48ccafb5a020a5c5a6b88b), [27f9169](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/27f916931f53b1461381e47b8cea32a040e1b84a), [d7b05c9](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/d7b05c9b10649b541bf8c0d46670ad67a02d8744), f82fda3 above. Existing [draft PR #1](https://github.com/hendhafez5566-arch/Elhafez-boat/pull/1) remains unmerged and undeployed.

**Practical state:** permanent self-service source and executed fixture acceptance are delivered. A company cannot use live onboarding until the platform owner completes the one-time Meta/HTTPS/app approval setup. This task did not authorize that account operation or paid hosting. No permanent public URL is claimed. This report does not certify live provider acceptance, every UI edge, or commercial-scale readiness. Historical re-import versus later contact erasure/re-consent is not comprehensively certified; retention/backups/provider copies need the documented separate privacy process.

---

# WhatsApp Coexistence Self-Service Acceptance — 2026-10-18

## Decision

**Implemented source; live Meta and official approval BLOCKED / NOT TESTED.** No real account login, phone registration, message, campaign, credit sharing, paid provider or production deployment occurred. Same branch `feat/stage0-foundation`, draft PR #1, no merge. Starting HEAD verified `661d687389d18318217e3993fea7f65b3b3aebc4`.

## Delivered

- Permanent Arabic company self-service screen: Business App Coexistence vs new Cloud number, official SDK configuration, popup gesture, cancellation/expiry, authorized phone selection, connection/authorization/subscription/inbound/worker/uncertain-send checks, reconnect and explicit local disconnect.
- Authenticated owner-only API and 10-minute one-use attempt, exact Origin check plus HttpOnly/Secure/SameSite Strict browser nonce, tenant/user binding, durable claim before code exchange, actual token app/scopes/WABA target checks and phone ownership verification. Tokens never return to browser; temporary phone-selection token is encrypted and scrubbed when completed/cancelled/expired.
- Migration 0028 adds RLS/FORCE tenant-scoped attempts, operations and dedupe metadata; original phone uniqueness and encrypted-account identity remain. Same company can reconnect; another cannot take its phone. Disconnect can invalidate outstanding attempts, and completing a revoked attempt cannot re-enable the account.
- Server-side WABA subscription and verification; new-number register operation uses an owner-supplied protection PIN only when needed. Coexistence does not call register. History/contacts requests have explicit consent and durable per-onboarding claims. Uncertain writes are not retried automatically.
- `smb_message_echoes`, `history`, `smb_app_state_sync` adapters and `account_update` offboard/reconnected processing. Echo is outbound BUSINESS_APP, never customer/bot input; history is imported without bot execution or a new 24h window. Provider timestamps, receipt keys and non-regressing history progress handle duplicates/delay. Phone-book removal does not erase CRM. Account events do not auto-restore authorization. Known-expired credentials cannot dispatch.
- SDK hosts are allowed only in dashboard CSP; SDK loads only after owner intent. Legacy manual configuration remains collapsed for compatibility.
- Safe local trial profile and private random-secret setup script, separate from cloud resources; owner and company guides plus cost report.

## Documentation and external dependencies

[Platform owner setup](docs/25-META-PLATFORM-SETUP.md), [company self-service guide](docs/26-COMPANY-WHATSAPP-SELF-SERVICE.md), [cost/local environment](docs/27-LOCAL-PILOT-AND-COST.md).

Meta's direct official pages returned HTTP 429. Meta's official Postman collection was available; Coexistence schemas were inspected from a cached transcription explicitly naming the original Meta documentation. Exact field/action contracts used include message_echoes, history/threads, state_sync add/remove, ACCOUNT_OFFBOARDED and ACCOUNT_RECONNECTED; source URLs and freshness limits are recorded in the platform guide. We do not claim direct verification of current app eligibility/review requirements. Default flags remain disabled until the platform operator confirms supported current configurations and official approval. No unofficial WhatsApp API is used.

## Executed evidence / final-source revalidation

Local `npm run check`: **99/99 PASS**, zero fail/skip. Includes original suite plus origin/readiness/permissions/debug-token checks, postMessage origin/schema rejection and app/history normalization.

Initial source commit d23f8869cc78967fc76ef91d2b71149db40024c7, [CI 39125372793](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39125372793): checks PASS (99/99, migration/RLS); runtime API/DB coexistence cases PASS. Browser initially FAIL because the test-only HTTP-to-HTTPS-origin bridge passed duplicate differently-cased Origin headers. Production exact-origin rejection worked; fixed the harness using Headers.set, keeping all assertions and production protection. This initial failed run is not final acceptance.

| Required case | At implementation submission | Evidence boundary |
| --- | --- | --- |
| Business App vs new number UI | Implemented; final browser rerun pending | Actual HTML/JS, not a generated mockup |
| Embedded Signup | SDK contract fixture; NOT live | FB.login configuration, no Meta account accessed |
| Authorization success | PASS API/DB fixture | Real handler/exchange path with loopback provider |
| User cancellation | PASS API; browser rerun pending | Attempt cannot be reused |
| Expired/failed authorization | PASS expiry/token unit checks | No live token used |
| Correct company ownership | PASS | Actor scope + cookie + WABA target and phone membership |
| Second company takeover denied | PASS | Existing unique account and RLS boundary |
| Customer inbound/buttons/list/CRM | Final new HTTP case pending | Existing platform/engine checks remain; not live WhatsApp |
| Handoff/manual reply | Final new HTTP case pending | Real queue/CRM assertions, not provider delivery |
| App echo no bot | PASS | Signed HTTP webhook, duplicate one row, no outbox growth |
| Delayed/duplicate/history events | PASS | No opened service window, progress does not regress |
| API/Worker restart | Existing acceptance gate rerun pending | Real CI processes / Compose, not provider restart |
| Diagnostics/disconnect/reconnect | Existing gate + new handlers rerun pending | No automatic uncertain resend |
| Secrets/roles/RLS | PASS local/checks; broader runtime rerun pending | No penetration certification |
| Live Meta / actual phone | BLOCKED / NOT TESTED | Explicitly not authorized in this task |
| Staging / extra cost | No cloud resources created | Read-only Railway inspection; cost cannot be guaranteed |

## Important practical limits

No publicly deployed URL exists. No promise of live self-service availability until HTTPS/domain, Meta app configuration, App Review/Advanced Access/Tech Provider eligibility and a separately authorized real acceptance are complete. Lack of access/approval is shown to company owners, not disguised as success. Public connection flags only state availability of a configured path, never prove phone eligibility.

Cloud phone registration, approved subscription and worker health do not prove live inbound/outbound delivery. Old media is represented by message type, not automatically downloaded. Historical contacts and conversations have bounded imports; full edit/revoke/media synchronization, physical-device behavior, all UI buttons and comprehensive security certification remain NOT TESTED in full. In-flight requests may already reach Meta before a phone-app echo/offboard event arrives; the system cannot retract a send, and UNCERTAIN remains quarantined. Customer service windows use actual customer timestamps; history/echo do not extend them.

Zero additional cloud commitment: Railway read-only inspection found 3 projects/10 services; current CPU/RAM samples are not a billing balance. No resources, plans, domains, limits or existing projects were modified. No live Meta billable action occurred. Local alternative is documented; permanent zero-cost SaaS hosting cannot be guaranteed from available account data.

### Intermediate acceptance correction
CI 39125716535 retained the rate limiter and rejected the new functional scenario with HTTP 429 because it reused an owner that had just exceeded its budget in the deliberate mixed-load test. The acceptance fixture now provisions independent owner identities in the same disposable companies; no production limit is increased or bypassed. The prior bridge Origin correction also keeps exact-origin validation intact. Final rerun supersedes neither failure until completed successfully. Additional source guards reject existing Business App numbers on the new-Cloud path, ignore edit/revoke as new bot input and preserve history outbound messages addressed by thread ID.
