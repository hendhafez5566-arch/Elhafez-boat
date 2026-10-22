# CODEX INSTRUCTIONS — EXECUTE SOURCE CODE, NOT ANOTHER REPORT

ROLE: Lead full-stack implementer + senior SaaS product designer + UX acceptance engineer.

REPO: `hendhafez5566-arch/Elhafez-boat`.
READ FIRST: `AGENTS.md`, `docs/00-SCOPE-CHATBOT-ONLY.md`, then **every file** in `docs/product-rebuild/` and the relevant existing audit/acceptance docs. Study actual DB schema, models, server routes, flow engine, frontend, package scripts and CI instead of assuming specs describe implementation.

## Owner's explicit goal
A professional multi-company, multi-bot chatbot SaaS comparable in task organization and capabilities to the **best ideas** from BotSailor and Manychat, but **original, Arabic RTL, clearer/easier for nontechnical company staff**, with the Elhafez Boat identity. User expressly rejected previous CSS-only makeover as cluttered and poor. Build the product's *real workflow*.

## Mandatory execution
- **Do real large cohesive batches** of code, additive DB migrations, tests, and UI; preserve working app; create a **new implementation branch from the handoff branch** (which contains these references) and open **one Draft PR targeting `feat/stage0-foundation`**. Confirm current target HEAD/PR/CI first. Do not merge `docs/codex-product-rebuild-2026-10-19` directly into production-linked branch.
- Critical path: **(A) independent bot entities + channel/account association + legacy migration + server isolation; (B) usable bot manager and independent publish per bot; (C) builder canvas and step inspector; (D) inbox/CRM/channel onboarding; (E) other S01–S22 areas; (F) complete real-browser acceptance.** These are execution checkpoints within ONE coherent PR, not requests for repeated owner permission to write code.
- Treat connected channel credentials, messaging state, shared catalog/media/FAQ resources, platform admins, campaigns and message routing as a **data-flow mapping exercise** before schema changes. Never use placeholders that look like live integrations; block unsupported actions honestly.
- Product IA: main menu **الرئيسية، صندوق الوارد، إدارة البوتات، العملاء، الحملات، القنوات والتوصيل، الإدارة والإعدادات/التقارير**; a selected bot has **الأتمتة، جمع البيانات، AI، التفاعل، التجارة، التكاملات** only where real functions exist.
- Flow creator: single `Start` canvas by default, **click connector → select component → contextual editor → wire outputs → preview → save draft → validate/publish**. Fit viewport from first paint; separate simple beginner step view, full advanced canvas, mobile step-based editor. Preserve undo/redo, type-specific buttons/list rows, keyboard/focus, scrollable inspector, version conflict backup. Never hide or simulate actual engine semantics.
- Words in user UI: `إضافة رسالة`, `إضافة زر`, `لما العميل يضغط`, `اطلب رقم الهاتف`, `تجربة المحادثة`, `حفظ كمسودة`, `نشر البوت`. Technical IDs, Webhooks, HTTP fields and internal enums belong under 'متقدم' or explanatory labels. Clear empty/failed/loading states.
- Unified design: original purple/indigo Elhafez branding; green=success, orange=warning, red=error, always reinforced by text/icons; legible Arabic, uncluttered controls; real RTL; desktop 1366, tablet 768, mobile 390/320 and 200% zoom. No duplicated headings, vast marketing banners preceding work, inaccessible drawers or clipped Arabic.

## Must maintain
- Multi-tenant isolation, role authorization on server, cookie/CSRF, provider signatures and Meta compliance; no fake account connection.
- Preserve all existing drafts/published definitions/step IDs, existing conversations, contacts, official channel setups, company settings and release history. Additive, reversible migrations with verified backfill. No forced republish of historical bots.
- Platform is for **all types of businesses**, not tourism-only, and is not an ERP; no accounting/booking/commerce fulfilment engine. Order/payment/booking completion stays with business staff.
- No copy/paste of competitor source code, marks, or copyrighted images in the production UI. References are informational.

## Strict prohibitions
- No pushing into or merging to `main` or `feat/stage0-foundation` without fresh explicit owner consent.
- No Railway deploy, no unrequested infrastructure costs, no Meta/Facebook/Instagram/WhatsApp/Telegram authentication, real sending, connected production accounts, or bulk-message sends.
- No destructive DB commands (`DROP`, `TRUNCATE`, `prisma reset`, `docker compose down -v`), no changes to real tenant/customer data; use disposable fixtures.
- Do not weaken, remove or rewrite tests to hide real failures. Update selectors/fixtures only when user-visible semantics legitimately change and assert equivalent behavior.
- Do not call 'COMPLETE' on a feature without independent browser evidence; list unimplemented/blocked functionality honestly.

## Output contract
1. One linked Draft PR and latest tested HEAD.
2. Implementation ledger S01–S22: DONE+TESTED/PARTIAL/NOT_DONE/BLOCKED with source files, commits and screenshots.
3. Migration/backfill/test proof for tenant A bot A/B and tenant B.
4. Actual `BEFORE/AFTER` desktop + 320/390 mobile screenshots from the built app, not BotSailor images/mockups.
5. User journeys: create first bot, flow with 3 buttons, data capture, human handoff, draft save, reload, channel-aware publish, manual inbox and lead context.
6. All test commands and results, known gaps, and handover docs `project-management/CURRENT-STATUS.md`, `HANDOVER.md`, `REMAINING.md`, changelog.
7. Final owner-facing concise Arabic summary that never claims provider verification without provider connection.

**Your FIRST substantial output should be a commit on the implementation branch, not a rephrased plan.** If blocked, clearly identify the blocker and move to another safe deliverable.
