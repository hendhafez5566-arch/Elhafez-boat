-- Invite flow and platform owner administration; separate from tenant identity.
BEGIN;
CREATE TABLE team_invitations (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 invited_email text NOT NULL,
 role text NOT NULL CHECK(role IN ('OWNER','MANAGER','AGENT','VIEWER')),
 token_hash char(64) NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES memberships(tenant_id,user_id)
);
-- Lookup stores only token digest and tenant routing. Invite details remain RLS protected.
CREATE TABLE invitation_lookup (
 token_hash char(64) PRIMARY KEY,
 tenant_id uuid NOT NULL,
 invitation_id uuid NOT NULL,
 FOREIGN KEY(tenant_id,invitation_id) REFERENCES team_invitations(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE platform_owners (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE,
 password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_sessions (
 token_hash char(64) PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES platform_owners(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE subscription_plans (
 code text PRIMARY KEY CHECK(code ~ '^[A-Z][A-Z0-9_]{2,30}$'),
 title text NOT NULL,
 monthly_price_minor bigint NOT NULL CHECK(monthly_price_minor>=0),
 currency char(3) NOT NULL DEFAULT 'EGP',
 max_staff integer NOT NULL CHECK(max_staff BETWEEN 1 AND 1000),
 max_programs integer NOT NULL CHECK(max_programs BETWEEN 1 AND 100000),
 active boolean NOT NULL DEFAULT true
);
INSERT INTO subscription_plans(code,title,monthly_price_minor,currency,max_staff,max_programs) VALUES
 ('STARTER','أساسي',0,'EGP',3,50),('BUSINESS','أعمال',0,'EGP',15,500),('ENTERPRISE','شركات',0,'EGP',100,5000);
CREATE TABLE tenant_subscriptions (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
 plan_code text NOT NULL REFERENCES subscription_plans(code),
 status text NOT NULL DEFAULT 'TRIAL' CHECK(status IN ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED')),
 current_period_ends_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES platform_owners(id),
 action text NOT NULL,
 tenant_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY team_invitations_tenant ON team_invitations USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
-- subscription data is tenant-owned; platform management occurs in platform authenticated role.
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_tenant ON tenant_subscriptions USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
COMMIT;