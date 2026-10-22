-- Company-approved FAQ knowledge only, no AI-generated business facts.
BEGIN;
CREATE TABLE tenant_knowledge_articles (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 question text NOT NULL CHECK(length(btrim(question)) BETWEEN 5 AND 300),
 answer text NOT NULL CHECK(length(btrim(answer)) BETWEEN 5 AND 2000),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED')),
 created_by uuid NOT NULL,
 published_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES memberships(tenant_id,user_id),
 FOREIGN KEY(tenant_id,published_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE INDEX knowledge_tenant_status ON tenant_knowledge_articles(tenant_id,status,updated_at DESC);
ALTER TABLE tenant_knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_knowledge_articles FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_tenant ON tenant_knowledge_articles USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
COMMIT;