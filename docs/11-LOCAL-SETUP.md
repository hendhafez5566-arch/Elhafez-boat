# Run the current generic chatbot platform

Node.js 22+, npm and PostgreSQL 16+. The source builds; database/browser/live-provider acceptance is still pending. See project-management/REMAINING.md.

## 1. Dependencies and environment

```
npm ci --ignore-scripts
cp .env.example .env
npm run build
```

Fill `.env` privately. Never commit it. `MIGRATION_DATABASE_URL` uses a privileged migration role. `DATABASE_URL` MUST use a separate non-owner, non-superuser, non-BYPASSRLS runtime role. `PLATFORM_DATABASE_URL` is the separately controlled administrative connection. Do not use production/customer data for acceptance.

Provide PostgreSQL yourself, or use the repository's local PostgreSQL service (`docker compose up -d postgres`) when Docker is installed. Redis is not required by the current PostgreSQL-backed conversation/outbox runtime.

## 2. Schema and first company

```
npm run db:migrate
npm run db:bootstrap
```

Migrations 0001–0024 preserve historical tables and add the generic chatbot features. Bootstrap requires BOOTSTRAP_TENANT_SLUG, BOOTSTRAP_TENANT_NAME, BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD; creates one company, owner membership and 14-day trial. Use unique values; it is not an idempotent account reset. Remove bootstrap secrets after provisioning.

The DB administrator must grant the runtime role schema usage and the table/sequence operations used by these services, including new chatbot tables and opaque routing tables. Do not grant ownership or BYPASSRLS. Table grants/RLS must be checked with the actual runtime role in final acceptance; this environment did not exercise them.

## 3. Start three processes

```
npm run dev:api
npm run dev:web
npm run dev:worker
```

Run `npm run build` ONCE first, then use separate terminals; these load the untracked root `.env`. Restart after rebuilding source changes; API/worker dev commands execute compiled JS and do not concurrently delete/rebuild output. Default dashboard: http://localhost:3000 . Internal API: http://localhost:4000 . Browser requests are proxied through the web server to the internal API.

Log in with the bootstrapped company slug, email and password. No universal/default password is committed. Create catalog drafts and publish them; create FAQ drafts and approve them; design/save/validate/publish a flow. Authenticated preview uses the actual server interpreter and does not send WhatsApp/webhook messages. AI preview may use the optional provider and consumes AI usage. Live customer traffic requires Meta activation below.

The main workspace contains real authenticated data only. Flow preview is separately labelled and does not send messages/webhooks. Its Delay continuation button simulates time only in preview.

## 4. Platform owner

```
npm run db:platform:bootstrap
```

Set PLATFORM_DATABASE_URL, PLATFORM_OWNER_EMAIL and PLATFORM_OWNER_PASSWORD privately first. Open http://localhost:3000/platform.html and log in with that separate owner account. Existing company provisioning, invitations and subscription controls are distinct from tenant login. Platform consumption/error-monitoring features remain incomplete.

## 5. Optional external activation

- WhatsApp: configure META_GRAPH_VERSION, META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN and a preserved base64 32-byte WHATSAPP_TOKEN_ENCRYPTION_KEY. Connect actual Phone Number ID/WABA ID/access token in the company WhatsApp screen. Expose HTTPS `/api/v1/whatsapp/webhook` for Meta verification/subscriptions. App/account permissions and approved templates must be supplied and verified with the actual account. Never publish tokens in Git or screenshots.
- AI: AI_BASE_URL (OpenAI-compatible base ending in `/v1/` as appropriate), AI_MODEL, AI_API_KEY. Enable per-company AI and set its cap in the UI. Without credentials, exact approved-source answers and fallback remain available. Provider selects approved source IDs; it cannot author business prices.
- Integrations: set exact hostnames in OUTBOUND_WEBHOOK_HOSTS for API and worker; blank disables destination registration/execution. Optional OUTBOUND_WEBHOOK_SIGNING_SECRET adds HMAC-SHA256 over raw JSON to `x-elhafez-signature`. Receiver must deduplicate `idempotency-key`. Only HTTPS/public IPv4 destinations are supported, without redirects, IP literals, URL credentials or query strings.
- REST keys: platform company OWNER can issue one-time-visible 90-day keys on the integration screen, restricted to catalog/lead GET reads. Use `Authorization: Bearer ebk_...` and protect the returned key privately.
- Templates: supported approved body/text-header variables, media headers, URL/quick-reply parameters and static phone buttons are validated against provider metadata. Unsupported carousel/auth/named formats are rejected. Campaigns select consenting recipients and template-only steps at least 24 hours apart; cancellation suppresses pending work. No actual Meta send was tested.

## 6. Verification gates

Routine development safeguards: `npm run typecheck`, `npm run build`, `node --check <changed-js-file>`. These passed locally for this delivery.

After unfinished build scope is completed, run ONE combined acceptance campaign. Entry points include `npm test` and `CI_DB_INTEGRATION=1 node tests/db-integration.mjs` (requires MIGRATION_DATABASE_URL pointing to a disposable migrated database with permission to create a temporary test role). The integration gate rolls back its fixtures/role. It does not substitute for full API/browser/Meta/AI/performance/recovery/backup-restore acceptance.

No live Meta/AI/database/browser success or commercial readiness is asserted by these instructions. Retired `/programs`, `/bookings`, `/departures`, `/offers` and `/bot` routes return 410; use generic `/catalog` and `/flows`.


## New runtime configuration and workflow

Migration 0022 adds runtime tables and allows website contacts without phone numbers. Grant the runtime role the required operations on all new tenant tables plus opaque widget/web/media routing tables; retain NON-BYPASSRLS/non-owner status. Platform role needs explicitly authorized access to usage/campaign/runtime tables for admin operations. Verify grants in final acceptance.

- Website: configure exact origins in the website screen (HTTPS; localhost HTTP for local development). Copy the generated widget script into that site. Serve the app over reachable HTTPS and permit its domain in the embedding site's CSP script/connect rules. Visitor requests use opaque session tokens and exact origin checks. Staff uses the unified conversation inbox. Widget polling is not native push.
- Media: MEDIA_PUBLIC_ORIGIN must be the exact reachable HTTPS origin, without trailing slash. Uploads remain manageable without it, but no functional external media URL is claimed until it is set. The library supports bounded formats; managed WhatsApp images must be JPEG/PNG and OGG audio must be Opus. Remote content is ultimately validated by Meta. MIME signatures are not malware scanning.
- Integration secrets: set INTEGRATION_SECRET_ENCRYPTION_KEY to independently generated 32-byte base64 secret on API AND worker. Preserve it. The integration screen encrypts Bearer/HMAC secrets, supports replacement and disable; list responses never return plaintext secrets. Exact OUTBOUND_WEBHOOK_HOSTS remains mandatory. Public IPv4 transport is pinned; public IPv6 DNS records can coexist, but IPv6-only destinations are unsupported.
- Delay: 1 second–7 days, worker must run. Staff takeover/closure/opt-out cancels pending continuation. WhatsApp after 24 hours is blocked; use a consented approved template sequence instead. Preview's explicit resume control does not prove scheduler execution.
- Campaigns: create a draft with fixed template values and optional tag/custom-field segment. Max 1000 recipients, ten steps, thirty-day horizon and at least 24 hours between template steps. Launch freezes currently consenting recipients; worker rechecks consent, creator permissions and subscription and enforces usage/cooldown. No queued status means delivered. Some temporarily blocked jobs are deferred; failures/uncertain sends must be reconciled.
- Outbox: a durable PROCESSING claim is committed before HTTP; stale claims become UNCERTAIN. Do not automatically resend UNCERTAIN jobs. Provider timeout/crash/DB failure requires reconciliation with actual delivery evidence.
- Published-flow draft saving requires expectedRevision; the UI supplies it. A 409 means reload rather than overwrite another editor. Publishing rejects active triggers pointing at removed nodes.

Template schema reference consulted during implementation: Meta's official WhatsApp collection at https://www.postman.com/meta/whatsapp-business-platform/ and hosted SDK component reference https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/types/component_object/ . Provider validation remains the final authority; no live integration success is inferred from documentation.

Advanced connectors, social channels, privacy, rate-limit secrets and ClamAV configuration: [advanced runtime](19-ADVANCED-RUNTIME.md). Set RATE_LIMIT_SECRET before API authentication; media remains private until ClamAV scanning succeeds.
