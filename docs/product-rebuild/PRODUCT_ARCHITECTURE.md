# Product architecture and interaction blueprint (grounded in user evidence)

## Observed fact — not a recommendation
At base SHA `ada4db6764c8ee8665764663b3a47351cf807637`, `apps/api/src/flow-service.ts` reads `chatbot_flow_drafts WHERE tenant_id=$1` and latest `chatbot_flow_versions WHERE tenant_id=$1`; `apps/api/src/server.ts` exposes `GET /api/v1/flows`, `PUT /api/v1/flows/draft`, `POST /api/v1/flows/publish`. This is one primary tenant-scoped flow configuration, **not evidence of independent multiple bots**. Code may have changed since; inspect HEAD. `apps/web/public/flow-builder.js` has START/TEXT/BUTTONS/LIST/INPUT/CONDITION/HANDOFF etc and real flow editing, so this is a **refactor/extend**, not a greenfield mockup.

## Desired entity boundaries
- **Workspace/Tenant:** company, plan/roles and aggregate operations.
- **Connected account/channel:** verified provider account/number status and ownership, never fake link success.
- **Bot:** distinct name, status, owner, account(s), content configuration; multiple per tenant.
- **Bot-specific flows, drafts, published versions, triggers, defaults and routing:** `tenant_id + bot_id` bounded API/database; versions independent; chat routing explicit, with documented default only where unambiguous.
- **Shared tenant resources:** catalog, media, FAQ/AI knowledge and contacts may be shared and referenced by bot where policy allows; never duplicate or grant cross-tenant access implicitly.
- **Conversation/lead/channel context:** preserve prior history and handoff/manual control.

## Migration design constraints
1. Discover exact existing schema, migration tool and coupling in inbound webhook, routing, published version, sessions, campaigns, tags and analytics before authoring SQL.
2. Add new bot entities and tenant+bot foreign keys/unique constraints/indexes **additively**. Existing tenant-scoped flow gets a deterministic single legacy/default bot per tenant, retaining all step IDs, definitions, revisions and versions. If more than one bot points to a channel event with no rule, reject/flag ambiguity instead of silent choice.
3. No destructive reset, direct bulk deletion, forced republish, or modified customer data. Supply forward migration, idempotency test, backup/rollback notes and dry-run fixtures.
4. Test tenant-A bots 1 and 2 with independent saves/publishes; tenant-B inaccessible, cross-bot ownership blocked; agent/viewer cannot edit; channel-to-bot routing deterministically selects published version.
5. For backwards compatibility, adopt explicit default-bot adapter for old `/api/v1/flows` consumers, with documented retirement path. Do not break website or provider adapters.

## Visual interaction blueprint (based on uploaded screenshots/video, not vendor code)
- **Shell:** 6–7 high-level destinations, collapsed/expanded icon sidebar, slim real-stat header, one obvious task CTA per page. Nested panels only within relevant bot/account. No scary technical controls on landing.
- **Bot manager:** selector left or top; each bot shows verified channel, owner, last edit, publish state; selecting opens its independent `Automation | Data Collection | AI | Engagement | Commerce | Integrations` context, with only actually supported items.
- **Canvas:** full-screen editing route, left component library, centered graph, right inspector only on node select; compact topbar for back, undo/redo, test, draft save and publish. Drag/drop, connector click opens contextual component menu; trigger node visible immediately and clear branch wiring.
- **Beginner:** guided template selection, message/button builder with simple steps, natural words; same underlying FlowDefinition and bidirectional switch with visual canvas.
- **Inbox/CRM:** sidebar chats → message thread → lead/customer profile, with human takeover, status, internal notes, and mobile stacked routes.
- **Channels:** connected table + cards to connect channels, guarded official setup and explicit missing credential/approval states; never brand a simulation as connected.
- **Settings/integrations:** task tabs and safe control sections with precise role restrictions.

## Non-goals
No tourism-only or financial ERP features. No made-up AI output, social posting, subscriptions, payment providers, or real customer sends simply because screenshots depict those features. Implement source-backed capability if within agreed roadmap; otherwise status `NOT_DONE` or `BLOCKED_PROVIDER`.

## Reference interpretation limits
- BotSailor 22 screenshots illustrate visual/task structure, not working integrations or permission safety.
- 108-second flow-builder video: Start (0–12 s), Text editing (12–47 s), interactive messages/outports (48–83 s), button/row settings (84–108 s).
- Manychat comparisons: simple and flow builder modes, previews and safe publishing. Use first-party original Elhafez design, not literal replica.
