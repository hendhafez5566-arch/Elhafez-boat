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
