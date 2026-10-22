-- Owner-approved scope: chatbot leads only. No reservations or financial operations.
BEGIN;
CREATE TABLE chatbot_leads (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  program_id uuid,
  stage text NOT NULL DEFAULT 'INTERESTED'
    CHECK(stage IN ('INTERESTED','READY_FOR_AGENT','CONTACTED','CLOSED')),
  party_size integer CHECK(party_size BETWEEN 1 AND 100),
  travel_preference text CHECK(travel_preference IS NULL OR length(travel_preference) <= 160),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  PRIMARY KEY (tenant_id,id),
  UNIQUE(tenant_id,conversation_id),
  FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,contact_id) REFERENCES contacts(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,program_id) REFERENCES programs(tenant_id,id)
);
CREATE INDEX chatbot_leads_queue_idx ON chatbot_leads(tenant_id,stage,updated_at DESC);
ALTER TABLE chatbot_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_leads FORCE ROW LEVEL SECURITY;
CREATE POLICY chatbot_leads_tenant ON chatbot_leads
 USING(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE whatsapp_conversation_states ADD COLUMN lead_id uuid;
ALTER TABLE whatsapp_conversation_states ADD COLUMN lead_stage text NOT NULL DEFAULT 'NONE'
 CHECK(lead_stage IN ('NONE','AWAIT_PARTY','AWAIT_TRAVEL'));
ALTER TABLE whatsapp_conversation_states ADD CONSTRAINT wa_state_lead_fk
 FOREIGN KEY(tenant_id,lead_id) REFERENCES chatbot_leads(tenant_id,id);
COMMIT;
