-- Reusable conversation sections are immutable copies embedded into individual flow drafts.
-- No cross-tenant library access. Migration remains additive and preserves previous data.
BEGIN;
CREATE TABLE chatbot_flow_snippets (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK(char_length(name) BETWEEN 2 AND 80),
  definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,created_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE INDEX chatbot_flow_snippets_tenant_idx ON chatbot_flow_snippets(tenant_id,created_at DESC);
ALTER TABLE chatbot_flow_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_flow_snippets FORCE ROW LEVEL SECURITY;
CREATE POLICY chatbot_flow_snippets_tenant ON chatbot_flow_snippets
  USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
COMMIT;
