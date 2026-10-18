# Elhafez Boat — Mandatory instructions for developer agents

**READ FIRST:** `docs/00-SCOPE-CHATBOT-ONLY.md`. Latest owner decision: **a general-purpose chatbot SaaS for ALL businesses and shops**, not a tourism-only chatbot and not an ERP.

## Product
- Businesses connect messaging accounts and configure conversation flows without code: messages, buttons, lists, questions/custom fields, conditions, tags, media/links, human handoff, FAQs, product/service information.
- The same flow builder works for retail, clinics, real estate, restaurants, education, tourism and other industries. Do not hardcode UMRAH/HAJJ as universal categories.
- Platform facilitates communication, collects intent and hands off to employees. Employees handle actual orders, bookings, payments, refunds and fulfilment outside this software.
- Maintain per-tenant isolation, least privilege, Meta policy compliance, secure secrets and signed webhooks. No fictional offer/price/availability.
- WhatsApp Cloud API and Website Chat now have source adapters; live acceptance is still separate. Messenger/Instagram/Telegram now have source adapters; no live provider activation is implied. Read docs/19-ADVANCED-RUNTIME.md for account types and limits.
- Preserve git history and safely retire previous booking/room/finance overbuild; **do not extend it**.

## Workflow
- Repository: `hendhafez5566-arch/Elhafez-boat`, PUBLIC by owner decision.
- Continue branch `feat/stage0-foundation`, draft PR #1. Check real HEAD and state before editing.
- Inspect files; implement real code, don't claim missing features complete. Minimize dependencies and never commit API tokens/actual customer data.
- Keep one formal comprehensive acceptance test phase **after all approved chatbot features are built**; small compilation/syntax safeguards during development are acceptable.
- Update `project-management/CURRENT-STATUS.md`, `HANDOVER.md`, `REMAINING.md` and changelog after source edits, with verifiable feature status.
