BEGIN;
-- Optional review governance. Existing bots/published sessions keep their behavior.
CREATE TABLE chatbot_flow_review_policies (
 tenant_id uuid NOT NULL, bot_id uuid NOT NULL, required boolean NOT NULL DEFAULT false,
 updated_by uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,bot_id), FOREIGN KEY(tenant_id,bot_id) REFERENCES chatbot_bots(tenant_id,id)
);
CREATE TABLE chatbot_flow_reviews (
 tenant_id uuid NOT NULL, bot_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
 draft_revision integer NOT NULL CHECK(draft_revision>0), definition_hash text NOT NULL,
 requested_by uuid NOT NULL REFERENCES users(id), decided_by uuid REFERENCES users(id),
 status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','APPROVED','CHANGES_REQUESTED')),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=1000),
 created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,bot_id) REFERENCES chatbot_bots(tenant_id,id),
 CHECK((status='REQUESTED' AND decided_by IS NULL AND decided_at IS NULL) OR
       (status<>'REQUESTED' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND decided_by<>requested_by))
);
CREATE UNIQUE INDEX flow_review_one_pending ON chatbot_flow_reviews(tenant_id,bot_id,draft_revision) WHERE status='REQUESTED';
CREATE INDEX flow_review_lookup ON chatbot_flow_reviews(tenant_id,bot_id,draft_revision,created_at DESC,id DESC);
CREATE TABLE chatbot_flow_comments (
 tenant_id uuid NOT NULL, bot_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
 draft_revision integer NOT NULL CHECK(draft_revision>0), node_id text, parent_id uuid,
 author_id uuid NOT NULL REFERENCES users(id), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 1000),
 resolved_by uuid REFERENCES users(id), resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,bot_id) REFERENCES chatbot_bots(tenant_id,id),
 FOREIGN KEY(tenant_id,parent_id) REFERENCES chatbot_flow_comments(tenant_id,id),
 CHECK((resolved_by IS NULL)=(resolved_at IS NULL))
);
CREATE INDEX flow_comments_page ON chatbot_flow_comments(tenant_id,bot_id,created_at DESC,id DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['chatbot_flow_review_policies','chatbot_flow_reviews','chatbot_flow_comments'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_scope ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;
COMMIT;
