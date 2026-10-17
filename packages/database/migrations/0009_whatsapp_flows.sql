-- Official WhatsApp Flow configuration and one-time, tenant-scoped booking flow submissions.
BEGIN;
CREATE TABLE whatsapp_flow_settings (
 tenant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 flow_id text NOT NULL CHECK(flow_id ~ '^[0-9]{5,30}$'),
 screen_id text NOT NULL DEFAULT 'BOOKING' CHECK(screen_id ~ '^[A-Z][A-Z0-9_]{1,40}$'),
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,account_id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id)
);
CREATE TABLE whatsapp_flow_sessions (
 token_hash char(64) PRIMARY KEY,
 tenant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 program_id uuid NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id),
 FOREIGN KEY(tenant_id,program_id) REFERENCES programs(tenant_id,id)
);
CREATE INDEX whatsapp_flow_expiry ON whatsapp_flow_sessions(tenant_id,expires_at) WHERE consumed_at IS NULL;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['whatsapp_flow_settings','whatsapp_flow_sessions'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t||'_tenant',t);
 END LOOP;
END $$;
COMMIT;