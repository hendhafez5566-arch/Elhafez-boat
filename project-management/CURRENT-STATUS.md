# CURRENT STATUS — chatbot-only pivot, 2026-10-17

**PRODUCT:** Elhafez Boat is an independent, Arabic RTL, multi-agency WhatsApp sales-assistant CHATBOT — NOT an ERP, booking engine or financial system. Authoritative product document: `docs/00-SCOPE-CHATBOT-ONLY.md`.

**GitHub:** `hendhafez5566-arch/Elhafez-boat`, public by owner choice; work on `feat/stage0-foundation`, draft PR #1, not merged or deployed.

## What changed in this scope correction (SOURCE COMMITTED)
- Dedicated `chatbot_leads` schema, migration `0014_chatbot_leads_only.sql`, tenant RLS and qualification stages.
- Bot now only reads company-approved service cards and FAQ, recognizes common Arabic tourism categories, handles `interest:` / previously issued `book:` buttons as **interest only**.
- Asks how many travelers and approximate time (both may be unknown), records `INTERESTED` then `READY_FOR_AGENT` lead and transfers conversation to HUMAN. Explicit staff request bypasses questions.
- Human takeover prevents further bot messages; agent may view context/claim thread and reply. Staff can mark lead CONTACTED / CLOSED.
- Staff APIs added `/api/v1/leads` and `/api/v1/leads/summary`; booking creation/confirmation/cancellation and departure/room inventory API routes disabled.
- Lean Arabic dashboard navigation: overview, qualified leads, WhatsApp inbox, program/service information, offers, bot simulator, approved settings/FAQ, WhatsApp link and staff. Staff inbox now shows the service, party size and preferred time.
- Browser-only demo creates **fake leads in memory, never fake bookings**.
- Approved program publish is no longer gated on seat counts. **Bot never confirms places, payments, or reservations.**

## Technical debt / remaining simplification
Earlier migrations 0001–0013 and inactive source still include a larger booking/room/financial vision. They are NOT active scope and must be safely retired instead of finished. The current SQL schema history remains to avoid breaking existing migration chains. Some dormant browser forms remain in DOM for old renderer compatibility; they are not in the main navigation.

## Verification truth
Files committed to GitHub. **No clean checkout build/CI or real PostgreSQL 0014 migration, real Meta interaction, complete browser E2E, or final acceptance has been executed on this new scoped version**. No production Meta number, hosting or live AI provider. Do not infer readiness from file commits.

## Next within CORRECT scope
Tighten natural Arabic intent recognition with an optional grounded provider, simplify old dormant code without regressions, staff handoff/lead notifications and usability polish. After chatbot scope is feature-complete, **ONE final comprehensive acceptance phase** (owner request), then possible merge and pilot.
