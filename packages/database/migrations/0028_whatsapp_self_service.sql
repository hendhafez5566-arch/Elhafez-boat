BEGIN;
ALTER TABLE whatsapp_accounts ADD COLUMN phone_platform text;
ALTER TABLE whatsapp_accounts ADD COLUMN phone_verified_at timestamptz;
ALTER TABLE whatsapp_accounts ADD COLUMN connection_mode text NOT NULL DEFAULT 'MANUAL' CHECK(connection_mode IN ('MANUAL','CLOUD','COEXISTENCE'));
ALTER TABLE whatsapp_accounts ADD COLUMN authorization_status text NOT NULL DEFAULT 'UNKNOWN' CHECK(authorization_status IN ('UNKNOWN','VERIFIED','REAUTH_REQUIRED'));
ALTER TABLE whatsapp_accounts ADD COLUMN subscription_verified_at timestamptz;
ALTER TABLE whatsapp_accounts ADD COLUMN last_inbound_at timestamptz;
ALTER TABLE whatsapp_accounts ADD COLUMN last_echo_at timestamptz;
ALTER TABLE whatsapp_accounts ADD COLUMN history_consent boolean NOT NULL DEFAULT false;
ALTER TABLE whatsapp_accounts ADD COLUMN contacts_consent boolean NOT NULL DEFAULT false;
ALTER TABLE whatsapp_accounts ADD COLUMN token_expires_at timestamptz;
ALTER TABLE whatsapp_accounts ADD COLUMN sync_status text NOT NULL DEFAULT 'NOT_REQUESTED';
ALTER TABLE whatsapp_accounts ADD COLUMN last_account_event_at timestamptz;
CREATE TABLE whatsapp_onboarding_attempts(
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 nonce_hash text NOT NULL,
 mode text NOT NULL CHECK(mode IN ('CLOUD','COEXISTENCE')),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SELECT_PHONE','PROCESSING','COMPLETE','CANCELLED','FAILED','UNCERTAIN')),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 error_code text,
 account_id uuid,
 token_encrypted text,
 authorized_waba text,
 phone_choices jsonb,
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id)
);
CREATE INDEX whatsapp_onboarding_expiry ON whatsapp_onboarding_attempts(tenant_id,expires_at);
CREATE TABLE whatsapp_signup_operations(
 tenant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 attempt_id uuid NOT NULL,
 operation text NOT NULL CHECK(operation IN ('history','smb_app_state_sync','register')),
 status text NOT NULL DEFAULT 'PROCESSING' CHECK(status IN ('PROCESSING','REQUESTED','UNCERTAIN')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,account_id,attempt_id,operation),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,attempt_id) REFERENCES whatsapp_onboarding_attempts(tenant_id,id)
);
CREATE TABLE whatsapp_sync_receipts(
 tenant_id uuid NOT NULL,
 account_id uuid NOT NULL,
 event_key text NOT NULL,
 field text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,account_id,event_key),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id)
);
ALTER TABLE whatsapp_routes ADD COLUMN waba_id text;
UPDATE whatsapp_routes r SET waba_id=a.waba_id FROM whatsapp_accounts a WHERE a.tenant_id=r.tenant_id AND a.id=r.account_id;
CREATE INDEX whatsapp_routes_waba ON whatsapp_routes(waba_id);
ALTER TABLE conversation_messages ADD COLUMN message_source text NOT NULL DEFAULT 'PLATFORM' CHECK(message_source IN ('PLATFORM','CUSTOMER','BUSINESS_APP','HISTORY'));
ALTER TABLE conversation_messages ADD COLUMN provider_at timestamptz;
ALTER TABLE conversation_messages ADD COLUMN imported_history boolean NOT NULL DEFAULT false;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['whatsapp_onboarding_attempts','whatsapp_sync_receipts','whatsapp_signup_operations'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab||'_tenant',tab);
 END LOOP;
END $$;
COMMIT;
