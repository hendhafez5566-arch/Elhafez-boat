# Remaining — advanced continuation 2026-10-18

Latest source continuation starts at actual remote HEAD `da1c6a3`. See docs/19-ADVANCED-RUNTIME.md and CURRENT-STATUS.md for implemented behavior; earlier reports of missing native connectors, linked subflows and social adapter source are superseded.

## Source scope still open

- Meta Commerce CATALOG/SPM/MPM/product-carousel source is now implemented (docs/20-META-COMMERCE.md); live account/catalog approval and delivery acceptance remain unverified.
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


Latest source evidence: [a4be882](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/a4be882e220f51f1f907cb2d30cdc4b890994da7), correction [9a338d6](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/9a338d63641f5b445abad2aaf2fa4ad4bcc5d318). Development CI a4be882 run [39100381266](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100381266) SUCCESS: **55/55**, migrations **0001–0024**, real PostgreSQL RLS/privacy/rate checks. Full final acceptance and live provider/scanner activation remain unverified; Meta Commerce product-card/catalog-template source remains open. Latest-head evidence: VERIFICATION-ADVANCED-2026-10-18.md.

Latest source correction **9a338d6** also passed [push CI 39100475500](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100475500) and [PR CI 39100478270](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39100478270): **55/55**, migration 0024 and PostgreSQL gate. Logs inspected directly. This is not the formal final acceptance campaign.


## 2026-10-18 — Meta Commerce continuation from 5c03106
Implemented source: tenant/account-bound generic-to-Meta catalog mapping, official CATALOG/SPM/MPM/PRODUCT Carousel components, exact named/numbered template variables, real mapping/product/section/card UI for individual sends and campaigns, queue snapshot and pre-dispatch revalidation, inbound cart/referred-product interest-to-staff handoff. Migration **0025** adds FORCE/RLS mappings; existing consent/usage/ownership and image/video carousel remain. No orders, inventory, payment or ERP created. Local build/syntax/HTTP and 70/70 unit checks passed; provider-contract/text-bound cases included. Live Meta credentials/Commerce permissions/approvals and comprehensive browser/fault/load/restore acceptance remain unverified. Exact implementation/activation limits: docs/20-META-COMMERCE.md. Earlier statements that all Commerce source variants are absent are superseded by this entry; source completion does not prove provider activation. CI/commit evidence follows after push.
