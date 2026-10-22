BEGIN;
-- Internal CRM follow-up tasks. Company-scoped and not a booking/order ledger.
CREATE TABLE chatbot_lead_tasks (
 tenant_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 lead_id uuid NOT NULL,
 due_at timestamptz NOT NULL,
 description text NOT NULL CHECK(length(description) BETWEEN 2 AND 500),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','DONE')),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,lead_id) REFERENCES chatbot_leads(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,created_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE INDEX chatbot_lead_tasks_due ON chatbot_lead_tasks(tenant_id,due_at) WHERE status='OPEN';
CREATE INDEX chatbot_lead_tasks_lead ON chatbot_lead_tasks(tenant_id,lead_id,status);
ALTER TABLE chatbot_lead_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_lead_tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY chatbot_lead_tasks_tenant ON chatbot_lead_tasks
 USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
COMMIT;
