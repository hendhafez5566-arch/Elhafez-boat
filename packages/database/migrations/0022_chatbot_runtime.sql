BEGIN;
ALTER TABLE contacts ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE contacts DROP CONSTRAINT contacts_source_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_source_check CHECK(source IN ('MANUAL','BOOKING','WHATSAPP','IMPORT','WEBSITE'));
ALTER TABLE conversations DROP CONSTRAINT conversations_channel_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_channel_check CHECK(channel IN ('INTERNAL','WHATSAPP','WEBSITE'));
ALTER TABLE conversation_messages ADD COLUMN payload jsonb;
ALTER TABLE conversation_messages DROP CONSTRAINT conversation_messages_body_check;
ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_body_check CHECK(length(btrim(body)) BETWEEN 1 AND 4096);
ALTER TABLE chatbot_flow_sessions ADD COLUMN runtime_nodes jsonb;
ALTER TABLE chatbot_integrations ADD COLUMN auth_mode text NOT NULL DEFAULT 'NONE' CHECK(auth_mode IN ('NONE','BEARER','HMAC'));
ALTER TABLE chatbot_integrations ADD COLUMN secret_encrypted text;
CREATE TABLE chatbot_message_reads (
 tenant_id uuid NOT NULL,message_id uuid NOT NULL,user_id uuid NOT NULL,read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,message_id,user_id),FOREIGN KEY(tenant_id,message_id) REFERENCES conversation_messages(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE
);
CREATE TABLE chatbot_delay_jobs (
 tenant_id uuid NOT NULL,conversation_id uuid NOT NULL,version integer NOT NULL,node_id text NOT NULL,
 due_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','DONE','CANCELLED','FAILED')),error text,
 PRIMARY KEY(tenant_id,conversation_id),FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX chatbot_delay_due ON chatbot_delay_jobs(tenant_id,status,due_at);
CREATE TABLE chatbot_triggers (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN ('KEYWORD','FIRST_MESSAGE')),phrase text NOT NULL DEFAULT '',match_mode text NOT NULL DEFAULT 'EXACT' CHECK(match_mode IN ('EXACT','CONTAINS')),
 target_node text NOT NULL,priority integer NOT NULL DEFAULT 0,enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(tenant_id,id)
);
CREATE TABLE chatbot_widget_settings (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,widget_key text NOT NULL UNIQUE,
 enabled boolean NOT NULL DEFAULT false,title text NOT NULL DEFAULT 'مساعد الشركة',origins jsonb NOT NULL DEFAULT '[]'
);
CREATE TABLE chatbot_widget_routes(widget_key text PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE);
CREATE TABLE chatbot_web_sessions (
 tenant_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),token_hash char(64) NOT NULL UNIQUE,conversation_id uuid NOT NULL,
 origin text NOT NULL,expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE chatbot_web_routes(token_hash char(64) PRIMARY KEY,tenant_id uuid NOT NULL,session_id uuid NOT NULL,FOREIGN KEY(tenant_id,session_id) REFERENCES chatbot_web_sessions(tenant_id,id) ON DELETE CASCADE);
CREATE TABLE chatbot_web_receipts(tenant_id uuid NOT NULL,session_id uuid NOT NULL,message_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,session_id,message_id),FOREIGN KEY(tenant_id,session_id) REFERENCES chatbot_web_sessions(tenant_id,id) ON DELETE CASCADE);
CREATE TABLE chatbot_media (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),name text NOT NULL,mime text NOT NULL,bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 5242880),
 content bytea,public_token text NOT NULL UNIQUE,status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DELETED')),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id)
);
CREATE TABLE chatbot_media_routes(token_hash char(64) PRIMARY KEY,tenant_id uuid NOT NULL,media_id uuid NOT NULL,FOREIGN KEY(tenant_id,media_id) REFERENCES chatbot_media(tenant_id,id) ON DELETE CASCADE);
CREATE TABLE chatbot_usage_limits (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,daily_inbound integer NOT NULL DEFAULT 10000 CHECK(daily_inbound BETWEEN 1 AND 1000000),daily_templates integer NOT NULL DEFAULT 500 CHECK(daily_templates BETWEEN 1 AND 100000),media_bytes bigint NOT NULL DEFAULT 52428800 CHECK(media_bytes BETWEEN 1 AND 10737418240)
);
CREATE TABLE chatbot_usage (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,day date NOT NULL DEFAULT CURRENT_DATE,inbound integer NOT NULL DEFAULT 0,templates integer NOT NULL DEFAULT 0,PRIMARY KEY(tenant_id,day)
);
ALTER TABLE whatsapp_approved_templates ADD COLUMN components jsonb NOT NULL DEFAULT '[]';
CREATE TABLE chatbot_campaigns (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),name text NOT NULL,
 segment jsonb NOT NULL DEFAULT '{}',steps jsonb NOT NULL,start_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','CANCELLED','COMPLETED')),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE TABLE chatbot_campaign_jobs (
 tenant_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),campaign_id uuid NOT NULL,contact_id uuid NOT NULL,step integer NOT NULL,due_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','QUEUED','SKIPPED','FAILED','CANCELLED')),error text,outbox_id uuid,attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,campaign_id,contact_id,step),FOREIGN KEY(tenant_id,campaign_id) REFERENCES chatbot_campaigns(tenant_id,id) ON DELETE CASCADE,FOREIGN KEY(tenant_id,contact_id) REFERENCES contacts(tenant_id,id)
);
CREATE INDEX campaign_due ON chatbot_campaign_jobs(tenant_id,status,due_at);
ALTER TABLE whatsapp_outbox ADD COLUMN campaign_id uuid;
ALTER TABLE whatsapp_outbox ADD COLUMN usage_day date;
ALTER TABLE whatsapp_outbox ADD COLUMN dispatched_at timestamptz;
ALTER TABLE whatsapp_outbox ADD CONSTRAINT outbox_campaign_fk FOREIGN KEY(tenant_id,campaign_id) REFERENCES chatbot_campaigns(tenant_id,id);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['chatbot_message_reads','chatbot_delay_jobs','chatbot_triggers','chatbot_widget_settings','chatbot_web_sessions','chatbot_web_receipts','chatbot_media','chatbot_usage_limits','chatbot_usage','chatbot_campaigns','chatbot_campaign_jobs'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab||'_tenant',tab);
 END LOOP;
END $$;
COMMIT;
