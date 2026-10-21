BEGIN;
-- Historical events retain NULL metadata: their order must not be invented.
ALTER TABLE chatbot_flow_step_events ADD COLUMN execution_id uuid;
ALTER TABLE chatbot_flow_step_events ADD COLUMN step_index integer;
ALTER TABLE chatbot_flow_step_events ADD COLUMN recorded_at timestamptz;
ALTER TABLE chatbot_flow_step_events ADD CONSTRAINT chatbot_flow_trace_order_check CHECK(
 (execution_id IS NULL AND step_index IS NULL AND recorded_at IS NULL) OR
 (execution_id IS NOT NULL AND step_index IS NOT NULL AND step_index>=0 AND recorded_at IS NOT NULL)
);
CREATE INDEX chatbot_flow_trace_history ON chatbot_flow_step_events(
 tenant_id,conversation_id,(coalesce(recorded_at,created_at)) DESC,
 (coalesce(execution_id,'00000000-0000-0000-0000-000000000000'::uuid)) DESC,
 (coalesce(step_index,-1)) DESC,id DESC
);
CREATE INDEX chatbot_flow_recent_sessions ON chatbot_flow_sessions(tenant_id,bot_id,updated_at DESC,conversation_id);
COMMIT;
