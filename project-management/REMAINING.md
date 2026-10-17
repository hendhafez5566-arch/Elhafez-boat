# REMAINING — chatbot-only product (2026-10-17)

Authoritative scope: `docs/00-SCOPE-CHATBOT-ONLY.md`. **Previous booking/finance/ERP to-do items are CANCELED, not incomplete. Do not implement them.**

## Core chatbot improvements still needed
- Reliable answer selection across natural Egyptian-Arabic questions, confusion handling, company-specific information grounding and useful noninvasive clarification. Current implementation is published exact-match FAQ + basic keyword category detection, **NOT yet real generative AI**.
- More helpful program/service matching based on expressed needs (date/budget/people) only when approved data actually exists; never fabricate price or availability.
- Clean staff lead board and WhatsApp inbox operational UX: focus on READY leads, context summary, employee pickup, SLA/new-lead notifications and practical search.
- Meta Cloud API real enrollment, signed webhook/provider operations with actual test number, key rotation and robust message failure reconciliation.
- Minimal tenant onboarding, privacy/opt-out, staff roles, bot subscription activation and simple usage measurements.
- Safely remove/archive dormant old booking/inventory/financial UI/backend modules and adjust stale documents/tests while preserving migration history.

## Not part of this chatbot (not in backlog)
Booking confirmation, seat/room allocation, payment/refund records, invoices, bank/accounting, traveler passports/files, supplier contracts, broad CRM or billing engine. Human employee performs reservations and followup OUTSIDE bot.

## Final verification (once after feature build, per owner)
Complete fresh checkout/install + PostgreSQL/RLS, browser/mobile experience, real Meta provider message-to-lead-to-agent E2E, role & tenant security, duplicate webhooks, handoff race conditions, failure/restore, privacy and performance. Only then merge draft PR and pilot. Current refactor not yet accepted/tested on real systems.
