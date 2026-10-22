# Advanced chatbot extensions — reusable sections, visual grouping, Meta carousels

Implemented as development source on branch `feat/stage0-foundation`. No commercial acceptance or real Meta template delivery is claimed.

## 1. Reusable conversation sections
- Each company can save a named sequence of **1–20 linear nodes** from its current draft (TEXT, INPUT, QUESTION, MEDIA, LINK, DELAY, TAG, AI, WEBHOOK, CATALOG).
- Choose the first node, number of consecutive steps and a name; save it in **مكتبة خطوات قابلة لإعادة الاستخدام**. The library is stored in PostgreSQL `chatbot_flow_snippets` after migration `0023_reusable_flow_sections.sql`.
- Select an existing sequential node, then **إدراج بعد المحدد**. Nodes are cloned with distinct IDs and the original onward connection restored at the inserted tail; the import modifies the unsaved draft only.
- Reused sections are **copies, not live links**. Deleting a library entry cannot delete a published path, affect another company or change an in-progress chat.
- Branching nodes (BUTTONS, LIST, CONDITION, KEYWORD), START, END and HANDOFF cannot be captured into this linear library. Advanced linked/nested subflows remain a separate future feature.
- API: `GET /api/v1/flows/snippets`, `POST /api/v1/flows/snippets`, `DELETE /api/v1/flows/snippets/:id`. Owner/manager create and delete. Agent/viewer can list. Max 100 library entries per company.
- Tenant RLS is ON and FORCE and library author must be a tenant member.

## 2. Visual groups in Flow Canvas
- Hold **Shift** while selecting node titles to choose multiple nodes. Select at least two and press **تجميع المحدد**; name the group.
- A colored outline and label appear on the canvas. Press **فك المجموعة** while a member is selected to remove the outline.
- Visual groups have **no execution semantics** and are retained in the validated draft and immutable published flow JSON. They do not hide nodes, modify their links, or force the bot to do anything.
- Limit of 20 disjoint groups, with 2–30 nodes each. Group entries referencing deleted/overlapping node IDs fail validation. Rename/delete keeps group references in sync.

## 3. Meta-approved carousel templates
- Existing template registration checks approval in the tenant's linked Meta WABA. This extension recognizes **approved MARKETING CAROUSEL templates** with 2–10 cards. It is not a free-form interactive carousel and does not bypass WhatsApp's official template rules.
- The template editor displays each approved card separately and requests its **IMAGE or VIDEO** header HTTPS link, approved numbered body variables and approved per-card URL/quick-reply button values.
- Server compiles `{type:"carousel",cards:[{card_index,components:[...]}]}` into the official send-format structure. It validates media links, approved card count, card component types, placeholder count, allowed button types and indices; unsupported authentication/catalog/named parameters remain rejected.
- Consent, approved-template checks, per-recipient cooldown, worker usage caps, queued delivery and opt-out checks remain active. A queued request is NOT proof of WhatsApp delivery.
- The template must **already be published and approved at Meta**. Actual sending requires Meta credentials, account permissions, media accessibility and end-to-end provider verification. Meta may reject an unavailable template or a format it has not enabled for that WABA.
- Reference: [Meta WhatsApp Business Platform API](https://www.postman.com/meta/whatsapp-business-platform/request/lwtlz1k/send-message-template-interactive).

## Testing and limits
- Development CI check on 2026-10-17 succeeded: **43/43** unit tests, PostgreSQL migrations **0001–0023**, tenant catalog isolation and RLS check including the reusable library.
- This is only a development gate; **the owner reserved one final comprehensive acceptance stage** after feature build. No real WhatsApp carousel was delivered, no mobile browser usability session was performed, and no source has been deployed commercially.
- Remaining: true dynamically linked nested subflows, Google Sheets/CRM/store native OAuth connectors, more official templates, optional additional messaging channels, retention and malware scanning, full final release acceptance.
