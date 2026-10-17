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

Canvas with drag/pan/zoom, connections, undo/redo/duplicate, draft validation, publish/history/rollback; server-backed preview; deterministic messages/buttons/lists/questions/conditions/tags/media/links/handoff; dynamic approved catalog, keyword branches, optional extractive grounded AI and queued safe webhooks. Team inbox includes ownership, saved replies, notes, unread filters and close. Individual approved static templates support scheduling; REST keys support scoped catalog/lead reads.

Official WhatsApp Cloud API source includes signed webhooks, receipts, outbox, window/consent checks and retries. Actual provider activation requires your Meta account and credentials and is unverified. AI, external destinations and other channels are not claimed live.

## Exact status

- [Authoritative scope](docs/00-SCOPE-CHATBOT-ONLY.md)
- [Current status and evidence](project-management/CURRENT-STATUS.md)
- [Unfinished features and acceptance](project-management/REMAINING.md)
- [Handover](project-management/HANDOVER.md)

Confirmed locally: dependency install, TypeScript/build, JS syntax and static HTTP serving. PostgreSQL/RLS, authenticated browser/mobile, Meta, AI, performance and backup/restore acceptance were not run locally. Chromium download failed. CI on e38fbdb: 34/38 passing, four legacy service failures; migrations/RLS skipped. Full details and unfinished work are in CURRENT-STATUS.md.
