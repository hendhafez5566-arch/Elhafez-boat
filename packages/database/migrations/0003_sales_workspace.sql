-- Sales workspaces: contacts, conversations, offers and follow-up tasks.
-- Real WhatsApp events are NOT ingested in this migration.
BEGIN;
CREATE TABLE contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 120),
  phone text NOT NULL CHECK (phone ~ '^\+?[0-9]{8,15}$'),
  email text,
  source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','BOOKING','WHATSAPP','IMPORT')),
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','QUALIFIED','CUSTOMER','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, phone)
);
CREATE INDEX contacts_tenant_status_idx ON contacts(tenant_id,status,created_at DESC);
CREATE TABLE contact_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, author_id) REFERENCES memberships(tenant_id,user_id)
);
CREATE INDEX contact_notes_contact_idx ON contact_notes(tenant_id,contact_id,created_at DESC);
CREATE TABLE offers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
  details text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,program_id) REFERENCES programs(tenant_id,id),
  CHECK (ends_at > starts_at)
);
CREATE INDEX offers_tenant_status_idx ON offers(tenant_id,status,ends_at);
CREATE TABLE conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'INTERNAL' CHECK(channel IN ('INTERNAL','WHATSAPP')),
  status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','HUMAN','CLOSED')),
  assigned_user_id uuid,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,contact_id) REFERENCES contacts(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,assigned_user_id) REFERENCES memberships(tenant_id,user_id)
);
CREATE INDEX conversations_tenant_updated_idx ON conversations(tenant_id,COALESCE(last_message_at,created_at) DESC);
CREATE TABLE conversation_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  author_id uuid,
  kind text NOT NULL CHECK(kind IN ('INTERNAL_NOTE','INBOUND','OUTBOUND')),
  body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,author_id) REFERENCES memberships(tenant_id,user_id)
);
CREATE INDEX conversation_messages_thread_idx ON conversation_messages(tenant_id,conversation_id,created_at);
CREATE TABLE followup_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  assigned_user_id uuid,
  title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 160),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','DONE','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,contact_id) REFERENCES contacts(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,assigned_user_id) REFERENCES memberships(tenant_id,user_id)
);
CREATE INDEX followups_due_idx ON followup_tasks(tenant_id,status,due_at);
DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['contacts','contact_notes','offers','conversations','conversation_messages','followup_tasks'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
    EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab||'_tenant',tab);
  END LOOP;
END $$;
COMMIT;