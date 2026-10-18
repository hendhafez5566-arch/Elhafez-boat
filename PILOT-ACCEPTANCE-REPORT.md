# ELHAFEZ BOAT — PILOT ACCEPTANCE REPORT

Date: 2026-10-18. Branch: `feat/stage0-foundation`, existing draft PR #1. Verified starting HEAD: `a6d904d0170e76bae40231d425b89ddf638b4bdb`.

**Decision: NOT YET READY FOR REAL WHATSAPP ACCEPTANCE.** Source fixes and staging scaffolding are delivered; a public HTTPS staging environment and owner-authorized Meta/number onboarding are still required. No provider accounts activated, no live messages sent, no production deployment or merge.

## Implemented in this continuation

1. Previously any readable phone ID could be stored against an unrelated WABA ID. Connection now verifies the exact phone among that WABA's phone_numbers, following at most 20 cursor pages (100/page); malformed, denied or incomplete ownership checks fail closed. Provider reads reject redirects, time out, bound JSON to 256 KiB and never return provider bodies/secrets in errors.
2. Previously a disabled account's globally unique phone ID prevented reconnection. Same-tenant reconnect now rotates encrypted token and preserves account/conversation identity. Another tenant cannot take it over. Routing conflicts fail closed.
3. Owner-only on-demand diagnosis verifies current phone/WABA access and checks the configured META_APP_ID among subscribed_apps. Missing/unconfirmed subscription is explicitly not connected. Even verified phone plus subscription returns `liveAcceptance:false`; it cannot establish registration, all token scopes, correct callback configuration or actual delivery. No automatic subscription or number registration is performed.
4. Arabic four-step owner guidance and safer local-disconnect explanation. No saved-credential-only connected badge. Refresh/close and logout warn before losing unsaved flow edits; existing cross-page in-memory draft preservation remains.
5. Optional Caddy HTTPS staging overlay, exact public-origin/shared rate secret/Meta app ID environment wiring and Arabic setup guide. This is configuration source, not a deployed HTTPS endpoint. Media scanning still requires an actual mounted ClamAV socket; configuration alone does not start it.
6. New regression coverage for WABA mismatch, malformed/oversized/network replies, redirect policy, encrypted token storage, reconnect tenant predicate and owner-only diagnosis. Real PostgreSQL reconnect/route identity assertions added to existing runtime acceptance, with matching explicit loopback provider fixtures.

## Evidence at source submission

| Check | Result | Evidence / limits |
| --- | --- | --- |
| Actual branch and HEAD | PASS | git rev-parse HEAD and GitHub PR #1 head agree at a6d904d |
| Baseline CI | PASS | https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39120667468 both jobs; job steps and runtime logs inspected |
| Local latest-source typecheck/build/unit regression | PASS | npm run check: 96 tests, 96 pass, zero fail/skip; includes new onboarding test |
| Latest-source real DB/API/worker/browser/restore/Compose | NOT TESTED at submission | Runs automatically after branch update; record exact run/SHA below after completion |
| Local PostgreSQL/Chromium/Docker runtime | BLOCKED | Binaries absent; attempted package preparation failed on environment setgroups/setuid restrictions. No account/hosting workaround performed |
| All UI buttons/forms/accessibility | NOT TESTED in full | Existing browser suite covers selected CRUD/publication and all-page viewport loads; loading a screen does not validate every action |
| Real WhatsApp scenario, all requested cases | BLOCKED | No approved live hosting and no owner Meta login/phone connection yet |
| Public Staging URL and pilot login | BLOCKED | No host/domain provisioned, no shared/default credentials created; explicit owner hosting approval required |
| Other social platforms / paid AI | NOT TESTED / intentionally inactive | Out of this WhatsApp pilot scope |

FAIL: no remaining failure in completed local check; this does not mean unexecuted acceptance passed.

Baseline runtime logs include disposable DB/RLS, real ClamAV signatures, restricted roles, concurrent workers/fault recovery, browser CRUD/screenshots, backup restore and Docker/Compose. Those are simulator/disposable-environment evidence; no baseline live Meta result is asserted. Latest-source revalidation is mandatory.

## Actual usable scope and limits

Existing source supports generic Arabic guided flows, text/buttons/lists/questions/conditions/tags, catalog/approved knowledge, drafts/publication/version rollback, inbox/handoff/staff replies, lightweight leads/tasks, consent-based campaigns and queue/delivery tracking. The continuation does not certify every feature path or a full autonomous AI agent. Existing deterministic approved-source planning stays limited; no paid model was connected. Comment automation on other platforms is not activated. Native WhatsApp Commerce additionally needs Meta catalog ownership and approvals; generic catalog information is separate.

## Owner steps and consent gates

See [Arabic pilot instructions](docs/24-WHATSAPP-PILOT.md). First approve a separate staging host/database/HTTPS with an explicit cost limit or provide an existing approved environment. Then the owner completes Meta login and number verification securely at the connection step. Do not put tokens, OTP, passwords, phone numbers or company data in GitHub, reports or this conversation. Tokens go only in the HTTPS connection form; server secrets go only in private hosting configuration.

The live checklist remains entirely unpassed: inbound + bot reply, buttons/lists, genuine published content, data capture/CRM, handoff/manual reply, restart persistence, STOP/no-contact, 24h restriction, duplicate webhook, send failures and sent/delivered/failed reconciliation, correct reporting. Test only the owner's two numbers. Record actual receipts and safe screenshots after approval. Never treat missing receipt as proof that an uncertain send did not occur.
