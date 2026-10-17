# FIRST READ IN EVERY NEW CHAT — 2026-10-17

## CRITICAL OWNER SCOPE CORRECTION
Read `docs/00-SCOPE-CHATBOT-ONLY.md` first. **Elhafez Boat is just a WhatsApp tourism sales chatbot**, not an ERP, booking engine, accounting, payments or travel reservations system. The owner strongly rejected unnecessary booking, refunds, invoices, traveler documents, broad inventory and complex CRM scope. **Never reintroduce these.**

User expects bot to answer repetitive customer messages, understand approved program/service interest in natural Arabic, gather a couple of optional preferences, and show employees **qualified leads ready for a human**. Human handles all actual booking/follow-up outside Elhafez Boat. When human takes over, bot must stop.

## Repository and state
- Repo `hendhafez5566-arch/Elhafez-boat`, PUBLIC deliberately.
- Working branch `feat/stage0-foundation`, DRAFT PR #1 UNMERGED.
- Latest changes: created `docs/00-SCOPE-CHATBOT-ONLY.md`; migration `0014_chatbot_leads_only.sql` and `apps/api/src/chatbot-leads.ts`; refactored `apps/api/src/whatsapp.ts` to **interest -> optional party count -> rough travel date -> lead READY_FOR_AGENT + HUMAN handoff**. Backward old `book:` buttons become interest, never booking.
- `apps/api/src/server.ts` no longer exposes booking confirmation, booking creation or hotel/room inventory API routes; added GET `/api/v1/leads`, GET `/api/v1/leads/summary`, PATCH `/api/v1/leads/:id/stage`.
- Simplified `apps/web/public/index.html`, `app.js`, `operations.js` navigation and dashboard to **العملاء المهتمون / محادثات واتساب / معلومات البرامج / العروض / معاينة البوت / الإعدادات / ربط واتساب / الموظفون**. Staff sees interest, headcount, travel preference and customer number. Demo creates fake browser-memory leads, never fake booking.
- Service/program publication no longer depends on seat inventory. Published program facts are informational; employee confirms actual availability.
- Legacy booking/departure/room modules and some archived UI/SQL structures still exist on branch and **must be safely retired/cleaned**, not expanded. Migrations 0001–0013 remain for historical/schema compatibility; 0014 must run after them.

## NO FALSE READINESS
Changes committed to GitHub. No clean checkout compilation, PostgreSQL migration/tenant isolation, live Meta Cloud API or browser E2E was run for latest scope refactor. There is NO live Meta number, production deployment, working actual booking, automated billing or generative AI provider. Some previous isolated checks exist, but are NOT final acceptance proof.
Owner explicitly wants **ONE FINAL comprehensive acceptance stage only after relevant CHATBOT feature build**; lightweight sanity checks during coding okay.

## Actual NEXT work
1. Safely retire dormant overbuilt modules/screens without breaking minimal chatbot app or migration path.
2. Polish bot natural-language intent for Egyptian customers and response grounding on approved catalog/FAQ; optional LLM only when approved/configured, never fabricate facts.
3. Refine lead queue, human pickup/notifications, concise agent context, filters, simple statistics and provider error handling.
4. Once feature scope is complete, run formal acceptance as one final round and then review/merge/deploy pilot.

Review actual commit/branch/PR each session. Never ask user again whether they want booking/invoicing; **they do not**. Keep `CURRENT-STATUS.md` and `REMAINING.md` updated.
