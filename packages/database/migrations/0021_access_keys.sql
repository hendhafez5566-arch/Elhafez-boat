BEGIN;
CREATE TABLE chatbot_access_keys (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),
 token_hash char(64) NOT NULL UNIQUE,name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
 scopes jsonb NOT NULL,created_by uuid NOT NULL,expires_at timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES memberships(tenant_id,user_id)
);
-- Routing contains only opaque digest + tenant, never key or customer information.
CREATE TABLE chatbot_access_key_routes (
 token_hash char(64) PRIMARY KEY,tenant_id uuid NOT NULL,key_id uuid NOT NULL,
 FOREIGN KEY(tenant_id,key_id) REFERENCES chatbot_access_keys(tenant_id,id) ON DELETE CASCADE
);
ALTER TABLE chatbot_access_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_access_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY access_key_tenant ON chatbot_access_keys USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
COMMIT;
