# Remaining — advanced continuation 2026-10-18

Latest source continuation starts at actual remote HEAD `da1c6a3`. See docs/19-ADVANCED-RUNTIME.md and CURRENT-STATUS.md for implemented behavior; earlier reports of missing native connectors, linked subflows and social adapter source are superseded.

## Source scope still open

- Meta Commerce product-card carousel and SPM/MPM/catalog-template variants are not implemented; fail closed. Existing approved IMAGE/VIDEO marketing carousel, buttons and variables remain, with generic-catalog image selection. Do not call this a Commerce catalog integration.
- Controlled erasure of historical booking/accounting data and old generic webhook payloads without contact attribution is outside current chatbot erasure automation. Backups and remote systems need their own documented deletion process. No unsafe bulk deletion was introduced.
- Browser/OS push remains absent; durable inbox and notifications use practical 5/20-second polling. Production queue/error monitoring now includes worker health and bounded visible jobs; full telemetry/alerts, load scaling and operational reconciliation must be validated before production.

## External activation and configuration (not live-verified)

- PostgreSQL 16+ migrations **0001–0024**, migration role separate from non-owner/non-BYPASSRLS runtime role; grant new tables/routes. Shared RATE_LIMIT_SECRET, exact trusted gateway addresses and HTTPS APP_PUBLIC_ORIGIN.
- Google Sheets + Drive APIs/OAuth consent/verification, HubSpot OAuth app or scoped private token, WooCommerce REST credentials + approved store hosts, Shopify app/customer scopes/protected-data approval + pinned API version. Refresh/rotation and queued source integration exist; no provider success is claimed.
- Meta WhatsApp credentials and approved templates as before; Messenger Page permissions/subscriptions and Instagram Login professional-account permissions/app review; META_SOCIAL_APP_SECRET and verify token. Telegram BotFather token and reachable webhook domain. No actual provider conversation/delivery was exercised.
- Running maintained ClamAV daemon/signatures/socket permission. All active media (including old uploads) is PENDING until rescanned; no scan success/malware-detection claim. Public clean media URLs remain revocable bearer capabilities for provider fetch, not private authenticated downloads.
- Optional AI credentials; encryption master keys and backups preserved securely; approved outbound webhook hostnames. No real credentials in source.

## One final comprehensive acceptance campaign — NOT RUN

Once remaining source scope is agreed/closed, execute unit/integration, fresh PostgreSQL/RLS and real runtime grants, desktop/mobile browser, subflow pinning/bindings/delay restart/rollback, Sheets append/update/crash/manual-edit races and CRM permissions, signed channel webhooks/dedupe/opt-out/handoff/window restrictions, media scanning/quarantine/revocation, privacy/export/concurrency, AI grounding, API scopes/distributed throttling, queue fault injection/uncertain-send reconciliation, performance, backup/restore, real provider/account activation.

Local development safeguards: clean TypeScript build, changed JS syntax, static dashboard/assets HTTP smoke and whitespace checks passed. CI proof for the new source must be recorded after upload; earlier 43/43 on `13a3da3` does not validate this implementation. No merge, production deployment or commercial-readiness claim.
