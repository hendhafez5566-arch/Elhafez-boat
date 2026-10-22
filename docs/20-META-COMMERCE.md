# Meta Commerce templates — source implementation 2026-10-18

Continuation from verified remote HEAD `5c03106`. Uses the official Meta Cloud API directly, not a paid BSP. No deployment, merge or live Meta delivery is implied.

## Implemented

- Owner links a PUBLISHED generic catalog item to a real Meta product belonging to the company's connected WhatsApp account. The API reads WABA `/product_catalogs`, approved catalog `/products`, product `product_catalog`/`retailer_id`/`review_status` and phone `/whatsapp_commerce_settings`. Missing permissions, disconnected catalog, hidden catalog, unapproved product, cross-company reference or disabled mapping fails closed.
- Templates: CATALOG action thumbnail; SPM PRODUCT header and View button; MPM thumbnail and 1–10 sections, max 30 total distinct products; PRODUCT Carousel with 2–10 selected products from the same catalog, preserving approved SPM or URL card buttons. A two-card approved product prototype can send up to ten products, unlike existing fixed-size media carousels.
- Numbered and named BODY/TEXT HEADER parameters match exact approved placeholders. Mixed/unexpected/missing values and excessive rendered header/body text are rejected. Product photos/prices are supplied by Meta's catalog; clients cannot inject provider product parameters or override catalog media.
- API callers submit local catalog UUIDs (`itemId`, card `itemId`, `catalog.thumbnailItemId`, section `itemIds`). The server resolves per-company/per-account mappings, builds official components and stores immutable commerce references beside the queued payload. No raw catalog/product parameters are trusted from the client.
- Commerce template approval is refreshed at every enqueue, including scheduled campaign steps. Existing consent, opt-out, subscription, per-customer cooldown, daily quota, retries and idempotency remain. Worker rechecks current published mappings/product approval/catalog visibility before dispatch, so disabling a mapping or unpublishing an item blocks queued content. Meta permission/service failures retry with a bound; revoked/ineligible products fail without sending.
- Real UI: list connected Meta catalogs/products (cursor pagination), save/disable mapping, choose SPM item or CATALOG thumbnail, add/remove up to ten product cards, select MPM sections/products, edit URL suffixes and named values. Same controls work in individual approved-template sends and campaigns. Existing approved image/video carousel remains supported.
- Signed inbound `order` and `context.referred_product` messages become interest leads, with only locally approved mapped names. Prices/currency/checkout claims from inbound events are never trusted or persisted as agreed facts. Conversation goes to HUMAN with existing assignee preserved; no local order, reservation, invoice, stock or payment is created.

## Database/API

Apply **0025_meta_commerce.sql** after 0001–0024. `chatbot_commerce_links` has composite tenant/account/item foreign keys and ENABLE/FORCE RLS; `whatsapp_outbox.commerce_refs` snapshots selected provider identities. Grant the table to the existing non-owner/non-BYPASSRLS runtime role.

- GET `/api/v1/commerce/resources?accountId=...` — connected catalogs.
- GET same endpoint with `catalogId` and optional opaque `after` — approved products. Provider paging URLs/access tokens are not exposed.
- GET/POST `/api/v1/commerce/links` — tenant mappings / owner verified save.
- DELETE `/api/v1/commerce/links/<itemId>/<accountId>` — audited owner disable, works without a live provider call.
- Existing `/whatsapp/templates/send` and `/campaigns` accept the new local reference parameters. API keys cannot access Commerce administration.

Public parameter examples (body/header variables depend on approved template):

```json
{"itemId":"<local-catalog-uuid>","bodyNamed":{"customer_name":"<customer-name>"}}
```

```json
{"cards":[{"itemId":"<local-product-1>"},{"itemId":"<local-product-2>"}]}
```

```json
{"catalog":{"thumbnailItemId":"<local-product-1>","sections":[{"title":"Products","itemIds":["<local-product-1>","<local-product-2>"]}]}}
```

## Activation and exact limits

Requires a real connected WABA/phone, accessible approved ecommerce catalog/products, visible phone catalog settings, approved MARKETING template in the exact account/language, WhatsApp and catalog permissions (including applicable catalog_management/business access), consent and reachable HTTPS. Manage catalogs, prices, approvals, cart settings and actual fulfilment in Meta/the business's systems. This source does not upload inventory or create/approve templates on Meta; the existing template registry verifies templates already approved there.

No real provider token/account/approval was supplied. Live catalog listing, product eligibility and template delivery therefore remain **unverified**. No claim is made that Meta will grant a particular account Commerce access. Unsupported authentication/payment/order-status template shapes remain rejected. Product cards use an approved PRODUCT/SPM or PRODUCT/URL prototype; arbitrary free-form cards are not accepted. Catalog templates intentionally require an explicit mapped thumbnail rather than silently exposing an arbitrary first catalog item.

No commercial readiness assertion. Final acceptance still needs real provider activation, browser/mobile, worker fault/concurrency/load and backup/restore. Development CI and local unit tests are separate evidence.

## Official contracts consulted

The web retrieval service returned 429 for Meta documentation, so the same public official pages were read directly over HTTPS, which returned their Markdown content. No schema was inferred from screenshots or fabricated payloads.

- https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/product-card-carousel-template-messages/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/catalog-template-messages/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/spm-template-messages/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/mpm-template-messages/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/catalogs-overview/
- Official Meta SDK: facebook/facebook-python-business-sdk, `WhatsAppBusinessAccount.get_product_catalogs`, `ProductCatalog.get_products`, `ProductItem` fields.
