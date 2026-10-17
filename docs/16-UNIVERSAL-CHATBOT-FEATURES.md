# Universal chatbot feature inventory — status as of 2026-10-17

The owner wants a configurable platform for **any business or shop**, inspired by BotSailor's available options. This is an original build; the target is broad chatbot functionality, not a tourism ERP. Read `00-SCOPE-CHATBOT-ONLY.md`.

Legend: **CODED** = source committed, NOT fully accepted; **PARTIAL** = some source exists; **PLANNED** = no supported implementation yet.

| Platform feature | Status | Notes |
|---|---|---|
| Text reply block | CODED | Generic TEXT node, reusable |
| Quick reply buttons | CODED | Up to 3 for WhatsApp; stable action IDs |
| WhatsApp list menus | CODED | Up to 10 rows; manual choices and links |
| Customer questions / text inputs | CODED | Store arbitrary custom fields per conversation |
| Conditional branching | CODED | equals/contains/exists on stored input |
| Tags / customer segmentation data | CODED | TAG node; customer captured data visible in inbox |
| Human handoff / staff inbox | CODED | Bot stops on takeover; qualified lead context |
| Image, video, audio, document URLs | CODED | HTTPS MEDIA node and provider-specific payload |
| Website links | CODED | LINK block currently sends safe text + URL, NOT native CTA button |
| Company products/services/offers | CODED | Free-form business categories and approved informational content |
| Flow versioning | CODED | Draft / validate / publish immutable revision; pinned sessions |
| Flow browser-only simulation | CODED | No external API calls |
| Industry templates | CODED | Generic/shop/restaurant/clinic/real-estate/education/tourism |
| Visual editor with card/node properties | CODED | Node list and explicit connection selects, NOT drag-and-drop |
| Knowledge base FAQ | PARTIAL | Published exact-match answers; not semantic search |
| Generic catalog response match | PARTIAL | Matches exact full published product title within customer's text; no dynamic catalog list node |
| Shared team inbox | PARTIAL | Human assignment/reply, custom answers; no live push or SLA |
| Official Meta connection | PARTIAL | Webhook signature/queue/API adapter code; NO real live number attached |
| Approved message templates | PARTIAL | Basic static pre-approved Meta templates; variables/carousels still pending |
| Visual drag & drop graph / zoom / undo | PLANNED | Need real canvas interactions and revision rollback |
| Keyword / event triggers / multiple flows | PLANNED | Current engine has one published default flow per company |
| Product dynamic list/gallery/carousel | PLANNED | Need WhatsApp-specific renderer and validation |
| Native CTA call/URL buttons, location | PLANNED | Per-provider support verification needed |
| WhatsApp interactive Flows forms | PARTIAL | Old booking-specific Flow scaffold dormant; needs GENERIC forms |
| Scheduled sequences and reminders | PLANNED | Must honor 24h window, opt-in and template rules |
| Audience segmentation and opted-in broadcasts | PARTIAL | Consent/template foundations, no campaigns engine |
| External HTTP/webhook actions and integrations | PLANNED | Allowlist, permissions, secrets vault, retries and audit first |
| Google Sheets / Shopify / WooCommerce connectors | PLANNED | Integrate external systems; **do not copy or build an ERP** |
| Grounded company AI / knowledge retrieval | PLANNED | No live LLM provider, no hallucinated prices |
| Analytics / conversion reports | PARTIAL | Basic leads, no full flow funnel analytics |
| Multi-tenant owner SaaS | PARTIAL | Teams/platform roles; billing automation not connected |
| Omnichannel website / Messenger / IG / Telegram | PLANNED | Adapter architecture supports future work; WhatsApp first |

**Acceptance:** user requests ONE formal end-to-end acceptance stage only after core features are built. A CODED row does NOT mean a verified live feature. Current PR #1 is draft, unmerged. Real Postgres, clean install and Meta sandbox remain unverified.

**Non-goals:** payment processing, invoicing, inventory, reservations, supplier management or any internal business ERP.
