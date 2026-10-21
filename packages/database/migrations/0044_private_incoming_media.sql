BEGIN;
ALTER TABLE chatbot_media ADD COLUMN conversation_id uuid;
ALTER TABLE chatbot_media ADD CONSTRAINT media_conversation FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id);
CREATE INDEX private_media_conversation ON chatbot_media(tenant_id,conversation_id) WHERE conversation_id IS NOT NULL;
CREATE TABLE chatbot_attachment_intakes(
 tenant_id uuid NOT NULL REFERENCES tenants(id),id uuid NOT NULL DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('WHATSAPP','TELEGRAM','MESSENGER','INSTAGRAM')),account_id uuid NOT NULL,
 source_key text NOT NULL CHECK(length(source_key)<=250),kind text NOT NULL CHECK(kind IN ('image','video','audio','document')),
 reference text NOT NULL CHECK(length(reference)<=350),status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','STORED','REJECTED','FAILED','TIMEOUT','CANCELLED')),
 media_id uuid,reason text CHECK(reason IS NULL OR reason IN ('SOURCE_REJECTED','SIZE_OR_TYPE','DOWNLOAD_FAILED','DEADLINE','ERASED')),
 created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,channel,account_id,source_key),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id),FOREIGN KEY(tenant_id,media_id) REFERENCES chatbot_media(tenant_id,id));
ALTER TABLE chatbot_attachment_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_attachment_intakes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON chatbot_attachment_intakes USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
COMMIT;
