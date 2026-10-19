# S01–S22: Screen and journey acceptance ledger

For EACH item Codex must record status `DONE+TESTED / PARTIAL / NOT_DONE / BLOCKED_PROVIDER`, actual commit/files, browser screenshot(s), API/DB tests and limitations. **No checkbox is evidence of completion.**

| ID | Priority | Screen/flow | Observable acceptance |
|---|---|---|---|
| S01 | P0 | New company onboarding | Company → business → channel or skip → template → safe preview; back preserves answers; unconnected channel cannot publish |
| S02 | P0 | Dashboard | Real API metrics, create bot/inbox/channel shortcuts; honest zero/loading/error; no marketing billboard before work |
| S03 | P0 | Template gallery | Arabic search, preview and copy-to-draft, no hidden publication or invented vendor behavior |
| S04 | P0 | Bot list and context | Create/select/rename/archive bot, channel state, own settings/flows/published version; two bots truly isolated |
| S05 | P0 | Beginner flow builder | Step list with message/buttons and branch actions; same saved FlowDefinition as canvas; undo/redo |
| S06 | P0 | Advanced canvas | Start → connect outport → contextual component menu → edge; pan/zoom, multi-branch, drag, keyboard and RTL |
| S07 | P0 | Context inspector | TEXT/BUTTONS/LIST/INPUT/CONDITION/HANDOFF/MEDIA, correct per-channel constraints and no silent data loss |
| S08 | P0 | Chat simulator | True draft execution, input, options, fallback/handoff, nested/long thread scrolling; clearly not live publish |
| S09 | P0 | Triggers | Actual bot/channel/flow route, keyword and other supported event types, no orphan references |
| S10 | P0 | Shared inbox | Conversation selector, thread, contact context, bot/manual takeover, private note not sent externally |
| S11 | P0 | Contact/lead directory | Arabic/phone search, filters/chips/reset, true pagination, permission-safe bulk actions |
| S12 | P0 | Contact profile | Summary, conversations, custom fields and historical activity, tenant isolation and real message linkage |
| S13 | P1 | Campaigns/broadcast | Channel → consented audience → content → schedule → confirm; no actual send for acceptance |
| S14 | P1 | Analytics | Defined genuine KPIs, period selector, real trend or accurate empty/loading/error |
| S15 | P1 | Media/catalog | List-first, status and explicit currency, upload/scan lifecycle, add/edit on demand |
| S16 | P1 | AI and knowledge | Configure real source/agent, preview and activation only when provider actually enabled |
| S17 | P0 | Channel directory/setup | Live/unavailable/unconnected statuses, channel-specific prerequisites, official integration consent |
| S18 | P1 | Integrations | Plain tasks, secrets masked, advanced-only API/webhook, SSRF/permissions tests |
| S19 | P1 | Team and roles | Actual owner/manager/agent/viewer permission matrix, invitations and errors |
| S20 | P1 | Company/plan/usage | Real company settings; plan/billing only if backend exists, else honest unavailable state |
| S21 | P1 | SaaS owner portal | Tenant overview, admin separation, logs and no presumed access to private chats |
| S22 | P0 | Responsive/system UX | 1366, 768, 390, 320px, 200% zoom, no unintended overflow, RTL, focus/keyboard/touch layout |

**Reference source:** owner-provided `ELHAFEZ_BOAT_VISUAL_BENCHMARK-1.html`, audit reports `DEEP_UI_AUDIT.md` and `VISUAL_UI_AUDIT.md`. This matrix is a concise faithful handoff, not assertion all 22 screens already exist or are done.

**Release priority:** multi-bot architecture + full user create/preview/publish simulation + connected-channel truthfulness + safe migration are P0. Fail the milestone if all that exists is a styled frontend.
