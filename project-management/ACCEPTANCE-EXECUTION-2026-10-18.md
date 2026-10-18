# Technical execution update — 2026-10-18 (authoritative latest entry)

Owner constraint: **no external platform activation**, no merge/deploy. Starting HEAD c0a3f27; source fix eec89da93552ef4c7ff8a23a4be2f9b1802ae9be.

PASS evidence: [CI 39107646599](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39107646599): 74/74 unit/regression checks, migrations/RLS, two-API restricted-role runtime, API SIGKILL/restart, worker loss with pending delay continuation exactly once, idle PostgreSQL connection termination/recovery, shared throttle 20 accepted / 20 rejected out of 40, 400 authenticated catalog reads at concurrency 40: **625.92 req/s, P50 47.88 ms / P95 177.55 ms / P99 186.05 ms**, 57 page/viewport visits (19 owner pages × desktop/tablet/mobile), no JS exception/server 5xx, 60 actual PNG screenshots, database restore counts and Docker packaging. Screenshots/metrics: [artifact 12128977727](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39107646599/artifacts/12128977727).

Source fixes: ambiguous WhatsApp 5xx/408/network/invalid-success results quarantine UNCERTAIN, 429 bounded retry preserved, redirects blocked, account identifier validated, response size bounded; idle DB pool errors handled in API/worker; successful heartbeat clears stale error. Loopback WhatsApp production-send tests plus fixtures for all requested provider families. Other provider fixtures exercise simulator contracts, **not end-to-end production connector OAuth/signatures**.

Added further execution: isolated Compose (2 APIs/2 workers/network egress disabled), all-table restored row fingerprints, read-only local operational alarm and maintenance guide. These additions require their own latest CI evidence below; initial CI above does not establish their success.

NOT TESTED / remaining: sustained mixed HTTP/message/catalog/lead/subflow/delay load with DB query profiling and per-server CPU/RAM; in-flight provider-send worker kill and receipt reconciliation; every UI action/form and platform administration, formal WCAG, real ClamAV/EICAR, restore with seeded encrypted secrets/media/pending queues and independent production grants; full SQLi/XSS/SSRF/DNS-rebinding/replay penetration campaign; complete adapter-level provider OAuth/refresh/signature failure matrix. Provider fixture schemas alone cannot close these.

BLOCKED by owner decision: **all live provider activation**, intentionally deferred. Local container/DB/browser binaries unavailable; real runtime evidence is from disposable GitHub CI. No commercial readiness claim. Owner steps: [OWNER-ACTIVATION-CHECKLIST.md](../OWNER-ACTIVATION-CHECKLIST.md). Operations: [docs/21-OPERATIONS-ISOLATED.md](../docs/21-OPERATIONS-ISOLATED.md).

Earlier historical status entries below are retained for traceability and superseded where inconsistent.

---

# Elhafez Boat — Actual runtime + browser + backup acceptance evidence (2026-10-18)

**Result: targeted acceptance gates PASS in disposable CI. This is not external-provider validation or permission for a commercial launch.**

- Repo: `hendhafez5566-arch/Elhafez-boat`
- Branch: `feat/stage0-foundation`, PR #1 **DRAFT**, no main merge or production deploy.
- Evidence for latest tested implementation: [GitHub Actions run 39105138303](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39105138303).
- Existing `checks` job PASS: **70/70 Node tests**, TypeScript/build, migrations **0001–0025** on PostgreSQL 16 and tenant RLS/Commerce cross-tenant gate.
- New `acceptance-runtime` job PASS: genuine API/web/browser/worker and backup checks below.

## What actually ran

1. **Real least-privilege PostgreSQL role**: disposable login with `NOSUPERUSER NOBYPASSRLS` and table/sequence grants, not an admin connection. No real customer data, secrets, or production DB.
2. **Two independent companies**: log in as both owners; verify authenticated identities and unauthorized session response. Company A published catalog and FAQ are invisible to B; B's update against A's catalog ID is rejected.
3. **Create and publish an actual chatbot** through the HTTP API. Published version and preview behavior checked: greeting text plus interactive buttons, versions scoped to the company.
4. **Real Website Chat**: configure exact origin; visitor starts a session, receives company-published greeting, selects an employee button, becomes an actionable `READY_FOR_AGENT` lead, and appears in the unified staff inbox with `HUMAN` ownership. An unauthorized website origin cannot reuse session; duplicate message ID produces no duplicate state transitions. Company B cannot view A's leads.
5. **Live background worker**: starts with the limited runtime role and records tenant-scoped heartbeat for both companies. A second published flow with a one-second DELAY resumes automatically through PostgreSQL queue, and exactly one follow-up message appears to the visitor.
6. **40 concurrent catalog HTTP reads** completed in **124 ms** on that ephemeral CI run; useful smoke evidence only, **not a production load benchmark**.
7. **Headless Google Chrome**: Arabic RTL dashboard, real owner form login, Flow Builder Canvas loaded from the authenticated API, desktop viewport **1366×900**, mobile **390×844**, logout and token invalidation. Five captured PNG screenshots are available in the run's short-lived artifact `elhafez-browser-acceptance` (dashboard, desktop builder, desktop canvas, mobile builder, mobile canvas).
8. **Backup/restore actually executed**: PostgreSQL 16 `pg_dump` custom archive, restore into a new disposable database using `pg_restore`; verified **25 migrations, 2 companies, 2 published flow versions and a catalog record** survived.

## Initial failure and correction

The first real browser acceptance run failed because the **test itself submitted login before JavaScript initialized**. Diagnostics showed the form event handler was not yet bound. Corrected the test to wait for `login-form.onsubmit` before submitting, reran on GitHub and obtained a passing browser login. No backend or user-authentication bypass was needed.

## New automated test files

- `tests/runtime-acceptance.mjs`: disposable DB fixtures, non-owner runtime, tenant boundaries, published bot, website chat, worker, delay, concurrent reads, browser run and logout.
- `tests/browser-acceptance.mjs`: DevTools Protocol browser acceptance using installed Chrome and Node's built-in WebSocket. It does not install a hidden/mock browser or use hardcoded real passwords.
- `scripts/ci-backup-restore.sh`: real snapshot/restore in disposable GitHub PostgreSQL Docker service only; fails closed without `CI_ACCEPTANCE_DISPOSABLE_DB=YES`.
- `.github/workflows/verify.yml`: independent new `acceptance-runtime` job, real PostgreSQL service, Node 22, browser screenshot artifact. The original `checks` job remains enabled, unchanged in meaning.

## Important unresolved items — do not mark commercially ready

- **Live providers**: Meta WhatsApp Cloud API/templates/catalog/product carousels, Messenger/Instagram, Telegram, Google OAuth/Sheets, Shopify, HubSpot, WooCommerce and outbound webhooks need real accounts, permissions, callback HTTPS, valid provider credentials and on-provider success/failure evidence. None of those are claimed live here.
- **AI provider & media scanning**: optional remote AI response behavior and actual ClamAV signatures/socket/quarantine need real controlled environments.
- **Production operations**: real multi-instance throttle/load/abuse, uncertain-provider delivery reconciliation, rollback during provider downtime, backups/restores **with platform roles and live storage**, monitoring/alerting, security/privacy compliance, mobile accessibility across devices, and real customer pilot still require work.
- Browser tested Chrome desktop/mobile *viewports*, not physical mobile browsers or every workflow screen. A single 40-request CI smoke is not a credible throughput/load certification.
- `acceptance-evidence/browser-account.json` contains only disposable CI fixture credentials, **not uploaded** as an artifact. Only `*.png` evidence is uploaded; credentials are intentionally never committed.

**Verdict:** concrete working paths have passed now. Keep PR #1 draft/unmerged until provider activation and the remaining operational acceptance are reviewed by the owner.


## Additional container-packaging verification

Following the above acceptance, [CI run 39105618688](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39105618688) **PASSED both jobs** after adding `.dockerignore` and the packaging smoke step:

- The multi-stage `Dockerfile` built a real `node:22-alpine` image from source using `npm ci` and `npm run build`.
- A disposable image inspection confirmed compiled API present and no `/app/.env` or hidden real secret file in the image.
- A real Docker web process served dashboard `/`, `/flow-builder.js` and `/widget.js` successfully over HTTP.
- The `.dockerignore` now prevents untracked secrets, Git history, local `node_modules`, exports and screenshots from entering Docker build context.
- Original 70/70 checks, browser/runtime/widget/worker/DELAY and backup/restore gates remained passing.

This is **packaging and static HTTP acceptance**, not production Docker Compose networking/TLS, Meta webhook, provider authorizations or multi-replica reliability validation. No deployment happened.
