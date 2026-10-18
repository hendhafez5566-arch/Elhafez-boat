# Elhafez Boat

General-purpose Arabic/RTL SaaS chatbot platform for companies and shops. Configurable flows, approved product/service information, lead qualification and employee handoff. **Not an ERP, reservation, payment or accounting system.**

Working branch: `feat/stage0-foundation`; PR #1 remains unmerged. Substantial source implementation exists, but the full requested feature scope and final acceptance are **not complete**. Do not commercially deploy based on build success.

## Run

Node 22+, PostgreSQL 16+ and separate migration/runtime/platform DB roles are required.

```
npm ci --ignore-scripts
cp .env.example .env
npm run build
npm run db:migrate
npm run db:bootstrap
```

Fill private environment values before migration/bootstrap. In separate terminals run `npm run dev:api`, `npm run dev:web`, `npm run dev:worker`. Open http://localhost:3000 and use your bootstrap company slug/email/password. Owner administration is `/platform.html` after `npm run db:platform:bootstrap`.

Full instructions: [Local setup](docs/11-LOCAL-SETUP.md). No default passwords or real provider keys are included.

## Current implementation

Canvas with drag/pan/zoom, connections, undo/redo/duplicate, draft validation, publish/history/rollback; server-backed preview; deterministic messages/buttons/lists/questions/conditions/tags/media/links/handoff; dynamic approved catalog, keyword branches, optional extractive grounded AI and queued safe webhooks. Team inbox includes ownership, saved replies, notes, unread filters and close. Delay scheduling, dynamic catalog lists, global triggers, Website Chat, managed media, supported interactive template parameters and consented campaign sequences now have source and connected UI; REST keys support scoped catalog/lead reads.

Official WhatsApp Cloud API source includes signed webhooks, receipts, outbox, window/consent checks and retries. Actual provider activation requires your Meta account and credentials and is unverified. AI, external destinations and other channels are not claimed live.

## Exact status

- [Authoritative scope](docs/00-SCOPE-CHATBOT-ONLY.md)
- [Current status and evidence](project-management/CURRENT-STATUS.md)
- [Unfinished features and acceptance](project-management/REMAINING.md)
- [Handover](project-management/HANDOVER.md)

Confirmed locally: clean install/build, JS/DOM safeguards and static HTTP serving. GitHub CI on [7fc3626](https://github.com/hendhafez5566-arch/Elhafez-boat/commit/7fc36262f120560582d86c9614ded23e71fd3aa1) passed **28/28 unit tests**, migrations 0001–0022 and a real PostgreSQL catalog-isolation/RLS gate ([run](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39072771700)). Authenticated browser/mobile, live provider, performance and backup/restore acceptance remain unverified. Full evidence: project-management/VERIFICATION-2026-10-18.md.

Current continuation includes migration 0022. Configure MEDIA_PUBLIC_ORIGIN, widget origins and INTEGRATION_SECRET_ENCRYPTION_KEY as applicable. Native Sheets/CRM/store connectors and advanced template formats remain unsupported; final acceptance remains deferred. See docs/17-LEGACY-RETIREMENT.md for the clean CI/test scope migration.


## Advanced builder additions — 2026-10-18
Company-specific reusable **linear sections** can be saved/imported from the Flow Builder; **Shift+click** canvas nodes to visually group them. Editing imported copies does not change published versions. Approved **Meta MARKETING image/video carousel templates** (2–10 provider-defined cards) can be filled card by card in the template editor. Both features are source-implemented; real Meta carousel delivery has not been verified.
Read [implementation and limitations](docs/18-FLOW-REUSE-AND-CAROUSEL.md). Development CI [run 39076237206](https://github.com/hendhafez5566-arch/Elhafez-boat/actions/runs/39076237206) passed 43/43 tests, migration 0023 and tenant RLS; **final acceptance is still outstanding**.

Advanced runtime source delivery, setup and explicit limits: [docs/19-ADVANCED-RUNTIME.md](docs/19-ADVANCED-RUNTIME.md). Includes migration 0024. Meta Commerce product-card templates and live provider/scanner acceptance remain open.
