BEGIN;
CREATE TABLE chatbot_ai_settings (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 instructions text NOT NULL DEFAULT '' CHECK(length(instructions)<=2000),
 monthly_limit integer NOT NULL DEFAULT 100 CHECK(monthly_limit BETWEEN 0 AND 100000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE chatbot_ai_events (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 id uuid NOT NULL DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),
 source_ids jsonb NOT NULL DEFAULT '[]',outcome text NOT NULL,
 PRIMARY KEY(tenant_id,id)
);
CREATE INDEX ai_usage_idx ON chatbot_ai_events(tenant_id,created_at);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['chatbot_ai_settings','chatbot_ai_events'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab||'_tenant',tab);
 END LOOP;
END $$;
COMMIT;
