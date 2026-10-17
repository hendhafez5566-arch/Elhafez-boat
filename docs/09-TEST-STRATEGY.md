# Test strategy and release evidence

Unit: action routing, menu constraints, price and capacity calculations, consent/opt-out, AI guardrails.
Integration: tenant isolation, RBAC, database transactions, webhook signature and idempotency, retries, outbox, concurrent booking requests.
E2E: Arabic RTL dashboard, create/publish program, WhatsApp simulator navigation, Flow submission, provisional booking inbox, human takeover, stale button, unpublish, failure/recovery.
Provider acceptance: official Meta sandbox/test number first, then approved real number; record actual payloads (redacted), delivery statuses, restrictions and errors.
Nonfunctional: load/performance, accessibility, security scans, backups/restore, monitoring and alerting.
Every PR documents exact commands, pass/fail/blocked counts, environment and evidence. Never mark provider E2E passing based solely on a local simulator.
