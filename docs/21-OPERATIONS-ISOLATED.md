# Isolated operations and incident response

All commands here concern disposable local tests, not hosted production. No Railway or provider activation is needed.

## Offline test stack

Build first: `npm ci --ignore-scripts` then `npm run build`. Provide URL-safe random TEST_DB_PASSWORD and TEST_RUNTIME_PASSWORD (at least 20 characters), TEST_ENCRYPTION_KEY (32 random bytes, base64), TEST_RATE_LIMIT_SECRET. Do not commit them. Run `docker compose -p boat-acceptance -f deploy/compose.acceptance.yaml up --build -d`. Web binds only to 127.0.0.1:3016; PostgreSQL has no host port; the internal API/worker/DB network denies provider egress; web has a separate bridge for localhost ingress. The simulator service exercises loopback fixtures; it is not wired into production provider transports. A clean initial volume is required when changing test passwords. Preserve volumes when stopping: `docker compose -p boat-acceptance -f deploy/compose.acceptance.yaml stop`. Do not use destructive volume removal against any existing data.

Migration and grant services complete before the non-owner API/worker start. The platform admin connection is a disposable admin connection only. This file is not a production credential/grant template. Provider credentials are intentionally absent. ClamAV is not included in this isolated stack; use a separately provisioned maintained scanner/signatures to verify actual scanning; unavailable scanning remains fail closed.

## Local diagnostics

Run `node scripts/ops-health.mjs` with the non-owner runtime DATABASE_URL. JSON output contains tenant IDs, queue names, state counts and worker alarm codes only. A pending queue overdue more than five minutes, any PROCESSING/UNCERTAIN item, missing/stale heartbeat or recorded worker error creates exit code 2. PROCESSING can be a normal brief state: investigate persistence over multiple samples. Inactive companies do not require a worker heartbeat. Monitor failures produce exit 1. This is an executable local alarm, not a configured external notification service.

When a worker stops: preserve logs, verify DB connectivity/grants, inspect heartbeat and queue counts, restart one worker, observe recovery. An API can be restarted without invalidating committed DB sessions. Connection pool idle errors are logged as codes and reconnect on demand. A database outage must not lead to manual destructive resets.

When send outcome is ambiguous: leave UNCERTAIN quarantined. A 5xx, network loss, timeout, malformed successful response or interrupted durable claim cannot prove that a message was not sent. Only 429 receives automatic bounded retry; clear 4xx rejection is permanent, except ambiguous HTTP 408. Reconcile in provider logs after owner activation; never retry blindly. Webhook integrations require the receiver to honor the stable idempotency key.

## Backups, privacy and keys

`scripts/ci-backup-restore.sh` refuses to run without the disposable flag and named test container/database. It restores into a separate database, compares every public table by deterministic row-content fingerprints, and checks migrations/company/flow/catalog counts. This covers only records present in fixtures; it is not evidence for media/encrypted secrets/delayed queues that were never seeded. Restoring with --no-owner/--no-acl is deliberate for CI and does not preserve production role grants. Production requires a separate reviewed role/ACL restore and encrypted backup retention policy.

Database content includes media bytes, routing records and encrypted provider secrets. Store original encryption keys outside DB archives, backed up securely with controlled access. Restore with egress disabled; inspect pending/PROCESSING/UNCERTAIN jobs before workers can send. Confirm deletion/retention obligations separately for historical tables, backups, remote providers and unattributed older webhook events.

## Evidence limits

Engine microbenchmark measures actual validation/advance code with independent per-client states and concurrent worker threads. It excludes HTTP, PostgreSQL, catalog queries, delays and providers. HTTP benchmark covers 400 authenticated catalog reads with concurrency 40 and two API replicas. Neither proves sustained mixed-workload production capacity. Browser page traversal covers navigation/rendering at three viewports; it does not click every destructive/connect/send button or certify WCAG conformance.
