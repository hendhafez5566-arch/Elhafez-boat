BEGIN;
-- Comment triggers are company-specific. This stores opaque IDs and fixed replies, NOT public comment text.
CREATE TABLE chatbot_comment_rules(
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
 keyword text NOT NULL CHECK(length(keyword) BETWEEN 3 AND 80),
 reply_text text NOT NULL CHECK(length(reply_text) BETWEEN 2 AND 1000),
 mode text NOT NULL DEFAULT 'REVIEW' CHECK(mode IN ('REVIEW','AUTO')),
 enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES chatbot_social_accounts(tenant_id,id)
);
CREATE TABLE chatbot_comment_candidates(
 tenant_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL,
 rule_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('MESSENGER','INSTAGRAM')),
 comment_id text NOT NULL CHECK(length(comment_id) BETWEEN 1 AND 200),
 reply_text text NOT NULL CHECK(length(reply_text) BETWEEN 2 AND 1000),
 status text NOT NULL DEFAULT 'REVIEW' CHECK(status IN ('REVIEW','APPROVED','SKIPPED','PROCESSING','SENT','FAILED','UNCERTAIN')),
 comment_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 locked_at timestamptz,
 last_error text,
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,account_id,comment_id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES chatbot_social_accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,rule_id) REFERENCES chatbot_comment_rules(tenant_id,id)
);
CREATE INDEX chatbot_comment_pending ON chatbot_comment_candidates(tenant_id,created_at) WHERE status IN ('REVIEW','APPROVED');
ALTER TABLE chatbot_comment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_comment_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY comment_rules_tenant ON chatbot_comment_rules
 USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE chatbot_comment_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_comment_candidates FORCE ROW LEVEL SECURITY;
CREATE POLICY comment_candidates_tenant ON chatbot_comment_candidates
 USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
COMMIT;
