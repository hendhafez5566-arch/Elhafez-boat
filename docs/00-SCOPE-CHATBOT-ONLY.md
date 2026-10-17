# AUTHORITATIVE PRODUCT SCOPE — WHATSAPP SALES ASSISTANT ONLY

**Owner correction — 2026-10-17. Overrides conflicting older planning, master-plan, PR summaries or implementation assumptions.**

## What Elhafez Boat IS

A lightweight, independent, multi-agency WhatsApp **sales-assistant chatbot** for tourism and Umrah/Hajj companies. Its value is answering repetitive questions, understanding what a customer wants, recommending agency-approved services/offers, and delivering a **qualified, actionable lead** to a human staff member. The bot replaces repetitive customer-chat handling, **not the company's reservation/accounting/operations software**.

### Customer journey

1. Customer messages the company's own official WhatsApp number.
2. Bot greets, understands the question or guides via official lists/buttons. Responds only using approved company program/service information, prices and policies; ask clarifying questions when necessary. Optional grounded AI can handle natural Arabic text.
3. Bot identifies intent: what service/category/program interests the customer, approximate travel timing, party size, budget or preferences **only if useful and voluntarily provided**.
4. Bot asks whether the customer wants a sales employee to contact/assist. A clear click/request marks **qualified lead / ready for human**.
5. Staff dashboard/inbox displays customer identity/WhatsApp, interests, key answers, relevant company program, last messages and lead stage. Staff claims/replies and performs the **actual booking, payment and follow-up externally** using existing company processes.
6. Human takeover stops automatic bot replies. Customer can request staff at any time. No false booking confirmation.

### Minimum agency dashboard
- WhatsApp connection, bot messages/menus, approved Q&A and service/program cards with informative dates/prices.
- Unified WhatsApp inbox showing **New / Interested / Ready for staff / Handed off / Closed** leads, search, assignee and short context summary; optional minimal team roles.
- Lightweight statistics: inquiries handled, interests, qualified leads, employee handoffs, unattended conversations.
- Platform-level agency accounts/subscription permissions only if required to sell this chatbot to multiple companies. Do **not** build a general ERP.
- Arabic-first, simple RTL UX and a meaningful browser-only bot simulator clearly marked DEMO.

### Strict boundaries / MUST NOT BUILD
- No booking/reservation execution, booking approvals, capacity allocation, final traveler booking records or confirmed service status inside bot.
- No invoices, ledgers, bank/payments, refunds, tourism financial accounting, supplier contracts, passports, visas, traveler documents or complex room allotment logic.
- No automatic customer order/payment follow-up. Human does that.
- No automated marketing campaigns without distinct future approval. Consent and Meta's message rules still apply for service messages.
- Prior code for bookings, departure/room allocation, commercial billing, complex workflows **is legacy overbuild** and NOT the intended MVP. Preserve git history but remove it from customer bot flow and primary UI/API surface; do not keep expanding it. The presence of code does not mean owner approved feature scope.

### The product acceptance scenario (final testing stage ONLY)
Company edits service card/approved FAQ -> customer asks in natural Arabic or selects menu -> bot replies accurately -> client indicates interest -> bot captures relevant answers -> **qualified lead** appears in employee inbox -> employee takes over and uses the company's own reservation workflow. Confirm that **no booking/payment/financial action** was performed by Elhafez Boat.

**Process:** Owner wants feature implementation first, one formal end-to-end acceptance phase at the end. Lightweight build/type checking during construction is allowed; never claim full readiness without evidence. Repo stays PUBLIC by owner's preference; never commit real secrets or customer data.
