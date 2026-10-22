-- Generic, reusable chatbot workflows. Industry is not hardcoded anywhere in these tables.
-- Tenant isolation and immutable published revisions. Apply after previous migrations.
BEGIN;
CREATE TABLE chatbot_flow_drafts (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
 definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object'),
 draft_revision integer NOT NULL DEFAULT 1 CHECK(draft_revision>0),
 updated_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,updated_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE TABLE chatbot_flow_versions (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 version integer NOT NULL CHECK(version>0),
 definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object'),
 draft_revision integer NOT NULL CHECK(draft_revision>0),
 published_at timestamptz NOT NULL DEFAULT now(),
 published_by uuid NOT NULL,
 PRIMARY KEY(tenant_id,version),
 FOREIGN KEY(tenant_id,published_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE TABLE chatbot_flow_sessions (
 tenant_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>=0),
 node_id text,
 answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(answers)='object'),
 tags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(tags)='array'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,conversation_id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id) ON DELETE CASCADE
);
ALTER TABLE chatbot_leads ADD COLUMN custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(custom_fields)='object');
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['chatbot_flow_drafts','chatbot_flow_versions','chatbot_flow_sessions'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab||'_tenant',tab);
 END LOOP;
END $$;
COMMIT;