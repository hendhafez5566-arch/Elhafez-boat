# Remaining — owner scope is NOT fully complete

Delivered source and evidence: CURRENT-STATUS.md. No commercial readiness percentage.

## Unresolved CI

CI run 39070131242 on e38fbdb failed: 34/38 passed; nine new regressions passed, four unchanged legacy tourism/booking tests failed. Migration/RLS steps were skipped. Resolve the legacy retirement/test-compatibility decision without disabling tests or reviving out-of-scope booking features. No green CI claim.

## Independent unfinished build work
- DELAY node and durable flow-resumption scheduler; visual grouping/reusable blocks.
- Global event/keyword triggers and campaign/sequence builder; consent-based bulk segmentation, scheduling/cancellation/status UI and shared rate budgets. Current scheduling is individual approved static templates only.
- Dynamic catalog interactive lists, pagination beyond ten items, native product messages and catalog edit UI. Current dynamic node sends approved text; catalog update API exists.
- Template variables/media/carousels and provider sync pagination/revocation refresh. Current provider registration is static approved templates only.
- Media upload/storage/lifecycle, retention and attachment preview; HTTPS media-link nodes already exist.
- Full generic channel adapter interface, Website Chat widget and inbox, plus future Messenger/Instagram/Telegram connectors. None should be advertised as live.
- Dedicated Google Sheets/CRM/store connectors and per-integration secret management/rotation. Current outbound webhooks have exact server allowlist and optional environment HMAC, not arbitrary HTTP credentials.
- Expand scoped REST APIs beyond catalog/lead reads, tenant-wide usage limits/rate budgets and platform monitoring/error/retention screens. Existing owner tenant/team/subscription provisioning remains; consumption management is incomplete outside AI caps.
- Finish removal of dormant legacy UI/modules after dependency audit; preserve historical schema/data compatibility. Active legacy routes are retired, but source cleanup is not finished.
- Complete visual polish/mobile/a11y review, notification refresh and richer contextual lead summaries; saved-reply edit/delete UI and integration disable/job inspection UI.
- Draft concurrency protection and further runtime rate/abuse limits need review before multi-instance deployment.

## External activation dependencies
- Actual PostgreSQL 16+ service; separate privileged migration/platform and least-privilege runtime roles/grants. Migrations 0001–0021 have not been applied locally.
- Meta developer/business account, Phone Number ID, WABA ID, access token, app secret, webhook verification token, appropriate app permissions and approved templates; secure public HTTPS webhook and preserved encryption key. Provider permissions/approval depend on the chosen Meta setup.
- Optional AI_BASE_URL, AI_MODEL, AI_API_KEY; provider behaviour/connection remains unverified. Without them deterministic flows, approved exact answers and safe fallback still operate.
- OUTBOUND_WEBHOOK_HOSTS and a receiver that implements idempotency; optional HMAC secret. Empty allowlist disables outbound destinations.
- Working Chromium installation/browser runner for real UI/mobile evidence; attempted download here failed.

## ONE final comprehensive acceptance campaign
After remaining build scope is finished, execute original and added unit tests, clean install/build, all PostgreSQL migrations and non-owner RLS/cross-tenant tests, actual authenticated browser/mobile E2E, flow publish/rollback/session pinning, live Meta sandbox/interactive/template/window/consent checks, AI grounding and quota, inbox concurrency, outbound SSRF/DNS/retry/idempotency, permission/security, performance, recovery and real backup/restore.

Current state: partial implementation delivery, not final acceptance-ready. Do not merge or commercially deploy on this report.
