# AUTHORITATIVE PRODUCT SCOPE — GENERAL-PURPOSE CHATBOT SaaS
**Updated by the owner 2026-10-17. This supersedes ALL previous tourism-only and broad ERP plans.**

## Vision
**Elhafez Boat** is a flexible SaaS chatbot-building platform for **all companies and shops**, not merely tourism: retailers, restaurants, clinics, education, real estate, services, tourism and any other industry.

Inspired by the broad **configurability** of platforms such as BotSailor, not a copy of their source code or design. A company connects its official messaging account, creates conversational experiences from blocks, answers FAQs, presents its own products/services and collects customer requests. Employees handle anything needing actual human sales, booking, payments or fulfilment in their existing company system. The platform is a customer communication/automation tool — **not a built-in ERP**.

## Company-configurable building blocks
- Text message and approved knowledge-base response.
- WhatsApp quick reply buttons (at most 3), interactive lists (at most 10 rows), generic labels and arbitrary follow-up links.
- Customer input: customizable field ID, text prompt and stored answer.
- Conditions on stored fields; tags/labels, branch actions; human handoff; end.
- HTTPS media: image, video, document or audio; HTTPS links.
- Reusable industry presets but **no hardcoded industry, category, or product type in the flow engine**.
- Draft, validation, versioned atomic publish and customer sessions pinned to a stable published revision.
- Visual drag-and-drop canvas, editable ports, zoom/pan, undo/redo/duplicate and shared-server authenticated preview; offline demo is separate. Implementation is not yet browser-acceptance verified.
- Contact/lead fields and staff inbox, role-based access and customer opt-out.
- Program/product/service content must be entered or approved by each company. Never invent prices, guarantees, availability or offers.
- Optional future richer nodes: advanced CTA, product catalog dynamic blocks, WhatsApp Flows, schedules, keyword triggers, outbound webhooks with safe allowlists, integrations, approved templates and consent-based campaigns, grounded AI.

## Platforms and channels
Official **Meta WhatsApp Business Cloud API** and **Website Chat** have source adapters sharing the channel-neutral engine. Actual provider/browser acceptance remains separate. Messenger/Instagram/Telegram now have source adapters and settings; actual provider activation remains unverified and requires account permissions/credentials.

## Data/architecture
Multi-tenant SaaS, company-specific workflows and catalog, row level security, permissions, secrets stored securely, Meta webhook signatures, queue/idempotency, staff handoff. Platform owner can provision companies; a separate billing provider can be plugged in later if desired. **Do not build accounting, reservations, passports, supplier contracts, refunds, inventory, or an ERP.**

## The main customer story
Shop connects WhatsApp -> owner builds a greeting with **Products / Prices / Contact employee** buttons -> customer taps a menu or asks a question -> bot gives approved product/service facts or asks for custom details -> qualified lead appears in the company's inbox -> staff takes over. A clinic configures the exact same engine with **Services / Working hours / Ask receptionist**. A tourism firm uses it for travel packages. No code changes per industry.

## Delivery and verification
Owner prefers implementing the full agreed chatbot-building feature set first, followed by **one formal comprehensive acceptance campaign**. Lightweight TypeScript and JS syntax checks during development are fine. Real Meta provider access and PostgreSQL credentials not yet connected. Never assert a prototype is fully equivalent to BotSailor or commercially approved.
