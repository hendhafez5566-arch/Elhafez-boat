# Remaining — final acceptance is not approved

## Source still unfinished / deliberately unsupported
- Dedicated Google Sheets/CRM/ecommerce OAuth/native connectors. Current generic outbound HTTPS webhooks support encrypted Bearer/HMAC secrets, allowlists, retries and audit, but do not constitute those native integrations.
- Advanced template carousel/authentication/named-parameter/provider-specific formats and full template bulk-sync management. Supported component forms are explicitly validated; unsupported forms are rejected.
- Advanced canvas grouping/reusable subflows. Current drag/pan/zoom/connect/duplicate/undo/version functionality exists.
- Additional social adapters beyond WhatsApp and Website. Messenger, Instagram and Telegram are not live integrations.
- Operational retention/purge tooling and malware scanning for uploaded files; current bounded storage, MIME signature checks and deletion safeguards do not replace either.
- Broader granular REST write scopes; current API keys remain catalog/lead read-only. Native browser/OS push is not implemented; inbox/notification polling is implemented.
- Final responsive/accessibility and concurrency/abuse/performance review. Login throttling remains process-local. Actual production role grants must include new runtime tables/routes; no commercial/multi-instance hardening claim.

## External activation / environment
- PostgreSQL 16+ with migration/platform roles separate from non-owner, non-superuser, non-BYPASSRLS runtime role; migrate 0001–0022. Real migration and tenant isolation are not established by TypeScript compilation.
- Meta account, phone/WABA IDs, valid access token, app secret, verify token, actual app/account permissions, HTTPS webhook and approved templates. No live provider operation was tested in this session.
- Optional AI credentials remain external and unverified; deterministic core/FAQ/catalog works independently.
- Exact widget website origins and reachable HTTPS app domain. Configure MEDIA_PUBLIC_ORIGIN for external media links. Website widget/account setup must be exercised from an actual permitted origin.
- INTEGRATION_SECRET_ENCRYPTION_KEY: independent base64 32-byte key, preserved for decryption. OUTBOUND_WEBHOOK_HOSTS allowlist and reachable idempotent receivers; optional global signing secret. No live outbound webhook was dispatched here.
- Working browser runner for actual desktop/mobile acceptance. Prior Chromium installation/download failed; this session did not repeat it.

## ONE final comprehensive acceptance campaign
After approved build scope is closed, run unit/integration, fresh PostgreSQL migration and RLS/cross-tenant checks, actual browser/mobile, delay crash/restart/session pinning, dynamic pagination, trigger/hand-off/inbox ownership, website CORS/token/dedupe/security, media ACL/quota/type/deletion, consent/campaign cancel/limits/template delivery, AI grounding/quota, outbound DNS/SSRF/secrets/idempotency, worker fault injection/reconciliation, realistic performance and real backup/restore. Fix failures from source; no test masking.

CI run 39072771700 on 7fc3626 passed 28/28 tests, all migrations and the PostgreSQL catalog-isolation/RLS gate. This is a development check, not this comprehensive acceptance campaign. Historical e38fbdb booking failures were addressed by retiring the obsolete product and replacing its coverage, not by reviving booking code or excluding current chatbot/security tests. See docs/17-LEGACY-RETIREMENT.md.

No merge, commercial deploy or readiness claim is authorized by the current evidence.
