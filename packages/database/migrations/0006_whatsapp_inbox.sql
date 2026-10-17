-- Official WhatsApp Cloud API foundation: routing, dedupe, conversation state, outbound queue.
-- Apply with privileged migration role only. Runtime must be non-owner, non-BYPASSRLS.
BEGIN;
CREATE TABLE whatsapp_accounts (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 phone_number_id text NOT NULL UNIQUE CHECK(phone_number_id ~ '^[0-9]{5,30}$'),
 waba_id text NOT NULL CHECK(waba_id ~ '^[0-9]{5,30}$'),
 access_token_encrypted text NOT NULL,
 display_phone text,
 status text NOT NULL DEFAULT 'CONNECTED' CHECK(status IN ('CONNECTED','DISABLED')),
 connected_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,connected_by) REFERENCES memberships(tenant_id,user_id)
);
-- Routing index contains NO access tokens or customer PII. Webhook uses phone id to locate tenant.
CREATE TABLE whatsapp_routes (
 phone_number_id text PRIMARY KEY,
 tenant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE whatsapp_receipts (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 account_id uuid NOT NULL,
 message_id text NOT NULL,
 processed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,account_id,message_id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id)
);
CREATE TABLE whatsapp_conversation_states (
 tenant_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 menu_version integer,
 current_menu text NOT NULL DEFAULT 'HOME',
 page_number integer NOT NULL DEFAULT 0 CHECK(page_number BETWEEN 0 AND 10000),
 booking_program_id uuid,
 awaiting text NOT NULL DEFAULT 'NONE' CHECK(awaiting IN ('NONE','BOOKING_NAME','BOOKING_PARTY')),
 booking_name text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,conversation_id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,booking_program_id) REFERENCES programs(tenant_id,id)
);
ALTER TABLE conversation_messages ADD COLUMN whatsapp_message_id text;
ALTER TABLE conversation_messages ADD COLUMN delivery_status text;
CREATE UNIQUE INDEX conversation_whatsapp_message_dedupe ON conversation_messages(tenant_id,whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;
CREATE TABLE whatsapp_outbox (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 recipient_phone text NOT NULL CHECK(recipient_phone ~ '^[0-9]{8,15}$'),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','SENT','FAILED','UNCERTAIN')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 8),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 locked_at timestamptz,
 provider_message_id text,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id)
);
CREATE INDEX whatsapp_outbox_ready ON whatsapp_outbox(tenant_id,status,next_attempt_at);
CREATE INDEX whatsapp_outbox_provider ON whatsapp_outbox(tenant_id,provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX whatsapp_conversation_contact ON conversations(tenant_id,contact_id,channel) WHERE channel='WHATSAPP';
ALTER TABLE contacts ADD COLUMN do_not_contact boolean NOT NULL DEFAULT false;
ALTER TABLE conversations ADD COLUMN last_customer_message_at timestamptz;
ALTER TABLE conversations ADD COLUMN whatsapp_account_id uuid;
ALTER TABLE conversations ADD CONSTRAINT conversation_whatsapp_account_fk FOREIGN KEY(tenant_id,whatsapp_account_id) REFERENCES whatsapp_accounts(tenant_id,id);
CREATE TABLE contact_consent_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,
 contact_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('WHATSAPP','EMAIL','PHONE')),
 granted boolean NOT NULL,
 evidence text NOT NULL CHECK(length(evidence)<=400),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,contact_id) REFERENCES contacts(tenant_id,id)
);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['whatsapp_accounts','whatsapp_receipts','whatsapp_conversation_states','whatsapp_outbox','contact_consent_events'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab||'_tenant',tab);
 END LOOP;
END $$;
-- Only the webhook service reads routing; grants to roles must be configured by deploy owner.
COMMIT;