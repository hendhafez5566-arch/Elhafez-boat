# Mandatory AI/developer instructions — chatbot-only scope

**READ FIRST**: [docs/00-SCOPE-CHATBOT-ONLY.md](docs/00-SCOPE-CHATBOT-ONLY.md). This document is the owner's latest explicit decision and **OVERRIDES every earlier tourism ERP, booking, finance, billing or extensive CRM plan**.

## Product
Elhafez Boat is an Arabic RTL, multi-agency **WhatsApp sales-assistant chatbot**. Its role is answering repetitive questions based on company-approved services, understanding customer interest, asking a few useful clarifying questions, and surfacing **qualified leads for a human employee**. The employee executes all reservations, payments, documents and customer followup outside this chatbot. The chatbot never makes or confirms bookings.

## In scope
- Official WhatsApp Cloud API webhook, interactive menus/buttons, approved FAQ and program/service facts; optional safe grounded AI.
- Minimal service/offer catalog authored by agency, welcome/menu settings, preview.
- Short qualification: interested service, approximate travelers, preferred timing, request staff; all optional except explicit request to be contacted.
- Qualified leads and WhatsApp inbox with visible context and handoff, simple agency staff roles, bot stops once staff takes over.
- Minimal tenant/company and subscription activation administration if needed to sell separate chatbot accounts.
- Clean, simple, accessible Arabic RTL UI, privacy/consent and safe data handling.

## Strictly OUT of scope (do not rebuild)
- Booking engine or reservation confirmation, travel supplier allotments, confirmed seat allocation, passports/traveler records, payment/accounting, invoices, refunds, contracts, sophisticated ERP/CRM workflow, campaign automation, or automatic billing.
- Existing older booking/room/Flow code and database migrations are **legacy overbuild**, not product approval. Active booking API routes have been disabled. Preserve Git history; reduce dormant code safely without breaking startup.

## Operational rules
- Official Meta platform only; NEVER automate personal WhatsApp or bypass provider policies.
- Cross-company isolation and least privilege in every read/write; do not commit secrets or real personal data to PUBLIC repo.
- Approved content only: never invent prices, availability, cancellation/visa rules, payment status or booking confirmations.
- No marketing template to a customer without documented consent; no automatic campaigns by default.
- Staff has full control: human takeover silences bot, lead stage editable by staff.
- Read real source and verify branch/commit; do not claim runnable or approved without proof.
- User prefers **one final comprehensive acceptance phase after feature construction**. Routine compilation/syntax checks during code development are okay, not a substitute for acceptance.
- Before ending any session update project-management/CURRENT-STATUS.md, HANDOVER.md and REMAINING.md accurately. Do not re-ask settled scope.

Repository `hendhafez5566-arch/Elhafez-boat`, working branch `feat/stage0-foundation`, draft PR #1. No merge/deploy without final evidence.
