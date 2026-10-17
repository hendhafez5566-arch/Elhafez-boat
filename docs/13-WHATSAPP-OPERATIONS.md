# Official WhatsApp integration — implementation and operations (2026-10-17)

**WARNING: code exists, but no live Meta account has been connected or provider acceptance performed.**

## Implemented backend building blocks

- `apps/api/src/whatsapp.ts`: POST webhook signature validation (`X-Hub-Signature-256` using `META_APP_SECRET`), GET challenge verification, tenant phone number routing and authenticated per-tenant account linking. Link requests verify a supplied access token against Meta before storing it using AES-256-GCM. Plaintext access tokens are NEVER returned by an API.
- `apps/api/src/flows.ts`: one-time, tenant/account/conversation-bound Flow token issuance and checked `nfm_reply` handling; program availability and server-owned price snapshots.
- `apps/worker/main.ts`: dedicated database-backed outbound queue, row-level locking, status tracking and exponential retries for definitive transient Meta errors. Unknown outcome is quarantined for manual reconciliation, not automatically retried. Enforces 24-hour customer service window for text/interactive messages.
- `0006_whatsapp_inbox.sql`, `0009_whatsapp_flows.sql`: official channel accounts/routes, idempotency receipts, conversation state, messages, outbox and published Flow configuration. All tenant-owned tables have tenant-scoped RLS. `whatsapp_routes` intentionally stores only phone ID and tenant/account routing pointers (NO credential/PII) for webhook lookup.
- Inbox API: list conversations, read message history, human takeover/release, queue an agent reply. Opt-out API and inbound STOP/START service-message preference handling.
- Outbound WhatsApp catalog: published programs only; interactive lists capped at 10 rows, buttons at 3; home/previous/next/handoff and provisional booking. Bot never confirms a booking or invents prices.
- Optional Meta-published booking Flow per connected account; if disabled, the customer can send name and party size in bot conversation instead. `meta/booking-flow-template.json` is a **draft asset**, not guaranteed to be accepted by Meta until uploaded, validated and published there.
- Agency UI: WhatsApp connection, Flow settings, real inbox/handoff, agent reply with delivery disclaimer.

## Configuration (never commit live secrets)

- `META_GRAPH_VERSION`: currently supported version verified at provisioning time.
- `META_APP_SECRET`: shared app secret supplied by Meta; required for webhook signature check.
- `META_WEBHOOK_VERIFY_TOKEN`: high-entropy secret shared with Meta configuration.
- `WHATSAPP_TOKEN_ENCRYPTION_KEY`: 32 random bytes, base64 encoded; store in secret manager and back up securely. Losing it makes stored access tokens undecryptable.
- `DATABASE_URL`: non-owner, non-superuser, non-BYPASSRLS runtime role with only required table permissions.
- `MIGRATION_DATABASE_URL`: separate restricted migration/admin role used only for schema changes.

Webhook URL for deployment: `https://YOUR_HOST/api/v1/whatsapp/webhook`. Register in Meta, subscribe to message and status updates. Meta must reach this over HTTPS.

## Official onboarding / rollout still pending

1. Set up and verify Meta business app, WABA and phone number with user's account approval.
2. Configure app secret, verify token, graph version and encryption key outside Git; enable production webhook endpoint.
3. Upload, validate and publish Flow JSON in Meta; set Meta published Flow ID from the company dashboard. Meta API changes may require updating template syntax.
4. Confirm exact app/number eligibility, coexistence rules, service-window rules and template approvals with current Meta documentation.
5. Verify real Meta send/receive, interactive list and Flow responses, duplicate webhooks, retries and human handoff in a staging account; document exact results.
6. Add approved template campaigns, delivery reconciliation, token rotation and live operational alerts before general sale.

**Current limitation:** the worker uses PostgreSQL outbox transactions. A worker process crash after Meta accepts a send but before DB commit can still leave an ambiguous outcome. This requires provider-status reconciliation and operational alerting before high-volume commercial use; exactly-once external delivery is NOT claimed. `last_error` contains a sanitized Meta HTTP status, not secret request payloads.