-- Additive bot workspace. Legacy tables remain authoritative for old consumers.
BEGIN;
CREATE TABLE chatbot_bots (
 tenant_id uuid NOT NULL REFERENCES tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
 archived_at timestamptz, legacy_default boolean NOT NULL DEFAULT false,
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,created_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE UNIQUE INDEX chatbot_one_legacy_bot ON chatbot_bots(tenant_id) WHERE legacy_default;
CREATE TABLE chatbot_bot_drafts (
 tenant_id uuid NOT NULL, bot_id uuid NOT NULL, definition jsonb NOT NULL,
 draft_revision integer NOT NULL DEFAULT 1 CHECK(draft_revision>0), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,bot_id), FOREIGN KEY(tenant_id,bot_id) REFERENCES chatbot_bots(tenant_id,id),
 FOREIGN KEY(tenant_id,updated_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE TABLE chatbot_bot_versions (
 tenant_id uuid NOT NULL, bot_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 definition jsonb NOT NULL, source_definition jsonb, draft_revision integer NOT NULL,
 published_by uuid NOT NULL, published_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,bot_id,version), FOREIGN KEY(tenant_id,bot_id) REFERENCES chatbot_bots(tenant_id,id),
 FOREIGN KEY(tenant_id,published_by) REFERENCES memberships(tenant_id,user_id)
);
-- Snapshot every historical definition and revision without altering originals or republishing.
INSERT INTO chatbot_bots(tenant_id,id,name,legacy_default)
 SELECT tenant_id,tenant_id,'البوت الأساسي',true FROM (
 SELECT tenant_id FROM chatbot_flow_drafts UNION SELECT tenant_id FROM chatbot_flow_versions
 ) tenants_with_flows ON CONFLICT DO NOTHING;
INSERT INTO chatbot_bot_drafts SELECT d.tenant_id,b.id,d.definition,d.draft_revision,d.updated_by,d.updated_at
 FROM chatbot_flow_drafts d JOIN chatbot_bots b ON b.tenant_id=d.tenant_id AND b.legacy_default ON CONFLICT DO NOTHING;
INSERT INTO chatbot_bot_versions SELECT v.tenant_id,b.id,v.version,v.definition,v.source_definition,v.draft_revision,v.published_by,v.published_at
 FROM chatbot_flow_versions v JOIN chatbot_bots b ON b.tenant_id=v.tenant_id AND b.legacy_default ON CONFLICT DO NOTHING;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['chatbot_bots','chatbot_bot_drafts','chatbot_bot_versions'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format($policy$CREATE POLICY tenant_scope ON %I USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)$policy$,tab);
 END LOOP;
END $$;
COMMIT;
