# Elhafez Boat — General-Purpose Chatbot Building Platform

A multi-company, Arabic-first platform where **any shop or business** can build its own conversational assistant. Inspired by configurable chatbot tools like BotSailor, but built as an original, separate product. A tourism firm is one example of an industry, **not the default product**.

## What businesses can configure
- Visual card-based conversational flow builder: text, **interactive WhatsApp buttons/lists**, custom input questions, branching conditions, tags, image/video/audio/document links, HTTPS website links, human handoff and end.
- Company catalog of **products, services and offers** with completely custom categories and optional advertised price text.
- Approved FAQs, shared WhatsApp inbox, customer interests, captured custom data and staff assignment.
- Multiple tenants, basic team roles, official Meta WhatsApp Cloud API integration code and queue.
- Draft/edit/publish flows, atomic revisions and per-conversation version pinning.

The platform **does not** run a business's booking system, process payments, issue invoices or administer inventory.

## Current build state (October 2026)
Source for the generic flow engine/editor, catalog, APIs and migration 0015–0016 is committed to the **development branch**. It is not an all-feature BotSailor clone, and the clean checkout/real PostgreSQL migration, real WhatsApp registration, live provider tests and full commercial acceptance are **not verified**.

Browser-only demo: `node apps/web/server.mjs` (Node 22+), open `http://localhost:3000`, choose **استعراض التصميم ببيانات تجريبية** and go to **مصمم الشات بوت**. Demo does not send actual messages or persist server data. Draft/publish requires authenticated business, configured database and official WhatsApp number to become live.

### Project references
[Current status](project-management/CURRENT-STATUS.md) | [Handover](project-management/HANDOVER.md) | [Remaining](project-management/REMAINING.md) | [Generic product scope](docs/00-SCOPE-CHATBOT-ONLY.md) | [Master plan](docs/01-MASTER-PLAN.md)

Keep the PUBLIC repo free of customer PII, secrets and Meta credentials. User prefers one final comprehensive acceptance phase after approved feature development.
