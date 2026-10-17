> **HISTORICAL / SUPERSEDED (2026-10-17)** — The owner rejected ERP/booking/finance expansion. The authoritative scope is [WhatsApp chatbot-only lead assistant](00-SCOPE-CHATBOT-ONLY.md). Any booking, payment, refund, traveler records or system-management requirements in this older document are **NOT product requirements and MUST NOT be built**. Human staff handles all reservations and follow-up outside the bot.

# Menu and Flow engine contracts

A menu node has: id, tenant_id, draft/published version, title, description, optional guard, list of options.
Each option has: immutable action_id, visible Arabic label, optional description, sort order, visibility rule, action type and target.
Actions: OPEN_MENU, LIST_PROGRAMS, SHOW_PROGRAM, START_BOOKING_FLOW, TRACK_BOOKING, HANDOFF_AGENT, BACK, HOME.
Program lists are generated dynamically from published, eligible catalog data; they are not hardcoded. Rendering enforces Meta character, button, row and payload constraints, and provides fallback navigation.

Booking Flow draft: program/departure -> party size -> room selection -> contact details -> review -> submit provisional request. Server revalidates price, capacity and terms at submission; never trust client-submitted price or program availability.
Validate unreachable nodes, cycles without exits, broken targets, missing translations, invalid payloads and stale version references before publish. Simulate complete paths. Preserve active conversation version or migrate explicitly. No destructive edits to published versions.
