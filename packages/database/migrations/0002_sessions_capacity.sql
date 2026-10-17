-- Session storage and atomic booking seat accounting. Run AFTER 0001_initial.sql.
BEGIN;
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash char(64) NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE
);
CREATE INDEX sessions_user_expiry_idx ON sessions(tenant_id,user_id,expires_at);
ALTER TABLE programs ADD COLUMN booked_seats integer NOT NULL DEFAULT 0;
ALTER TABLE programs ADD CONSTRAINT booked_seats_in_bounds CHECK(booked_seats >= 0 AND booked_seats <= available_seats);
COMMIT;