BEGIN;
CREATE TABLE chatbot_integrations (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),url text NOT NULL CHECK(length(url)<=2048),enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(tenant_id,id)
);
CREATE TABLE chatbot_integration_jobs (
 tenant_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),integration_id uuid NOT NULL,payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','FAILED')),attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),last_error text,
 PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,integration_id) REFERENCES chatbot_integrations(tenant_id,id)
);
CREATE INDEX integration_jobs_ready ON chatbot_integration_jobs(tenant_id,status,next_attempt_at);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['chatbot_integrations','chatbot_integration_jobs'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab||'_tenant',tab);
 END LOOP;
END $$;
COMMIT;
