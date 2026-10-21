BEGIN;
ALTER TABLE chatbot_flow_step_events ADD COLUMN waiting boolean;
ALTER TABLE chatbot_flow_step_events ADD COLUMN terminal boolean;
ALTER TABLE audit_events ADD COLUMN flow_context jsonb CHECK(flow_context IS NULL OR (jsonb_typeof(flow_context)='object' AND octet_length(flow_context::text)<=2000));
CREATE INDEX flow_failure_scope ON audit_events(tenant_id,created_at DESC) WHERE action='FLOW_EXECUTION_FAILED';
ALTER TABLE conversation_messages ADD COLUMN execution_id uuid;
ALTER TABLE whatsapp_outbox ADD COLUMN execution_id uuid;
ALTER TABLE chatbot_social_outbox ADD COLUMN execution_id uuid;
CREATE INDEX message_execution ON conversation_messages(tenant_id,execution_id) WHERE execution_id IS NOT NULL;
CREATE INDEX whatsapp_execution ON whatsapp_outbox(tenant_id,execution_id) WHERE execution_id IS NOT NULL;
CREATE INDEX social_execution ON chatbot_social_outbox(tenant_id,execution_id) WHERE execution_id IS NOT NULL;
CREATE FUNCTION flow_delivery_correlation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.execution_id IS NULL AND NEW.conversation_id::text=current_setting('app.flow_conversation',true) AND (TG_TABLE_NAME<>'conversation_messages' OR to_jsonb(NEW)->>'kind'='OUTBOUND') THEN
 NEW.execution_id=nullif(current_setting('app.flow_execution',true),'')::uuid;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER flow_message_correlation BEFORE INSERT ON conversation_messages FOR EACH ROW EXECUTE FUNCTION flow_delivery_correlation();
CREATE TRIGGER flow_whatsapp_correlation BEFORE INSERT ON whatsapp_outbox FOR EACH ROW EXECUTE FUNCTION flow_delivery_correlation();
CREATE TRIGGER flow_social_correlation BEFORE INSERT ON chatbot_social_outbox FOR EACH ROW EXECUTE FUNCTION flow_delivery_correlation();
COMMIT;
