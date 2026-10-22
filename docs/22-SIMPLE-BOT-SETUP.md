# Elhafez Boat — usability-first chatbot creation (2026-10-18)

Implementation branch: feat/stage0-foundation, draft PR #1. No external account connection, merge or production deployment.

## First-time owner journey

1. Owner signs in and sees a company-specific setup checklist: bot published, approved catalog and optional Website Chat enabled.
2. Owner opens the Flow Builder and uses the Arabic "ابدأ بوت احترافي في 3 خطوات" wizard. The existing validated engine is preserved: START / TEXT / BUTTONS / CATALOG / INPUT / TAG / HANDOFF.
3. Choose one of seven business categories and one of three objectives (capture qualified inquiries, browse the approved catalog, ask staff). Optionally type a description in Arabic. Suggestions are local deterministic keywords, not generative AI.
4. Provide company name and optional catalog category; inspect the customer journey. Existing saved/published drafts prompt before replacement.
5. Preview on the existing flow engine, explicitly Save Draft, and publish only by a separate manual action. No automatic provider activation or outbound sends.

No made-up price or availability: catalog nodes only display published company records. Business data must be entered and approved by its owner.

## Daily CRM, follow-ups and reports

- Daily destinations show first; advanced settings remain in an accessible disclosure.
- CRM shows pipeline stages, transparent rule-based lead priority 0–100, open followups, staff-authored dated tasks and completion.
- Lead tasks are tenant-scoped by FORCE/RLS, staff permissions are checked, completion is audited, exports include callback tasks, and privacy erasure deletes their descriptions.
- "تحليلات البوت" shows last 30 days of conversations, leads captured, channel breakdown, follow-up workload and campaign overview. A lead-capture ratio is not a sales conversion rate.
- Marketing quick-start fills campaign DRAFTS only. Sending requires approved templates, customer consent, a live channel and an explicit launch.
- AI answering can try conservative, unique matching to approved catalog/FAQ material without an external model. Ambiguous questions return clarification or staff help. This is not a complete autonomous AI Agent.

## Verification and limits

- Unit tests: guided-flow.test.mjs, guided-intent.test.mjs, grounded-match.test.mjs.
- Runtime acceptance checks real CRM create/read/complete and tenant isolation for analytics.
- Browser acceptance records the wizard without saving or publishing.
- Migration 0026_lead_followups.sql requires an authorized migration role, plus runtime low-privilege grants.
- Not delivered: a full autonomous AI Agent, comment-to-DM social automation, comprehensive sales deal tracking/billing, on-platform booking/order execution, provider-authorized external sends, or certification of production load. Do not claim them complete.
- Current code status must be qualified by the latest matching CI results, not historical green checks.
