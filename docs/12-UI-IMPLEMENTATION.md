# UI implementation — October 17, 2026

This is implementation, not a concept drawing. Source files:
- `apps/web/public/index.html`: Arabic RTL login, dashboard, program catalog, offers, bookings, customers, internal inbox, follow-ups, reports, bot preview, team and settings staging pages.
- `apps/web/public/style.css`: original responsive brand design, navy sidebar, cards, panels and controls.
- `apps/web/public/app.js`: same-origin API client and browser-only demo adapter.

## Modes
- **Real company**: tenant slug + employee email + password. Uses bearer sessions, tenant-scoped API and PostgreSQL. Requires migrations through 0004 and non-owner runtime DB role. Meta WhatsApp integration not live.
- **View design with sample data**: click `استعراض التصميم ببيانات تجريبية`. This populates demo programs, bookings, contacts, offers, internal conversations and follow-ups in browser memory only; no API writes, WhatsApp messages, or persistence. Demo changes vanish when you reload or leave the page. A `وضع تجريبي` indicator is always visible.

## Features included in current UI
- Dashboard: counts and published program distribution using live data or demo-only dataset.
- Programs: category filters, search, create draft with optional trip summary, departure, hotel and duration, and publish.
- Offers: create draft and publish only when linked program is published.
- Bookings: create provisional request and confirm after manual review; backend owns snapshot and capacity check.
- Customers: create contact, view/add internal notes, mark customer status.
- Internal inbox: conversations and internal notes only, clearly labelled; not connected to WhatsApp.
- Follow-ups: create assigned task, complete task.
- Reports: operational counts only, no invented monetary analytics.
- Bot: menu navigation simulator, category listing and program details, draft booking demo in browser only.
- Team and settings: visible design placeholders; NOT yet editable functional modules.

## Remaining UI work before final release
- Full media/photo upload and program wizard, per-departure capacity, room/hotel rates, offers and inventory rules.
- Customer-facing booking flow with Meta official WhatsApp Flows and human takeover state.
- Real live inbox, notifications, campaign templates/consent, team invitations, bot config publisher, subscriptions and platform superadmin.
- Design refinements and responsive/accessibility review on supported browsers.

## User decision: acceptance tests LAST
Do not schedule a separate formal test milestone after each new feature. Keep a single **final comprehensive acceptance phase** after feature implementation is complete. Lightweight compile/syntax checks remain allowed as engineering safeguards. Existing tests should not be deleted; final acceptance must include unit, integration, browser and official Meta provider tests, cross-tenant checks, backups and performance. No "done" claims without executed evidence.

### Bot configuration UI (continuation)
The Settings page now includes a functional form for company display name, welcome message and enabled categories. Save updates the tenant-scoped DRAFT. Publish creates an immutable server-side numbered revision, audited with actor ID; the local simulator uses only the last PUBLISHED config, never unapproved draft content. Public WhatsApp publishing/Meta connection is still deliberately absent. Team page reads currently assigned members and their roles for the owner/manager; invite/role-edit UI still pending.