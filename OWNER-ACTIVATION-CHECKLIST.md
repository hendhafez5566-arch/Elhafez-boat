# Current scope: company self-service, not owner phone activation

Implement permanent multi-tenant Embedded Signup/Coexistence. No real Meta login, phone linking, app review submission, live message or paid hosting is authorized. Flags stay off pending platform approval/configuration. Railway allowed read-only inventory/usage, with ZERO additional expense. See docs/25-META-PLATFORM-SETUP.md and WHATSAPP-COEXISTENCE-SELF-SERVICE-ACCEPTANCE.md. This supersedes earlier requests to link the owner's test number.

# Current pilot authorization — 2026-10-18

Owner permits preparation for one real WhatsApp test number, but requires separate explicit approval before hosting/account activation, and safe owner completion of Meta login/OTP. Other providers remain out of scope. See `docs/24-WHATSAPP-PILOT.md` and `PILOT-ACCEPTANCE-REPORT.md`. The historical checklist below is retained; its blanket earlier prohibition is superseded only by this narrow authorization.

# Owner activation checklist — manual future work only

No provider accounts were connected by this technical execution. Simulator checks do not establish live integration success. Keep PR #1 unmerged until review. Do not start outreach or campaigns during activation.

## Before entering credentials

- [ ] Review latest CI and remaining FAIL/BLOCKED/NOT TESTED items; select a disposable pilot company and consenting test recipients.
- [ ] Apply migrations with a separate migration role. Runtime must be NOSUPERUSER/NOBYPASSRLS, not a table owner; verify FORCE RLS. Provision a restricted platform administration connection separately.
- [ ] Set HTTPS APP_PUBLIC_ORIGIN and MEDIA_PUBLIC_ORIGIN, exact trusted gateway addresses, shared RATE_LIMIT_SECRET, provider allowlists; do not allow private networks or broad wildcard hosts.
- [ ] Generate separate 32-byte base64 WHATSAPP_TOKEN_ENCRYPTION_KEY and INTEGRATION_SECRET_ENCRYPTION_KEY in a secret manager. Back up original keys securely, independently of DB archives. Replacing them without re-encryption makes stored credentials unreadable.
- [ ] Run real ClamAV with maintained signatures and the configured Unix socket; verify clean upload, EICAR quarantine, scanner-offline rejection and deletion/revocation. Keep pending files private.
- [ ] Restore a fresh encrypted backup into a separate environment; verify roles, tenant isolation, media bytes, credentials decryption, pending delays and UNCERTAIN queues before allowing any outbound traffic.

## Account setup (owner executes later)

| Provider | Owner configuration | Live acceptance required |
| --- | --- | --- |
| WhatsApp Cloud API | Meta business/WABA/phone permissions, app secret, webhook verify token, encryption key, pinned META_GRAPH_VERSION | Signed inbound text/buttons/lists, duplicate/replay, opt-out, handoff, 24h guard, sent/delivered/error callbacks |
| WhatsApp templates / Commerce | Approved locale/template and exact variables, catalog/account ownership, published product mappings | TEXT/media/Carousel and CATALOG/SPM/MPM/PRODUCT Carousel delivery to opted-in test recipient; provider rejection |
| Messenger | Page token, Page subscriptions and reviewed permissions; META_SOCIAL_APP_SECRET and verify token | Inbound signed webhook, callbacks, echo filtering, staff takeover and window restriction |
| Instagram | Supported professional account via Instagram Login, permissions/review and subscriptions | Inbound/outbound text/actions, signatures and unsupported account rejection |
| Telegram | Owner's BotFather bot token and configured webhook secret | Private chat update, replay, callback, opt-out and invalid secret rejection |
| Google Sheets | APIs/consent screen, OAuth client and exact redirect URI | PKCE/code exchange, refresh, worksheet selection, UUID-column append/update, RAW values and ambiguous-write reconciliation |
| HubSpot | OAuth app or scoped private token; minimum contact scopes | Create/update, stable remote identity after email change, denied scope, refresh/revocation |
| Shopify | Approved shop domain/app, customer/protected-data permissions, explicit SHOPIFY_API_VERSION | OAuth HMAC and state, customerSet, validation errors and rotation |
| WooCommerce | Approved store host and scoped REST consumer keys | Customer lookup/create/update, email/remote identity, denied permission and revoked key |
| AI | Approved provider/base URL/model and credential; company-approved knowledge only | Grounded answer, no unsupported offers, provider timeout/rate limit, cross-company knowledge denial |

Exact account types, environment names and callback paths are maintained in `docs/19-ADVANCED-RUNTIME.md`, `.env.example` and `docs/20-META-COMMERCE.md`. Copy callback URLs from those sources for the chosen public origin; do not invent or reuse another company's callback/state.

## Safe rollout and recovery

- [ ] Begin with one company and manual test recipients, no mass campaign. Verify scopes and dashboard role restrictions as OWNER, MANAGER and AGENT.
- [ ] Confirm every provider failure is visible without logging credentials/customer payloads. Revoke/rotate a test token and verify isolation.
- [ ] Run `node scripts/ops-health.mjs` with the runtime connection. Exit 0 means no current queue/heartbeat alert, 2 means operational alert, 1 means monitoring failed. Schedule locally, route stdout/exit status to your chosen local alert system.
- [ ] Never bulk-reset UNCERTAIN to PENDING: check provider receipts/logs using job ID, recipient and time; record evidence; only explicitly retry after proving no send occurred. Lack of a provider receipt is not proof of non-delivery.
- [ ] Perform an owner-reviewed restore rehearsal with egress disabled; resume queues only after dedupe and UNCERTAIN review.
- [ ] Approve retention per company. Export before exact-ID erasure when appropriate; independently handle old unattributed data, historical tables, archived backups and provider-side copies. No random historical deletion.
- [ ] Complete remaining full-action UI/accessibility, sustained mixed-load, in-flight worker-kill and whole-database outage tests before a commercial readiness decision.
