BEGIN;
CREATE TABLE chatbot_bot_routes (
 tenant_id uuid NOT NULL, bot_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('WEBSITE','WHATSAPP','MESSENGER','INSTAGRAM','TELEGRAM')),
 account_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,bot_id) REFERENCES chatbot_bots(tenant_id,id),
 CONSTRAINT bot_route_account CHECK((channel='WEBSITE')=(account_id IS NULL)),
 UNIQUE NULLS NOT DISTINCT(tenant_id,channel,account_id)
);
ALTER TABLE chatbot_bot_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_bot_routes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON chatbot_bot_routes
 USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE chatbot_flow_sessions ADD COLUMN bot_id uuid;
ALTER TABLE chatbot_flow_sessions ADD CONSTRAINT session_bot_fk FOREIGN KEY(tenant_id,bot_id) REFERENCES chatbot_bots(tenant_id,id);
UPDATE chatbot_flow_sessions s SET bot_id=b.id FROM chatbot_bots b WHERE b.tenant_id=s.tenant_id AND b.legacy_default;
COMMIT;
