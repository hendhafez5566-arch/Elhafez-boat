BEGIN;
CREATE TABLE chatbot_commerce_links (
 tenant_id uuid NOT NULL,item_id uuid NOT NULL,account_id uuid NOT NULL,catalog_id text NOT NULL CHECK(catalog_id ~ '^[0-9]{5,30}$'),
 product_id text NOT NULL CHECK(product_id ~ '^[0-9]{5,30}$'),retailer_id text NOT NULL CHECK(length(retailer_id) BETWEEN 1 AND 100),
 enabled boolean NOT NULL DEFAULT true,verified_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL,
 PRIMARY KEY(tenant_id,item_id,account_id),UNIQUE(tenant_id,account_id,catalog_id,retailer_id),
 FOREIGN KEY(tenant_id,item_id) REFERENCES chatbot_catalog_items(tenant_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES whatsapp_accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES memberships(tenant_id,user_id)
);
ALTER TABLE chatbot_commerce_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_commerce_links FORCE ROW LEVEL SECURITY;
CREATE POLICY chatbot_commerce_links_tenant ON chatbot_commerce_links
 USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE whatsapp_outbox ADD COLUMN commerce_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(commerce_refs)='array');
COMMIT;
