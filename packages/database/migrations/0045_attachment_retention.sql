BEGIN;
ALTER TABLE chatbot_attachment_intakes DROP CONSTRAINT chatbot_attachment_intakes_tenant_id_media_id_fkey;
ALTER TABLE chatbot_attachment_intakes ADD CONSTRAINT attachment_private_asset FOREIGN KEY(tenant_id,media_id) REFERENCES chatbot_media(tenant_id,id) ON DELETE SET NULL (media_id);
CREATE INDEX attachment_pending ON chatbot_attachment_intakes(tenant_id,created_at) WHERE status='PENDING';
COMMIT;
