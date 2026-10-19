BEGIN;
ALTER TABLE chatbot_bot_drafts ADD CONSTRAINT bot_draft_object CHECK(jsonb_typeof(definition)='object');
ALTER TABLE chatbot_bot_versions ADD CONSTRAINT bot_version_object CHECK(jsonb_typeof(definition)='object');
ALTER TABLE chatbot_bot_versions ADD CONSTRAINT bot_source_object CHECK(source_definition IS NULL OR jsonb_typeof(source_definition)='object');
ALTER TABLE chatbot_bot_versions ADD CONSTRAINT bot_version_draft_revision CHECK(draft_revision>0);
CREATE INDEX chatbot_routes_by_bot ON chatbot_bot_routes(tenant_id,bot_id);
CREATE INDEX chatbot_sessions_by_bot ON chatbot_flow_sessions(tenant_id,bot_id,updated_at DESC);
COMMIT;
