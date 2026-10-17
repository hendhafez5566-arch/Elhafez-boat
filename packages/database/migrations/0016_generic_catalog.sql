BEGIN;
CREATE TABLE chatbot_catalog_items (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN ('PRODUCT','SERVICE','OFFER','OTHER')),
 title text NOT NULL CHECK(length(title) BETWEEN 2 AND 160),
 category_label text NOT NULL DEFAULT '',description text NOT NULL DEFAULT '',
 price_text text NOT NULL DEFAULT '',image_url text NOT NULL DEFAULT '',external_url text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED')),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE INDEX catalog_published_idx ON chatbot_catalog_items(tenant_id,status,updated_at DESC);
ALTER TABLE chatbot_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_catalog_items FORCE ROW LEVEL SECURITY;
CREATE POLICY catalog_tenant ON chatbot_catalog_items USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE chatbot_leads ADD COLUMN catalog_item_id uuid;
ALTER TABLE chatbot_leads ADD CONSTRAINT lead_catalog_fk FOREIGN KEY(tenant_id,catalog_item_id) REFERENCES chatbot_catalog_items(tenant_id,id);
COMMIT;
