-- Tenant-configurable menus: mutable draft + immutable published revisions.
BEGIN;
CREATE TABLE tenant_bot_drafts (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 2 AND 120),
  welcome_text text NOT NULL CHECK(length(btrim(welcome_text)) BETWEEN 10 AND 500),
  enabled_categories jsonb NOT NULL DEFAULT '["UMRAH","HAJJ","DOMESTIC","INTERNATIONAL"]'::jsonb
    CHECK(jsonb_typeof(enabled_categories)='array'),
  draft_revision integer NOT NULL DEFAULT 1 CHECK(draft_revision>0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  FOREIGN KEY (tenant_id,updated_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE TABLE tenant_bot_versions (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK(version>0),
  config jsonb NOT NULL CHECK(jsonb_typeof(config)='object'),
  draft_revision integer NOT NULL CHECK(draft_revision>0),
  published_by uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,version),
  FOREIGN KEY (tenant_id,published_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE INDEX bot_versions_recent_idx ON tenant_bot_versions(tenant_id,version DESC);
ALTER TABLE tenant_bot_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_bot_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY bot_drafts_tenant ON tenant_bot_drafts
  USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE tenant_bot_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_bot_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY bot_versions_tenant ON tenant_bot_versions
  USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
COMMIT;