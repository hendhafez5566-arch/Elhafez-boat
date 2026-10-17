# Revised master plan — WhatsApp chatbot only (2026-10-17)

**The owner's explicit correction replaces all earlier broad tourism ERP/booking SaaS plans.** Primary source: [00-SCOPE-CHATBOT-ONLY.md](00-SCOPE-CHATBOT-ONLY.md).

## A. Chatbot and information (feature build)
- Company connects official Meta WhatsApp Business Cloud API number.
- Company enters only relevant **program/service info** (title, category, description, advertised price/dates), published FAQ and welcome/menu configuration.
- Bot answers repetitive customer questions accurately, understands short Egyptian-Arabic utterances when possible, shows helpful interactive choices and knows when to ask for clarification.
- Optional external LLM is allowed only to interpret natural-language intent **grounded** in approved company data; if provider unavailable, deterministic fallback menu/FAQ still works.
- Never reserve seats, charge money, manage traveler documents or confirm a booking.

## B. Lead qualification and human handoff
- Customer can mark **interest** in a program or ask for staff at any point.
- Ask minimal relevant optional qualification questions (party size, rough timing; later budget only if demonstrably useful).
- Store lead linked to real verified WhatsApp sender, contact, conversation and program; stages **INTERESTED / READY_FOR_AGENT / CONTACTED / CLOSED**.
- Staff sees leads, preferences and chat, claims conversation; bot stops. Employee books/follows up outside this product.

## C. Lean multi-agency operations
- One intuitive Arabic RTL dashboard for leads, inbox, programs/services, offers, approved FAQ, basic staff roles and WhatsApp connection.
- Minimal platform owner tenant/account activation and basic subscription control only to support selling the bot separately to companies. No billing ledger or automatic invoice/payments system.
- Least-privilege company isolation, secure provider token storage, webhook signature verification, idempotency, consent/opt-out.

## D. Finish feature development then ONE final acceptance stage
- Keep basic syntax/type safeguards as needed while editing.
- One formal combined acceptance phase at the end: clean checkout/build, PostgreSQL migration + tenant RLS, Meta provider webhook and bot replies, qualified lead + human takeover, browser/mobile UX, security/load/failure recovery, privacy.
- Fix defects and only then merge PR, provision hosting/domain and launch pilot.

## Explicitly removed from scope
Booking/reservation APIs; payment/refund accounting; traveler documents; supplier allotments, multi-room inventory; automatic campaigns; advanced ERP features; finance and automated subscriptions/billing. Previous code related to these is legacy overbuild to retire, **not a feature backlog to finish**.

Status as of 2026-10-17: partial code exists in draft branch, including lead queue and bot handoff. **No verified live deployment or complete final acceptance yet.**
