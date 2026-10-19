## Latest Elhafez usability evidence — 19 October 2026

Actual source a3b6418 / final test 8f0ad62. See [execution ledger](EXECUTION-LEDGER.md) for eleven desktop/mobile screenshots, actual functional journeys, source-to-screen mapping and remaining gaps; [verification](evidence/usability-verification.json). All are synthetic PostgreSQL fixtures, with no live provider action. Previous before images remain intact. 81 broad page visits are loading checks, not claims all 22 screens are complete.

# Evidence index: actual user-supplied references and safe access

## User supplied in conversation, 19 October 2026
- **22 BotSailor dashboard/bot manager/channel/account/inbox/subscribers/campaign/settings/billing/commerce screenshots**, plus Flow Builder first-start screenshot (roughly 23 originals); captured by the owner in their browser. Screens of actual logged-in account may contain account names, phone numbers and provider identifiers.
- **108-second BotSailor Flow Builder screen-recording**: a real browser walkthrough, not an implementation of Elhafez. 0–12 s Start+component menu; 12–47 s Text editor; 48–83 s interactive message/branching; 84–108 s button and row settings. The original MP4 is 59 MB; compressed 516 KB version exists in the owner's handoff ZIP but is **not committed to this public Git repo**.
- User's `ELHAFEZ_BOAT_VISUAL_BENCHMARK-1.html`: public official links, 7 mockups, 22 screen contracts; proposed HTML, NOT actual code.
- Two historical audit suites: functional `DEEP_UI_AUDIT.md` (15 QA issues, 74 journeys: 46 pass/12 fail/16 blocked) and `VISUAL_UI_AUDIT.md` (26 UX/visual findings: 4 definite defects, 22 observations, 21 sections visited). These were captured before merged PR #3; do not blindly re-open resolved issues. The source repo contains `docs/35-DEEP-UI-UX-REBUILD-2026-10-19.md` for earlier remediation and remaining gaps, and `docs/UI-AUDIT-FIX-2026-10-19.md`.

## Source-to-design interpretation
- Main shell: short, predictable left navigation, live status header, one primary action per page, logical nested tabs.
- Bot Manager: select account/bot first, then edit that bot's automation, data collection, AI, engagement, commerce, integrations; screenshots do NOT prove these integrations work in Elhafez.
- Builder: mostly canvas and compact toolbar, contextual left palette and node inspector; progressive disclosure of complex actions.
- Inbox: multi-column chat and selected customer context, mobile stacked view.
- Channel setup: truthful status and structured guided official connection prerequisites.
- Campaign/CRM: list-first, search/filter, empty state/action and visible status.
- Settings: role-specific tabs and separation of security, provider API and destructive actions.

## Public official references
- [Manychat — Building automation](https://help.manychat.com/hc/en-us/articles/14281166306332-How-to-build-a-Manychat-automation)
- [Manychat — Home Overview](https://help.manychat.com/hc/en-us/articles/14281085896476-Home-tab-Overview)
- [Manychat — Preview automations](https://help.manychat.com/hc/en-us/articles/14281198254620-How-to-preview-automations-in-Manychat)
- [BotSailor — Upgraded no-code chatbot builder](https://botsailor.com/index.php/blog/explore-the-upgraded-no-code-chatbot-builder)

## Privacy of references
The repository is PUBLIC. Do NOT commit original screenshot archives, raw tenant session logs, visible phone numbers or customer data, huge embedded-data `VISUAL_UI_REVIEW.html`, private tokens or competitor branded assets to production CSS/JS. **A source screenshot illustrates a design but is NOT your product's UI, data, app capability or license to clone code.** If original full-resolution assets are needed, request owner to attach them in the Codex task UI if available, or use the ChatGPT Work handoff ZIP via a private authorized workflow. The complete original local package is `ELHAFEZ_BOAT_CHATGPT_WORK_COMPLETE_KIT.zip` and exists in the owner's ChatGPT artifacts, **not** at a public GitHub URL.

Any visual sheet included on this branch is deliberately downscaled and redacted; layout comparison only, not evidence of API functionality.

## Original diagrams in this repository

- [Bot workspace information architecture](diagrams/bot-workspace-IA.svg) — original illustrative structure from the owner's screenshot observations; it is **not** an actual competitor screenshot.
- [Full-canvas editor wireframe](diagrams/builder-target-wireframe.svg) — conceptual design of compact topbar + component sidebar + node canvas + contextual inspector; **not** a measured screenshot from Elhafez Boat.
