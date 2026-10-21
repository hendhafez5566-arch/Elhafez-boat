## 2026-10-21 — precise nonblocking job ownership / F12

Same premium branch / Draft PR #5 after 27c7829. New legacy no-wait jobs carry exact conversation/contact/version/step; pause/stop cancels only owned pending work. Both workers recheck bot ownership/consent/version under contact-before-conversation locks. Historical unknown jobs and other same-contact conversations are preserved and explained in role-scoped UI. Migration 0042 additive, no backfill. 207 units/typecheck/build, eight new PG (including real lock race), three new desktop/mobile Chromium and existing DB regressions PASS. Matrix 20 PASS / 16 PARTIAL / 0 BLOCKED. Details: docs/product-rebuild/implementation/premium-2026-10-20/JOB_ORIGIN_CHECKPOINT.md. Next: supported native input/quick reply and channel fallback paths. No providers/deploy/merge; visual acceptance pending.

## 2026-10-21 — channel events / F10

Same branch and Draft PR #5 after 62ed60c. F10 closes: channel-scoped native events, exact current-node callback provenance, ambiguous priority publish guards, trigger-only graph roots, WhatsApp actual bot precedence and shared channel/event simulator. Migration 0041 additive; 207 units/typecheck/build, six new PG, three actual desktop/mobile Chromium and existing RLS/bot/control/request/authoring/native DB regressions PASS. Matrix 19 PASS / 17 PARTIAL / 0 BLOCKED. Save-repair remote CI fully SUCCESS; this feature's CI must be observed separately. Details: docs/product-rebuild/implementation/premium-2026-10-20/CHANNEL_EVENTS_CHECKPOINT.md. Next: precise nonblocking job ownership/F12, preserving unknown old jobs. No providers/deploy/merge; visual approval pending.

## 2026-10-21 — save lease CI repair

Same premium branch / Draft PR #5; verified initial HEAD 0e4baf5. Actual successful/failed Actions inspected. Tab-close assertion now waits for actual bounded lock acquisition and verifies exclusion before close; application/CAS unchanged. 201 units/typecheck/build, fresh 40 migrations, 11 control + 6 save PostgreSQL scenarios and two four-scenario real Chromium runs PASS. Canonical matrix bottom corrected: 18 PASS / 18 PARTIAL / 0 BLOCKED. Details: docs/product-rebuild/implementation/premium-2026-10-20/SAVE_CI_REPAIR.md. Next: channel events/priority conflicts and native input contracts. No merge/deploy/providers; visual acceptance pending.

## 2026-10-19 — Isolated UI/UX real-user audit remediation (DRAFT, not deployed)

- Audit basis: Cloud Browser checked 21 screens, with 20 documented issues and 98 scenarios (51 Pass, 17 Fail, 30 Blocked); neither mobile testing nor live Meta acceptance was completed by audit.
- Created branch `fix/ui-ux-audit-2026-10-19` and draft PR #2 against `feat/stage0-foundation` to isolate changes from the Railway-linked live branch.
- Code changes: flow geometry, phone validation, simulator preflight/handoff, navigation search, alert position, Arabic forms, analytics loading, provider-aware connectors, editable FAQ drafts, log readability, simplified toolbar and UI text contrast.
- Safety: no merge to the deploy branch, no Railway restart, no Meta authorization, no WhatsApp send, no existing tenant or customer data modified.
- Verification: source build/unit checks and isolated browser/PostgreSQL CI must pass on PR HEAD. Independent mobile visual acceptance and original 20 screenshots' reproduction remain **open**; functional UI edits are NOT deemed production-ready on code tests alone.
- Meta Coexistence self-service remains gated on official provider setup; session reload OBS-02 remains investigatory.

See `docs/UI-AUDIT-FIX-2026-10-19.md` for issue-to-change mapping and acceptance gaps.

## 2026-10-18 — Premium UI completion pass (verified source ea1e0e56)

- Canvas now uses measured collision-safe pointer positioning, topology aware auto layout, real branch-port connection controls and focus/immersive view.
- Inspector supports WhatsApp choice ordering and exact button/list count + length constraints; safe one-successor step deletion.
- Cross-platform visual improvements: accessible empty states, grouped CRM filters/actions, optional catalog metadata disclosure, localized roles/toasts, mobile and navigation retained.
- Added actual Chromium branching, collision, choice-limit/ordering and viewport assertions. Source run 39139907714 both jobs SUCCESS; see `docs/30-PREMIUM-UI-CLOSURE.md` for honest limits.

## 2026-10-18 — Premium RTL SaaS visual rebuild (source, pending final acceptance)

- Replaced canvas card renderer with visual messages, choices, zoom/pan/auto-layout, highlighted paths and contextual output ports.
- Added searchable step insertion preserving target routes, collapsible palette, fullscreen canvas, inspector drawer with advanced developer options, and simulator dialog reusing existing preview engine.
- Refactored global design tokens, RTL layout and shared component baseline; introduced inline SVG navigation and matching platform owner styling.
- Added real Chromium interactions/screenshots for premium studio controls; old business/tenant/provider behavior retained. See docs/29-PREMIUM-UI-REBUILD.md for exact limitations.

# 2026-10-18 — Permanent WhatsApp company self-service

Embedded Signup with owner/browser/tenant-bound one-use grant, encrypted phone choice, WABA/phone/app/scope validation, subscription checks; Arabic Cloud/Coexistence UI; consent-gated sync/registration; app echo/history/contact/account lifecycle and no-history service-window extension; migration 0028 RLS; real API/DB/browser fixture acceptance; local no-hosting profile. Flags remain off without official Meta setup/approval. No external accounts connected or costs created.

# 2026-10-18 — WhatsApp pilot preparation

- Validate phone belongs to supplied WABA; fail closed on malformed/oversized/redirected provider replies.
- Reconnect only within original tenant, preserving account and conversations; verify routing ownership.
- Owner-only live read diagnostic for phone/WABA and exact Meta app subscription, without claiming message delivery.
- Arabic setup, explicit disconnect scope, unsaved-draft close/logout protection.
- HTTPS staging overlay and runtime configuration; hosting and Meta activation require separate owner consent.
- Add onboarding regression and real-PostgreSQL reconnect/diagnostic acceptance cases.

