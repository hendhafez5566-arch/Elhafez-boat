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

