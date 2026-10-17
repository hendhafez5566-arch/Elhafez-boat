# Changelog — most recent first

## 2026-10-17 — Product-owner chatbot-only correction (overrides previous scope)
- Owner explicitly rejected broad tourism management/booking, finance, payment/refunds, passports/docs and complex ERP. Product is **WhatsApp sales assistant to answer questions, understand intent and deliver qualified lead to a staff member**.
- Created immutable decision file `docs/00-SCOPE-CHATBOT-ONLY.md`; replaced AGENTS, README, master plan and handover to stop future scope creep.
- Added migration 0014 tenant-isolated `chatbot_leads`, new lead service/API stages and staff lead dashboard/inbox context.
- Refactored WhatsApp bot from customer booking/Flow/room selection to **interest → two optional qualification questions → human employee takeover**. Legacy `book:` button IDs safely become interest only.
- Retired booking/room allocation API routes, removed flow setup and excessive dashboard navigation, repurposed browser-only demo from mock bookings to mock qualified leads.
- Existing legacy business modules in Git history remain technical-debt cleanup, NOT remaining product features.
- No live provider/DB acceptance or commercial deployment yet.

See actual Git commit history for previous extensive implementation. Previous changelog references to booking functionality are historical and were superseded by the owner's scope correction.
