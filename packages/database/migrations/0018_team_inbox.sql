BEGIN;
CREATE TABLE chatbot_saved_replies (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 PRIMARY KEY(tenant_id,id)
);
CREATE TABLE chatbot_inbox_reads (
 tenant_id uuid NOT NULL,conversation_id uuid NOT NULL,user_id uuid NOT NULL,read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,conversation_id,user_id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE
);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['chatbot_saved_replies','chatbot_inbox_reads'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab||'_tenant',tab);
 END LOOP;
END $$;
COMMIT;
