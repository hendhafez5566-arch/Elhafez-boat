BEGIN;
ALTER TABLE chatbot_attachment_intakes ADD COLUMN flow_version integer;
ALTER TABLE chatbot_attachment_intakes ADD COLUMN flow_node_id text;
ALTER TABLE chatbot_attachment_intakes ADD COLUMN flow_session_at timestamptz;
ALTER TABLE chatbot_attachment_intakes ADD COLUMN completion_pending boolean NOT NULL DEFAULT false;
ALTER TABLE chatbot_attachment_intakes ADD COLUMN continuation_status text NOT NULL DEFAULT 'NONE' CHECK(continuation_status IN ('NONE','WAITING','DONE','SKIPPED','FAILED'));
CREATE INDEX attachment_continuation ON chatbot_attachment_intakes(tenant_id,created_at) WHERE completion_pending;
COMMIT;
