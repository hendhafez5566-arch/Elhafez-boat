# Mandatory instructions for any new AI coding session

Read README.md, docs/01-MASTER-PLAN.md, docs/02-ARCHITECTURE.md, docs/04-WHATSAPP-BOT.md, docs/05-MENUS-AND-FLOWS.md, docs/06-DASHBOARD.md, docs/07-BUSINESS-RULES.md, docs/08-SECURITY.md, docs/09-TEST-STRATEGY.md, docs/10-DECISIONS.md, project-management/CURRENT-STATUS.md and project-management/HANDOVER.md.

Then verify the actual repository tree, branch, latest commit, tests, open PRs/issues and deployment state. Documentation is not proof of implementation. Never invent passing tests, screenshots, live integrations or progress.

## Work rules
- Build maintainable, Arabic-first RTL, accessible, mobile-friendly SaaS; prefer simplicity and modularity over patches.
- Company/tenant isolation on every data query and authorization boundary.
- Official WhatsApp Business Platform only; lists/buttons/Flows are provider-controlled UI. Check current Meta constraints before implementing.
- Menus and conversation workflows are data-driven, versioned, validated and published atomically; immutable stable action IDs, never route by visible Arabic labels.
- AI cannot fabricate price, inventory, travel dates, policies, confirmations or payment outcomes. All business actions validated by deterministic services.
- Human handoff must prevent simultaneous bot responses.
- Booking request != confirmed booking. Preserve price/terms snapshots and audit changes.
- Never commit credentials, access tokens, PII, customer chat transcripts or production exports.
- Implement tests for each change. Do not weaken tests to make builds pass.
- Before ending ANY coding session, update CURRENT-STATUS.md and HANDOVER.md with verified branch/SHA, changed files, executed commands/results, blockers and exact next action. Update COMPLETED/REMAINING/CHANGELOG as needed.
- Use feature branches and reviewed PRs for implementation; avoid direct risky production deployments.
- If access/credentials missing, finish safe offline work and document blocker precisely rather than pretending completion.
