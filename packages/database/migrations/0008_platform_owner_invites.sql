-- First tenant owner onboarding is separate from employee invitations (no existing member FK).
BEGIN;
CREATE TABLE tenant_owner_invites (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
 invited_email text NOT NULL,
 token_hash char(64) NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Never grant this table to the ordinary tenant runtime role.
COMMIT;