BEGIN;
-- Do not backfill: historical payload/contact similarity is not proof of conversation ownership.
ALTER TABLE chatbot_integration_jobs DROP CONSTRAINT integration_flow_context_check;
ALTER TABLE chatbot_integration_jobs ADD CONSTRAINT integration_flow_context_check CHECK(
 (flow_request IS NULL AND wait_token IS NULL AND deadline_at IS NULL AND (
   (conversation_id IS NULL AND flow_version IS NULL AND flow_node_id IS NULL) OR
   (conversation_id IS NOT NULL AND contact_id IS NOT NULL AND flow_version IS NOT NULL AND flow_version>0 AND flow_node_id IS NOT NULL))) OR
 (flow_request IS NOT NULL AND conversation_id IS NOT NULL AND contact_id IS NOT NULL AND flow_version IS NOT NULL AND flow_version>0 AND flow_node_id IS NOT NULL AND wait_token IS NOT NULL AND deadline_at IS NOT NULL)
);
ALTER TABLE chatbot_connector_jobs ADD CONSTRAINT connector_nonblocking_origin CHECK(flow_request IS NOT NULL OR
 (conversation_id IS NULL AND flow_version IS NULL AND flow_node_id IS NULL) OR
 (conversation_id IS NOT NULL AND flow_version IS NOT NULL AND flow_version>0 AND flow_node_id IS NOT NULL));
CREATE INDEX integration_owned_nonblocking ON chatbot_integration_jobs(tenant_id,conversation_id,status) WHERE flow_request IS NULL AND conversation_id IS NOT NULL;
CREATE INDEX connector_owned_nonblocking ON chatbot_connector_jobs(tenant_id,conversation_id,status) WHERE flow_request IS NULL AND conversation_id IS NOT NULL;
COMMIT;
