# Ordered conversation diagnostics — stable checkpoint

Parent saved and verified on GitHub: `66031dd20bcb1301a0cb8282e4a2dbc64aa7999c`. This executable batch is saved and verified as `f7651bedb086fcc7f39ef75e616920b63a0e91a5`. Same execution branch and Draft PR #5. F35 stays PARTIAL; no other F status is promoted.

Migration 0034 adds nullable execution/order/time metadata to the existing RLS events table; older rows are retained and identified as unordered. New committed traces share an execution UUID and statement timestamp and have exact step ordinals. Conversation event pages use a microsecond timestamp/UUID/ordinal/row-ID cursor to avoid skipped or repeated events. Existing pinned sessions, answers and versions are untouched.

Read-only APIs list the newest 20 saved bot sessions or paginate a specific session up to 500 events/page. They validate bot/tenant association before reading events, including legacy NULL-bot sessions. They expose version, current node, saved wait and continuation-job status, identifiers, outcome and elapsed time. No answers, message bodies, contact names, provider secrets or raw failure payloads are selected.

The UI opens actual committed traces, groups steps by execution, shows historical uncertainty and focuses a current-draft node without editing it. Mobile 390px layout is tested. Logout closes the views and prevents a delayed authenticated response from restoring them. The failed-continuation screenshot uses an explicitly seeded FAILED job snapshot; it does not claim a newly tested external-provider failure.

Validated at this checkpoint:

- `npm run check`: 161 PASS; build/typecheck succeed.
- `TRACE_BROWSER_FIXTURE=1 MIGRATION_DATABASE_URL=<disposable-admin-url> node tests/flow-controls-db.mjs`: 14 PostgreSQL scenarios PASS with a non-owner/non-BYPASSRLS role; includes all earlier ten control cases, exact trace pagination/order, tenant/wrong-bot denial, old unordered rows and saved FAILED job status.
- `CI_DB_INTEGRATION=1 MIGRATION_DATABASE_URL=<disposable-admin-url> node tests/db-integration.mjs`: actual RLS/FORCE and cross-tenant checks PASS.
- `WEB_BASE_URL=<loopback-web> node tests/flow-trace-browser.mjs`: six real HTTP/Chromium scenarios PASS; four application screenshots and machine results committed.

The fixture JSON is written only under ignored `acceptance-evidence/` with mode 0600. It contains disposable synthetic credentials, is never printed/committed/uploaded, and no external provider is contacted. CI prepares this fixture before starting background workers, then invokes the trace browser during runtime acceptance.

Combined API/broad/novice/premium/trace acceptance subsequently completed with EXIT 0 on the executable source. Post-acceptance independent-bot/legacy/team/CRM tests and repeat migration checks also passed. See `verification.txt` and `CHECKPOINTS.md`.

Remaining: failed/rolled-back inbound transactions may have no event. This is a committed-transition diagnostic, not complete error/delivery telemetry. Retention, full inbound/outbound correlation, experiment/funnel attribution and the other matrix gaps remain. The owner has not approved a radical visual redesign; these functional diagnostics do not change that decision.
