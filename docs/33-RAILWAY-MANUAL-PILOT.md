# Railway — manual pilot for Meta test sender

## Hard limits
This is a manual, isolated pilot (not a production deployment, and not a real WhatsApp Business Coexistence connection). The user's original WhatsApp Business number remains untouched. Only Meta's test sender and a verified recipient are intended.

New Railway project: industrious-flow, environment named production inside this new isolated project only. Existing ERP projects are untouched. Working GitHub branch: feat/stage0-foundation, draft PR #1; no merge.

**Everything in Railway is STAGED. The OWNER is the only one who presses Apply Changes / Deploy.** Source autodeploy was disabled by the owner before new commits. Verify it stays disabled.

App: existing Elhafez-boat service, Dockerfile, command node scripts/railway-pilot.mjs, 0.5 vCPU / 0.75 GB RAM, port 3000 and health /health. The single app container supervises API, web and outbox worker. It does not run external/paid AI. This topology is for a low-cost pilot, not commercial high availability.

Database: separate staged boat-pilot-db Postgres 16 service, private DNS only, with a staged 512 MB persistent volume. Random passwords and encryption secrets were staged inside Railway Variables only, and are never published to GitHub/chat.

HTTPS domain: https://elhafez-boat-production.up.railway.app (free generated Railway hostname, target port 3000). The address does not serve the app until owner-triggered deployment.

**Billing:** Railway Hobby includes $5 per month in resource usage but the minimum hard compute limit is $10, so the included $5 is NOT a strictly enforceable account spending cap. Running app+DB and any other Railway services can exceed the included usage. The owner must review billing and decide when to deploy and when to stop. No AI agent/service is enabled.

## Setup and test procedure
1. On Railway verify Source > Automatic Deployments = Disabled and examine the pending STAGED patch for industrious-flow only. Confirm that no other projects appear in the patch.
2. Check CI for the exact GitHub HEAD, including script syntax/security tests, before manually deploying. A green CI alone does not prove live WhatsApp delivery.
3. Only after cost acceptance, the owner clicks Apply Changes / Deploy. PostgreSQL starts first; the app waits for the isolated pilot database and runs migrations and grants. The initializer refuses non-pilot databases, verifies a runtime role without SUPERUSER/BYPASSRLS and bootstraps a single company named pilot-boat if the DB has no tenants. It does not reset a DB with existing data.
4. Inspect health and logs. Then sign in using the company slug in BOOTSTRAP_TENANT_SLUG, BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD in Railway Variables. Do not share these credentials or put them in GitHub. This creates only a demo tenant-owner account, not a platform administrator.
5. After the first successful bootstrap, privately REMOVE privileged setup variables MIGRATION_DATABASE_URL and BOAT_PILOT_INIT_CONFIRM and remove the bootstrap credentials BOOTSTRAP_PASSWORD and BOOTSTRAP_EMAIL. A reviewed manual redeploy can apply this cleanup. Keep runtime DATABASE_URL and the original encryption key unchanged.
6. To test the actual Meta TEST account, privately configure the official META_APP_ID, META_APP_SECRET, the test WABA/Phone Number ID and a NEW valid token via Railway and the company connector. The earlier exposed test token must be regenerated. Do not paste tokens or app secrets in the chat. Embedded Signup/Coexistence remain off in the test-sender trial.
7. Configure the Meta webhook callback to https://elhafez-boat-production.up.railway.app/api/v1/whatsapp/webhook and use the matching secret META_WEBHOOK_VERIFY_TOKEN already staged in Railway. Subscribe the TEST WABA to messages. Test inbound and response to the owner's verified recipient, then inspect real Inbox/CRM and the worker logs.
8. Stop the pilot after the test to conserve resources. Do not delete/reset its persistent DB volume.

## Security
The initial bootstrap uses a privileged migration-only connection stored temporarily in Railway and a distinct non-owner RLS runtime database role. The parent launcher omits admin/bootstrap secrets from API, web and worker child environments. It rejects paid/external AI settings. The initial privileged variable must be removed after setup. This arrangement is test-only and must not be treated as production platform-owner provisioning.

No paid AI Agent, no deployment initiated by assistant, no actual Meta messages sent by assistant, no real WhatsApp Business phone number onboarding, no Railway resources in existing projects modified.