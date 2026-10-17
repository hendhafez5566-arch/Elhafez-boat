# Remaining work — GENERAL chatbot builder SaaS

Owner's latest scope: ALL businesses/shops, not tourism only; no internal ERP. Read `docs/00-SCOPE-CHATBOT-ONLY.md`.

## Built in draft source, NOT acceptance-tested
- Configurable message/quick-button/list/input/condition/tag/media/link/handoff/end blocks and a visual card-style block editor, draft, publish, preview, saved customer fields and current WhatsApp webhook integration.
- Company-specific generic catalog CRUD and published FAQ/approved item answers.
- Shared WhatsApp inbox, qualified leads, employee assignment/handoff, consent and basic tenancy.

## Remaining core features for a BotSailor-class PRODUCT, not necessarily every provider-specific addon
1. Flow designer: actual drag-and-drop canvas, zoom/connect lines, draft rollback, block grouping/reuse, duplicate/undo, robust per-node validation and error indicators.
2. Dynamic catalog rendering and generic trigger/keyword rules, contact-property conditions, menu pagination, working URL/CTA/media behavior verified per channel; upload/support media lifecycle.
3. Stronger natural Arabic interpretation with optional grounded AI provider, approved business knowledge, hallucination prevention and escalation; per-tenant settings.
4. Broadcasts and scheduled sequences, approved Meta template sync including variables/media, granular opt-in/opt-out, segmentation/tags and policy-compliant rate controls.
5. Webhooks/HTTP API actions, Google Sheets/CRM/ecommerce connectors with safe per-tenant secrets, outbound allowlists, retries/audit — never implement an internal business ERP.
6. Team inbox improvements: saved replies, labels, assignment queues, reminders, notification/analytics and reporting.
7. Platform admin: company onboarding, self-service Meta enrollment, usage/plan management, documentation, monitoring, safe data retention and backup/restore.
8. Future optional channels (site chat, Messenger, Instagram, Telegram) via channel adapters; NONE live yet.
9. Retire old tourism-only and booking/financial business code safely without touching migration compatibility or leaking customer data.

## Final acceptance (ONE comprehensive phase at the end, user decision)
Clean checkout/npm build and lockfile, real PostgreSQL migration/RLS, actual Meta sandbox and signed webhook/interactive media/lead-to-human tests, responsive browser, tenant & permission security, opt-in restrictions, worker recovery, integration safety, performance and restore. Resolve bugs then review PR and deploy pilot.

**Current branch is NOT feature complete, NOT fully tested, and NOT commercially ready.**
