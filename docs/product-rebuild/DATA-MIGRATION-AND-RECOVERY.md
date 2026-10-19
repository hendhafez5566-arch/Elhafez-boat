# Independent bot data boundary and recovery

Implementation: `feat/codex-product-rebuild-2026-10-19`, derived from handoff b02a313. No production database was used.

## Data map

| Resource | Boundary and compatibility |
|---|---|
| Companies, memberships, roles, subscriptions | Existing tenant tables and API entitlement/CSRF checks unchanged. |
| Official WhatsApp/social accounts, credentials and widget settings | Existing tenant-owned accounts remain in place. No provider authentication or sending performed. |
| Default draft and immutable releases | Original `chatbot_flow_drafts` / `chatbot_flow_versions` remain authoritative for `/flows` and legacy bots. |
| Legacy migration | 0029 creates one deterministic default bot (`id=tenant_id`) for each tenant with an existing flow, and copies every draft/version/source definition and original metadata. Copies are migration snapshots, not a second mutable default. |
| New independent bots | `chatbot_bots`, `chatbot_bot_drafts`, `chatbot_bot_versions`, composite tenant/bot keys and FORCE RLS; independent revision and version counters. |
| Triggers | Old rules remain on the default adapter. New `chatbot_bot_triggers` are scoped by tenant and bot; publication validates active target nodes. |
| Routing | Explicit unique tenant/channel/account route. One website widget per company; each official account can route to one bot. No arbitrary bot selection. Unmapped events retain the documented legacy adapter. |
| Existing conversations and sessions | Preserved. Migration 0030 assigns known legacy sessions to their default bot. Null historical sessions retain the legacy adapter. New sessions pin bot and immutable release; route changes affect new conversations only. |
| Delay jobs | Existing conversation references remain; resume reads the session's pinned bot/release. |
| Contacts, leads, notes, catalog, FAQ, media, integrations, AI | Shared tenant resources retained in place. No automatic duplication, credential copying or cross-tenant references introduced. |
| Campaigns and outbound queues | Existing account/consent/permission/send-window checks remain. Bot routing does not grant sending permission. |

## Apply and verify

1. Back up the database and secure grants/keys/media separately using the existing operational process. Never copy customer data into acceptance fixtures.
2. Use the authorized privileged `MIGRATION_DATABASE_URL`, separate from the non-owner/non-BYPASSRLS runtime login. Migration 0029 rejects a migration connection unable to read FORCE-RLS legacy rows across tenants, preventing a silent empty backfill.
3. Run `npm run db:migrate` (0001–0032). Existing migration ledger/advisory lock makes repeated execution a no-op. Do not run a reset.
4. Grant the existing runtime role its required operations on the new tenant tables; keep FORCE RLS enabled and test using that actual login.
5. Check `tests/bots-db.mjs` only against a named disposable `elhafez_ci` database. It verifies repeat backfill, exact historical definitions/revisions, independent publishing, rollback, concurrent editors, cross-tenant/role denial, route ambiguity rejection, pinned sessions and archive preservation.
6. New WhatsApp route assignment requires locally recorded VERIFIED authorization/subscription and unexpired credentials. This metadata is not new provider acceptance. No connection is activated by merely publishing a stored bot release.

## Recovery without data deletion

Bot release rollback is an authenticated owner/manager operation creating a NEW release from the chosen immutable source. Historical releases and active pinned sessions remain unchanged; proven against PostgreSQL.

An application downgrade to code predating multi-bot support is **not an automatic safe rollback for independent conversations**: old code cannot interpret their bot context. Before such a downgrade, pause inbound processing and workers through the existing operational process, preserve a new backup, remove new route assignments, and hand independent-bot conversations to staff using supported handoff controls. Verify no automated independent session resumes before starting old binaries. Retain all new tables and data. This run did not execute a production downgrade, change real conversations, or approve deployment.

Independent archive preserves drafts/releases and ongoing pinned sessions. Assigned routes must be removed first. Owners/managers can restore archived bots without republishing. The legacy bot cannot be archived while old consumers depend on it.

## Executed disposable proof

PostgreSQL 16, migrations through 0032; runtime login NOSUPERUSER/NOBYPASSRLS. A second fresh PostgreSQL instance verified the full schema installation. A `pg_dump`/`pg_restore` into a separate disposable database matched complete row fingerprints across all **92 public tables** at the captured snapshot. This proves that fixture snapshot only, not production backup policy or provider credentials/media recovery.
