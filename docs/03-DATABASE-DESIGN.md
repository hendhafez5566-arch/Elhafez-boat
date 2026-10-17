# Data model (design draft; not implemented)

Core: tenants, tenant_settings, users, memberships, roles, permissions, whatsapp_accounts, encrypted_credentials_reference.
Catalog: programs, departures, accommodations, price_tiers, capacities, media_assets, offers, offer_programs, publication_versions.
Conversation: contacts, conversations, messages, provider_events, workflow_definitions, workflow_versions, conversation_state, menu_actions, handoffs, agent_assignments.
Sales: leads, booking_requests, booking_travelers, booking_price_snapshots, booking_status_events, followup_tasks, consent_records.
Operations: outbound_jobs, message_templates, audits, subscription_plans, subscriptions, usage_events.

All tenant-owned rows require tenant_id, indexes and authorization. Enforce unique external message IDs scoped to provider/account, durable event dedupe, referential integrity, migrations, retention/deletion policy, and tenant isolation integration tests. Do not assume phone number alone is sufficient to authenticate access to sensitive bookings.
