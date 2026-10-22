# Deployment and operations (unverified reference only)

These Docker files are deployment *scaffolding*, not a certificate that staging, migrations or WhatsApp API work. No real server has been deployed.

## Secrets

`DATABASE_URL` MUST belong to a non-owner, non-BYPASSRLS role with narrowly assigned permissions, otherwise RLS may be ineffective. `PLATFORM_DATABASE_URL` uses a separate privileged/limited platform owner DB role and must never be used by a browser, agent or worker. `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_TOKEN_ENCRYPTION_KEY` and tokens must live only in the deployment secret manager. Do not commit `.env` or expose the database port publicly. The app must be behind TLS reverse proxy. Meta webhooks require public HTTPS endpoint `/api/v1/whatsapp/webhook`.

## Local/reference sequence

1. Prepare database users/grants with least privilege; do **not** re-use migration superuser for application.
2. Prepare secret store, DNS/TLS ingress, port mapping and service dependencies.
3. Create backups of existing DB before migration, on a separate secure machine.
4. Run `npm run db:migrate` with separate `MIGRATION_DATABASE_URL` in controlled execution environment. Do not automate destructive migrations on boot.
5. Bootstrap platform owner using `npm run db:platform:bootstrap` only in secure operator context.
6. `docker compose -f deploy/compose.platform.yaml up --build -d` with necessary secret environment.
7. Verify health, PostgreSQL isolation, HTTPS, workflows and provider sandbox only during final acceptance phase.

**Blocking release gaps**: clean npm lockfile and actual Docker build; secure user-role grants; RLS E2E; provider sandbox; handling Meta rate limits/marketing templates; subscription payments; restore drill; alerts/metrics; privacy and compliance. Backup script creates **UNENCRYPTED** local custom archive; keep directory private, encrypt immediately, verify restores on isolated environment, follow retention policy.