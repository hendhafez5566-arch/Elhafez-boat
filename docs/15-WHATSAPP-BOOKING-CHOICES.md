> **HISTORICAL / SUPERSEDED (2026-10-17)** — The owner rejected ERP/booking/finance expansion. The authoritative scope is [WhatsApp chatbot-only lead assistant](00-SCOPE-CHATBOT-ONLY.md). Any booking, payment, refund, traveler records or system-management requirements in this older document are **NOT product requirements and MUST NOT be built**. Human staff handles all reservations and follow-up outside the bot.

# Customer WhatsApp booking: departure + room choices

Status: **source implemented on draft branch; not acceptance-tested on Meta/PostgreSQL**. Updated 2026-10-17.

## Customer navigation (no invented prices)

1. Open published category -> choose a currently available program. If all of a program's configured departures have expired or sold out, omit it from the WhatsApp program menu.
2. Program detail distinguishes the **indicative base fare** from the final price for selected travel date/hotel.
3. Press "طلب حجز". If the program has no explicit departures, proceed to booking form (legacy/basic catalog).
4. Otherwise show up to seven available, future departure dates with "next"/"previous" and "home" navigation (maximum ten WhatsApp classic list rows).
5. Once the departure is selected, if room packages are defined, show available hotels, room type, per-person price and available room units; the customer chooses a room.
6. After selections: if a **published Meta WhatsApp Flow** is configured, open that form with one-time tenant/account/conversation/program/departure/room-bound token. Otherwise collect traveler contact name and party size in messages.
7. Before creating a provisional booking, re-read program/selected future departure/room availability and per-person price from PostgreSQL; calculate required room units as ceiling(party size / room occupancy). Save ID selections and **price/currency snapshot**. A provisional request does not consume confirmed inventory or require money.
8. Staff confirmation atomically reserves program seats + departure seats + room units. Staff cancellation atomically releases previously confirmed inventory; repeated confirmation/cancellation must not reserve/release twice.
9. Customers can open "متابعة حجوزاتي" from the main WhatsApp menu to see up to five recent request statuses **only for the phone number supplied by the verified Meta webhook, scoped to the agency**. No customer-provided phone number can expand access.
10. A human agent can take over a WhatsApp conversation; concurrent agent takeover is serialized under row locking. Only the assigned agent (or manager/owner) may reply; bot does not speak over human handoff.

## Source files

- `apps/api/src/booking-choice.ts` — authoritative tenant/program/departure/room queries and booking snapshot insert.
- `apps/api/src/whatsapp.ts` — customer state navigation, status lookup, secure handoff.
- `apps/api/src/flows.ts` — one-time selection-bound flow token and validated final submission.
- `packages/database/migrations/0013_whatsapp_booking_choices.sql` — conversation state selections and Flow session selection references.
- `apps/api/src/services.ts` — staff bookings, capacity confirm/cancel and itinerary display fields.
- `apps/web/public/index.html`, `app.js` — staff displays and *browser-only* customer-status preview.

## Not implemented / acceptance pending

- Real published Flow creation with Meta; real WhatsApp provider account and provider-signed events.
- Selecting individual departure/room allocations directly within the Meta Flow form itself (currently selected in native list messages *before* entering Flow).
- Real traveler-level passports, visa details, documents, multi-currency exchange/conversion, package discounts, partial cancellations/refunds, payment verification and contract contingencies.
- Automated customer notification on staff confirmation/cancellation (requires approved WhatsApp templates/consent and correct service-window behavior).
- Full integration/security tests, official WhatsApp UI display limits, multi-agent concurrency, PostgreSQL migration 0013 and deployment.

**Owner's testing policy:** final comprehensive acceptance performed only when feature scope is complete. Do not call this feature commercially validated based on committed code.
