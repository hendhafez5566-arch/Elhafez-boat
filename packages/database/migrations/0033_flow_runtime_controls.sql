BEGIN;
-- Additive defaults preserve every existing session and old DELAY job.
ALTER TABLE chatbot_flow_sessions ADD COLUMN runtime_state jsonb NOT NULL DEFAULT '{}';
ALTER TABLE chatbot_delay_jobs ADD COLUMN wait_token uuid;
CREATE TABLE chatbot_flow_step_events(
 tenant_id uuid NOT NULL REFERENCES tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL, bot_id uuid, version integer NOT NULL,
 node_id text NOT NULL CHECK(length(node_id)<=180), node_type text NOT NULL CHECK(length(node_type)<=40),
 outcome text NOT NULL CHECK(length(outcome)<=100), elapsed_ms numeric NOT NULL DEFAULT 0 CHECK(elapsed_ms>=0),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,bot_id) REFERENCES chatbot_bots(tenant_id,id)
);
CREATE INDEX chatbot_flow_step_reporting ON chatbot_flow_step_events(tenant_id,bot_id,version,created_at,node_id);
ALTER TABLE chatbot_flow_step_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_flow_step_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chatbot_flow_step_events
 USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
COMMIT;
