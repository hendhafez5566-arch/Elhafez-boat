# Master Plan — Industry-neutral chatbot builder

Authoritative scope: [universal chatbot SaaS](00-SCOPE-CHATBOT-ONLY.md). **All previous travel booking, payments, finance and ERP plans are obsolete.**

## 1. Core generic engine and builder — IN PROGRESS
- Unified flow node schema: TEXT / BUTTONS / LIST / INPUT / CONDITION / TAG / LINK / MEDIA / HANDOFF / END.
- Industry presets and browser-only preview; validation of node links, choices, publish rules and no immediate infinite loops.
- Tenant-specific mutable drafts, immutable published revisions and pinned conversational sessions.
- Friendly visual editor with editable node properties and connections (canvas now implemented; browser acceptance pending).
- Generic catalog of approved products, services and offers; company-defined category labels, optional descriptions, price text and HTTPS links.

## 2. Customer communication
- Official WhatsApp Business Cloud API webhook signature validation, interactive replies, dynamic published flows, human handoff, message queues and customer opt-out.
- Reply keyword/trigger rules, segment tags and custom fields; approved response knowledge base.
- Optional template and consent management, broadcasts and scheduled messages strictly according to Meta policy (not mandatory MVP).

## 3. Team and lead workspace
- Shared inbox; customer details, captured custom answers and tags, lead stages, agent assignment and handoff.
- Analytics for inquiry flow completions, leads and staff workload; simple permissions.
- Company onboarding and tenant isolation; platform owner subscriptions only as needed to operate the SaaS.

## 4. Extensions after the core is clean
- Rich WhatsApp-specific Flows, template variations, interactive catalog previews, safe API/webhook/Sheets/Shopify/WooCommerce integrations and optional grounded AI provider.
- Add channels later through adapters (website, Facebook, Instagram, Telegram) without coupling generic engine to any industry.

## 5. Final acceptance as ONE stage (owner instruction)
- Fresh code checkout, clean npm install/lockfile, migrations 0001–0021 and real PostgreSQL/RLS tests.
- Visual/mobile flow builder, actual published WhatsApp lists/buttons/media, lead capture/handoff, consent/security, concurrency and message retries.
- Meta test number and supported channel restrictions, privacy, performance, monitoring and backup/restore.
- Only then merge draft PR, deploy pilot and assess commercial readiness.

**DO NOT BUILD** an internal reservation, inventory, payment, invoicing, supplier, accounting or traveler-document system.
