# Advanced runtime delivery — 2026-10-18

Continues actual remote HEAD `da1c6a3`, not the older owner checkpoint `13a3da3`. Same branch and draft PR #1. No production deployment or merge.

## Implemented source and boundaries

| Area | Actual behavior |
| --- | --- |
| Native connectors | GOOGLE_SHEETS, HUBSPOT, WOOCOMMERCE, SHOPIFY; encrypted per-company credentials, configuration/rotation/disable UI, durable jobs and visible results. |
| OAuth | Google, HubSpot and Shopify authorization code exchange; 10-minute single-use hashed state, HttpOnly Secure SameSite browser cookie, current owner check, Google PKCE/offline refresh, Shopify shop/HMAC verification. Refresh credentials encrypted. No access token in callback URL or dashboard response. |
| Sheets | Real Drive spreadsheet listing (first 100; arbitrary permitted ID can be entered), worksheet lookup, selected spreadsheet/title, configurable fields. Column A reserves the stable contact UUID. Each job re-reads IDs, rejects duplicates, updates existing rows or appends with RAW values. One worker holds the connector row across the operation. A dedicated sheet must be used; do not independently reorder rows during writes. |
| CRM/stores | Valid email required; HubSpot contacts batch upsert by email; WooCommerce email lookup followed by create/update and metadata; Shopify GraphQL customerSet by email, with configurable metafields. Existing lead fields and explicit job fields are mapped. No orders, inventory, bookings or billing. |
| Flow connector node | CONNECTOR resolves to a durable per-tenant contact-sync job. Conversation/node/field snapshot hash suppresses duplicate enqueue. Preview never enqueues it. |
| Linked subflows | SUBFLOW pins library UUID + integer version. Save creates immutable library version. Publish compiles the call graph into an immutable, namespaced graph; END returns to caller; HANDOFF remains terminal. Field bindings alias callee keys to caller keys (unbound fields use shared conversation fields). Max five nested calls, 100 expanded nodes, no recursive references. Delays/input resume on the compiled session-pinned version. Source definitions retained for rollback/editing. Canvas supports separate library editing, save-new-version, insert-call and return to main draft. Existing snippets/groups remain. |
| Channels | Messenger (Page token), Instagram (Instagram Login/professional-account token) and Telegram (bot token) receive provider events and queue responses using the same bot engine/leads/inbox. Signed raw Meta requests; Telegram secret header; provider receipt dedupe; opaque short callback references; opt-out/start; subscription/usage checks. Telegram webhook registration calls the official API. Meta app subscriptions and account permission approval remain external setup. |
| Channel delivery | Provider-supported text, choices and media; Instagram unsupported media falls back to an actual HTTPS link, not invented attachments. Meta replies stop at 24 hours, including staff replies. Private Telegram chats only. Durable dispatch claim commits before HTTP. Timeouts/unknown results and interrupted claims go to UNCERTAIN, never blindly resent; explicit 429 retries are bounded. |
| Privacy | Owner-only policy (30–3650 days, automatic cleanup OFF by default), candidate preview, contact export, exact-ID confirmed anonymization, audit events. Contact PII/current lead fields/messages/session/actions/notes and attributable webhook/connector payloads scrubbed; outgoing pending jobs cancelled/suppressed. In-flight/uncertain sends block erasure until reconciled. Contact identity row is retained as an anonymized tombstone. |
| Retention | Hourly opt-in sweep targets inactive contacts whose conversations are closed and old; active threads are preserved. Only explicitly DELETED media is physically purged after 30 days. Historical booking/financial tables are preserved; backup and external-system deletion need their own process. Older generic webhook jobs without contact attribution cannot be automatically associated to an erasure request. |
| Media | New and historical active uploads require CLEAN scan before public access or use in newly published messages. clamd INSTREAM over a local Unix socket; missing scanner leaves PENDING, infected files QUARANTINED. Existing links may be temporarily unavailable until rescanned. Magic-byte checks/quotas remain. Public provider-fetch URLs are revocable bearer capabilities: anyone holding a URL can fetch a CLEAN file; management/list/delete stay tenant/RBAC scoped. |
| Hardening | Atomic PostgreSQL rate buckets shared by API replicas (hashed IP/identity); granular exact-route API key scopes, no key access to secrets/export/admin/publish; worker heartbeat/error code and connector/social queues visible alongside existing queues. Existing reliable inbox/notification polling remains (5/20 seconds), not OS/browser push. |

## Deployment configuration

1. Apply migrations **0001–0024** with the migration role. Grant required new tables/routes to the non-owner, non-superuser, non-BYPASSRLS API/worker role. RLS/FORCE applies to every new customer-data table. Opaque OAuth/channel routes and hashed rate buckets are service-routing infrastructure, not client-readable endpoints.
2. Configure `RATE_LIMIT_SECRET` identically across replicas. Configure `TRUSTED_PROXY_IPS` only for the trusted gateway: the included gateway overwrites forwarded client addresses. Untrusted forwarded headers are ignored. Do not expose the internal API around that gateway.
3. Preserve independent `INTEGRATION_SECRET_ENCRYPTION_KEY` (base64 32 bytes). Do not rotate/delete it without a re-encryption procedure. Set exact HTTPS `APP_PUBLIC_ORIGIN`, no trailing slash.
4. OAuth apps: `GOOGLE_CLIENT_ID/SECRET`, `HUBSPOT_CLIENT_ID/SECRET`, `SHOPIFY_CLIENT_ID/SECRET`. Register the exact callback `${APP_PUBLIC_ORIGIN}/api/v1/connectors/oauth/callback`. Google needs Sheets + Drive APIs and consent scopes/verification. Google/HubSpot refresh is implemented; private/static provider tokens must be rotated by the owner.
5. Shopify: pin `SHOPIFY_API_VERSION`; obtain customer scopes/protected-customer-data approval. WooCommerce: allow exact store hosts in `WOOCOMMERCE_HOSTS`, create HTTPS REST consumer keys with customer access. Provider DNS must resolve to public addresses with a public IPv4 endpoint; redirects are rejected.
6. Meta social: `META_SOCIAL_APP_SECRET`, `META_SOCIAL_VERIFY_TOKEN`, existing `META_GRAPH_VERSION`; webhook `${APP_PUBLIC_ORIGIN}/api/v1/channels/meta/webhook`; configure Page/Instagram subscriptions, messaging permissions and app review in Meta. Instagram Login tokens use graph.instagram.com; Facebook Login variants are not silently treated as compatible.
7. Telegram: BotFather token in the company's channel form; connection validates getMe and registers `${APP_PUBLIC_ORIGIN}/api/v1/channels/telegram/<bot-id>` with a generated secret. Private chats only; no unsolicited campaigns implemented for these new channels.
8. Run a maintained ClamAV daemon/signature-update service and set `CLAMAV_SOCKET` to its local socket path; grant the worker socket access. No scanner/antivirus signature or real malware test was available here.

## Retry and operational limits

Native sync jobs retry transient failures at most five times. Sheets ambiguous writes are UNCERTAIN; reconcile the target sheet before a controlled retry. Remote APIs and the local DB do not share a transaction: a crash after a remote success is recovered through stable remote identity (email/contact UUID), not a claim of distributed exactly-once delivery. Sheets append and concurrent manual edits need live fault-injection acceptance. Never manually requeue an unknown send without checking the provider.

Channel queue statuses are PENDING/PROCESSING/SENT/FAILED/UNCERTAIN/CANCELLED. A live service permission/readiness check is not implied by saved credentials. Disabled accounts retain historical inbox records. Re-entering the same company's channel credentials reconnects/rotates the account; the same external account cannot route to another company concurrently.

Privacy does not recall already-sent content, remote exports or backups. The interactive export includes up to 10,000 messages; larger exports require a controlled database process. Retention removes opaque social receipts after 30 days; delayed events older than 48 hours are ignored. Audit IDs/action codes are retained without message content. Generic webhooks created before contact attribution require separate privacy review.

## Explicitly not closed

- Meta Commerce product-card carousel, SPM/MPM/catalog template variants are still unsupported/fail closed. Existing approved IMAGE/VIDEO marketing carousel, URL/quick-reply buttons and numbered variables remain; the editor can select a published generic catalog image for a media card. This is not a Meta Commerce product-card implementation.
- Live Google/HubSpot/WooCommerce/Shopify, Messenger/Instagram/Telegram, Meta carousel and ClamAV activation have not been proven. Credentials, accounts, approvals, reachable HTTPS and daemon service are required.
- Cross-process fault injection, full browser/mobile/accessibility/concurrency/load/backup restore acceptance remain unrun. The formal final acceptance campaign has not started; development build/CI checks are not a substitute.

## Official protocol references reviewed

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/sheets/api/guides/values
- https://developers.hubspot.com/docs/api-reference/legacy/authentication/oauth-tokens/v1/guide
- https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/objects/batch/upsert-objects
- https://developer.woocommerce.com/docs/apis/rest-api/v3/customers/
- https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/customerSet
- https://core.telegram.org/bots/api
- https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

## Subsequent Commerce continuation
The previously open Commerce source formats are implemented by docs/20-META-COMMERCE.md and migration 0025. Its narrower supported shapes and live activation limitations apply.
