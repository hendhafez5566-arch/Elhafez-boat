BEGIN;
-- Mutation receipts contain hashes/revisions only, never a second copy of a graph.
CREATE TABLE chatbot_flow_save_receipts (
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 actor_id uuid NOT NULL REFERENCES users(id),
 flow_scope text NOT NULL CHECK(length(flow_scope) BETWEEN 1 AND 80),
 mutation_id uuid NOT NULL,
 request_hash text NOT NULL CHECK(length(request_hash)=64),
 draft_revision integer NOT NULL CHECK(draft_revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 PRIMARY KEY(tenant_id,actor_id,flow_scope,mutation_id)
);
CREATE INDEX chatbot_flow_save_receipt_expiry ON chatbot_flow_save_receipts(expires_at);
ALTER TABLE chatbot_flow_save_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_flow_save_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON chatbot_flow_save_receipts USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
COMMIT;
