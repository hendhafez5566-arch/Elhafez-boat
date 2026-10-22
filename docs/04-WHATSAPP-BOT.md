> **HISTORICAL / SUPERSEDED (2026-10-17)** — The owner rejected ERP/booking/finance expansion. The authoritative scope is [WhatsApp chatbot-only lead assistant](00-SCOPE-CHATBOT-ONLY.md). Any booking, payment, refund, traveler records or system-management requirements in this older document are **NOT product requirements and MUST NOT be built**. Human staff handles all reservations and follow-up outside the bot.

# Official WhatsApp bot design

Use official WhatsApp Business Platform Cloud API; no browser automation or unofficial libraries.

Entry: customer sends message -> welcome + interactive main menu.
Main categories: Umrah, Hajj, domestic tourism, international tourism, offers, track booking, human agent.
Category -> dynamic published programs -> details (price, dates, hotel, conditions, availability) -> reply actions: book / other programs / agent.
Booking -> WhatsApp Flow with travel date, party size, room type and contact data -> validated provisional booking -> staff review -> approved confirmation only after availability/payment checks.

Free text -> grounded AI (when enabled) -> approved facts only -> offer relevant structured choices; fallback/human handoff when uncertain.
Menu controls: labels, visibility, order, company branding text, FAQ, handoff policy; core booking validation is not tenant-editable.
Use supported interactive message types according to current Meta docs and limits. Classic reply buttons max 3 and classic list rows max 10; other interactive types have distinct rules. Flows availability, onboarding/coexistence, templates, message windows and pricing must be revalidated against current official documentation during integration.
Messages outside permitted service window require applicable approved templates, opt-in/consent and compliance. Keep app-to-API coexistence as an eligibility-dependent onboarding option; never assume it is guaranteed.
