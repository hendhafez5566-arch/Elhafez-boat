# Elhafez Boat — WhatsApp sales-assistant chatbot

> **Scope corrected by product owner on 2026-10-17: This is a CHATBOT, NOT a tourism management/booking system.** Read [authoritative chatbot-only scope](docs/00-SCOPE-CHATBOT-ONLY.md).

Elhafez Boat is an Arabic-first, multi-company assistant connected to an agency's official WhatsApp Business number. It handles repetitive questions about the company's own programs and services, figures out what the customer is interested in, asks brief clarifying questions, and sends a clear **qualified sales lead** to an agency employee.

**The employee** contacts the customer, books the service and manages everything afterwards with the company's existing workflow. Elhafez Boat **never reserves places, issues invoices, handles payments or stores travel documents**.

## Simple staff dashboard
- **العملاء المهتمون**: interested, ready for agent, contacted and closed, including service, party size and timing.
- **محادثات واتساب**: actual customer messages and handoff to named staff.
- **معلومات البرامج والعروض**: facts that the bot can quote; not an inventory or booking engine.
- **إعدادات البوت والأسئلة الشائعة**: approved business answers and menu versions.
- **ربط واتساب / الموظفون**: Meta account and simple access control.

## Development mode
- Current branch: `feat/stage0-foundation` (draft PR #1).
- Start local HTML demo: `node apps/web/server.mjs`, then open `http://localhost:3000` and click **استعراض التصميم ببيانات تجريبية**. Sample leads are browser-only and are never sent to Meta.
- See [setup](docs/11-LOCAL-SETUP.md) and [handover](project-management/HANDOVER.md) for backend operation and blockers.
- App is NOT yet deployed or acceptance-tested against a real PostgreSQL database or Meta number. Scope refinement was implemented as new source and reduced navigation/API; older dormant reservation source remains pending cleanup.
- Public GitHub repository by owner request: NEVER commit Meta access tokens, secret keys, or real customer data.

## Acceptance policy
After **feature development** is complete, run one combined end-to-end acceptance phase: real Meta webhook/menu and employee handoff, published program accuracy, lead qualification/inbox, tenant isolation, failure handling and responsive UI. Do not claim a finished live bot based solely on code commits.

## Project notes
[Current status](project-management/CURRENT-STATUS.md) | [Remaining](project-management/REMAINING.md) | [Authoritative plan](docs/01-MASTER-PLAN.md)
