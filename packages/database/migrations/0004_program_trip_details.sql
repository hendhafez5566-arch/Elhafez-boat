-- Extend catalog detail read models for customer WhatsApp menus.
BEGIN;
ALTER TABLE programs ADD COLUMN summary text NOT NULL DEFAULT '' CHECK(length(summary)<=2000);
ALTER TABLE programs ADD COLUMN hotel_name text CHECK(length(hotel_name)<=160);
ALTER TABLE programs ADD COLUMN duration_days integer CHECK(duration_days BETWEEN 1 AND 90);
ALTER TABLE programs ADD COLUMN departure_at timestamptz;
COMMIT;