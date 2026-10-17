-- Opt-in-controlled official Meta WhatsApp message templates; single-recipient sending only.
BEGIN;
ALTER TABLE contacts ADD COLUMN marketing_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE contacts ADD COLUMN marketing_opt_in_at timestamptz;
ALTER TABLE contacts ADD CONSTRAINT consent_timestamp_rule CHECK(marketing_opt_in=false OR marketing_opt_in_at IS NOT NULL);
CREATE TABLE whatsapp_approved_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  account_id uuid NOT NULL,
  template_name text NOT NULL CHECK(template_name ~ '^[a-z0-9_]{2,120}$'),
  language_code text NOT NULL CHECK(language_code ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  category text NOT NULL CHECK(category IN ('UTILITY','MARKETING','AUTHENTICATION')),
  last_provider_verification timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,account_id,template_name,language_code),
  FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id)
);
CREATE TABLE template_message_activity (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 contact_id uuid NOT NULL,
 template_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 sent_by uuid NOT NULL,
 queued_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,contact_id) REFERENCES contacts(tenant_id,id),
 FOREIGN KEY(tenant_id,template_id) REFERENCES whatsapp_approved_templates(tenant_id,id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id),
 FOREIGN KEY(tenant_id,sent_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE INDEX template_activity_limit_idx ON template_message_activity(tenant_id,contact_id,queued_at DESC);
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['whatsapp_approved_templates','template_message_activity'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY %I ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t||'_tenant',t);
 END LOOP;
END $$;
COMMIT;