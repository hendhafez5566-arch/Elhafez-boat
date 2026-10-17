# Architecture

Start as a TypeScript modular monolith plus queue worker, not premature microservices.

apps/web: Next.js RTL Arabic dashboard.
apps/api: NestJS or similarly structured Node API; validate inputs and authorize each action.
apps/worker: outbound messages, retries, follow-ups and scheduled jobs.
packages/database: PostgreSQL schema, migrations, tenant-aware repositories.
packages/shared: contracts, validation schemas and action identifiers.

Domain modules: tenants, identity, programs, offers, menus, conversations, whatsapp, flows, customers, bookings, ai, campaigns, subscriptions, reporting, audit.

Infrastructure: PostgreSQL, Redis/BullMQ, object storage for media, observability and backup jobs.

Inbound: Meta webhook -> verify signature -> persist event/idempotency key -> enqueue -> resolve tenant + conversation -> workflow transition -> domain read/write -> render provider payload -> outbound queue -> Meta -> delivery status update.

Menus and workflows: stable action IDs, typed actions, graph validation, immutable published version, draft/publish/rollback. Provider adapters map internal actions to WhatsApp list/button/Flow limitations. For large menus use hierarchy/pagination. Persist workflow state with version and expiration; stale buttons require safe fallback.

Every mutation uses tenant scope and permissions; booking confirmation checks inventory and business rules transactionally. Use optimistic concurrency and outbox/idempotency for externally visible effects. Encrypt secrets, never store tokens in source. Support feature flags, schema migration discipline and backwards-compatible API changes.
