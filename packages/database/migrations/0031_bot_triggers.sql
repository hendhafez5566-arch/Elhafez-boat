BEGIN;
CREATE TABLE chatbot_bot_triggers (
 tenant_id uuid NOT NULL, bot_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN ('KEYWORD','FIRST_MESSAGE')), phrase text NOT NULL DEFAULT '',
 match_mode text NOT NULL DEFAULT 'EXACT' CHECK(match_mode IN ('EXACT','CONTAINS')),
 target_node text NOT NULL, priority integer NOT NULL DEFAULT 0, enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(tenant_id,bot_id,id), FOREIGN KEY(tenant_id,bot_id) REFERENCES chatbot_bots(tenant_id,id)
);
ALTER TABLE chatbot_bot_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_bot_triggers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON chatbot_bot_triggers
 USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
COMMIT;
