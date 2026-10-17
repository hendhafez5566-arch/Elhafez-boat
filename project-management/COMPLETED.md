# Implemented source; final verification remains separate

Current batch continues d31c20e on the same branch/PR.

- Booking source/contracts/UI retired with documented test migration; security primitives/tests retained.
- Durable DELAY continuation, dynamic catalog list pagination and stable selections, global keyword/first-message triggers.
- Live website-chat source using the same bot engine, visitor sessions/dedupe/origin checks and real employee takeover/replies.
- Media upload/library/storage limits/public links/deletion protection.
- Supported approved template variables/media/interactive button parameters and callbacks.
- Consent-filtered campaign/sequence drafts, recipient jobs, launch/cancel, worker limits and retries.
- Unified inbox polling/notifications, explicit read receipts, editable saved replies, generic lead capture, company consumption/admin caps.
- Encrypted per-integration credentials and configuration, durable Meta dispatch claims and UNCERTAIN recovery.
- Rebuilt actual-data RTL workspace; removed seeded tourism UI and stale compiled-code risk; optimistic flow draft revisions.

Locally confirmed: clean dependency install, TypeScript/build, JS syntax, static DOM checks and HTTP asset serving. This list means source is implemented, not database/browser/live-provider/commercial acceptance passed. See CURRENT-STATUS.md and REMAINING.md for exact evidence and limitations.
