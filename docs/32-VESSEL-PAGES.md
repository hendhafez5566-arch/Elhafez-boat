# Vessel — company section design extension

Continues the approved purple/indigo Vessel workspace without replacing the bot execution engine.

- 18 company-facing sections have newly composed task-based page headers. Existing h2 elements move into those headers; page content and form IDs remain intact.
- Catalog displays a search field against items already fetched into the DOM only, restores all visible items when cleared and retains all existing edit/publish/archive operations.
- CRM's lead tiles show a distinct first-letter avatar, authentic lead status, name, source details and the original priority/assignment/follow-up actions.
- Analytics renders tenant-sourced daily conversations and interested leads as separate normalized bar series. Empty states still show plain messages.
- Mobile layout stacks editing/library panels and customer cards. No libraries, external fonts, backend routes or network services added.

Testing: Chromium integration test for actual CRM page, client-side catalog filtering/restoration and analytics shell; original security, database, bot and flow acceptance remain. On-commit CI evidence required. Not a certification of every nested field, physical device accessibility or live provider delivery.
