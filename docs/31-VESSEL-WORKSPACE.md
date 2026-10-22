# Elhafez Boat — Vessel workspace redesign (2026-10-18)

This is a structural frontend re-composition on the existing branch and draft PR #1, not a new project or UI mockup.

## Delivered source
- Moved the original permission-controlled page buttons into a compact five-destination icon rail and a searchable, categorized overlay drawer; original `data-page` buttons and routing handlers are retained, not cloned.
- Moved the active tenant indicator into a new workspace header, with built-in navigation search (Ctrl/⌘+K).
- Rebuilt the owner dashboard around an editorial hero, a stylized explanatory conversation sequence, the unchanged real `dashboard-metrics` values, the original guided setup, and live lead alerts; no fabricated company metrics.
- Re-composed the inbox into a conversation list and a dedicated messaging/composer surface, reusing every existing form ID and server API.
- Prioritized the full-width conversation canvas and made the existing components palette contextual (hidden by default, available through its toggle). Kept published flows and the real simulator untouched.
- Introduced the standalone Vessel visual vocabulary and responsive controls in `apps/web/public/vessel.css`.

## Safety
No engine, database, tenant isolation, API contract, Meta, WhatsApp/Coexistence, Railway hosting, deployments, merge, third-party fonts or paid packages changed. The primary goal was unmistakably different visual composition in dashboard, bot studio and inbox, ahead of any cross-platform visual rollout.

## Verification
CI needs to be read against the exact final SHA. Existing Chromium browser acceptance includes the new five-rail-navigation assertion, menu open/search/close, and screenshot `vessel-navigation-open-desktop.png` as well as all existing screenshots. Final acceptance requires inspecting those screenshots; programmatic tests alone do not certify commercial UX, actual Meta delivery or physical-device gestures.
