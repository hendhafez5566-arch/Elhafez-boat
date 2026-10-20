BEGIN;
ALTER TABLE chatbot_integration_jobs DROP CONSTRAINT chatbot_integration_jobs_status_check;
ALTER TABLE chatbot_integration_jobs ADD CONSTRAINT chatbot_integration_jobs_status_check CHECK(status IN ('PENDING','PROCESSING','SENT','FAILED','UNCERTAIN','CANCELLED'));
ALTER TABLE chatbot_integration_jobs ADD COLUMN conversation_id uuid;
ALTER TABLE chatbot_integration_jobs ADD COLUMN flow_version integer;
ALTER TABLE chatbot_integration_jobs ADD COLUMN flow_node_id text;
ALTER TABLE chatbot_integration_jobs ADD COLUMN wait_token uuid;
ALTER TABLE chatbot_integration_jobs ADD COLUMN flow_request jsonb;
ALTER TABLE chatbot_integration_jobs ADD COLUMN deadline_at timestamptz;
ALTER TABLE chatbot_integration_jobs ADD COLUMN dispatch_until timestamptz;
ALTER TABLE chatbot_integration_jobs ADD COLUMN result_outcome text CHECK(result_outcome IN ('SUCCESS','ERROR','TIMEOUT'));
ALTER TABLE chatbot_integration_jobs ADD COLUMN result_fields jsonb;
ALTER TABLE chatbot_integration_jobs ADD COLUMN response_status integer;
ALTER TABLE chatbot_integration_jobs ADD COLUMN completion_pending boolean NOT NULL DEFAULT false;
ALTER TABLE chatbot_integration_jobs ADD COLUMN continuation_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE chatbot_integration_jobs ADD CONSTRAINT integration_conversation_fk FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id);
ALTER TABLE chatbot_integration_jobs ADD CONSTRAINT integration_flow_context_check CHECK(
 (flow_request IS NULL AND conversation_id IS NULL AND flow_version IS NULL AND flow_node_id IS NULL AND wait_token IS NULL AND deadline_at IS NULL) OR
 (flow_request IS NOT NULL AND conversation_id IS NOT NULL AND flow_version IS NOT NULL AND flow_node_id IS NOT NULL AND wait_token IS NOT NULL AND deadline_at IS NOT NULL)
);
CREATE UNIQUE INDEX integration_flow_wait_unique ON chatbot_integration_jobs(tenant_id,conversation_id,wait_token) WHERE flow_request IS NOT NULL;
CREATE INDEX integration_flow_ready ON chatbot_integration_jobs(tenant_id,completion_pending,status,next_attempt_at) WHERE flow_request IS NOT NULL;
COMMIT;
