-- Program departure dates, contracted rooms, and capacity-aware booking allocation.
BEGIN;
CREATE TABLE program_departures (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 program_id uuid NOT NULL,
 depart_at timestamptz NOT NULL,
 return_at timestamptz NOT NULL,
 seats_total integer NOT NULL CHECK(seats_total BETWEEN 1 AND 100000),
 seats_booked integer NOT NULL DEFAULT 0 CHECK(seats_booked>=0),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','CLOSED')),
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,program_id,id),
 FOREIGN KEY(tenant_id,program_id) REFERENCES programs(tenant_id,id) ON DELETE CASCADE,
 CHECK(return_at>depart_at),
 CHECK(seats_booked<=seats_total)
);
CREATE INDEX departures_program_idx ON program_departures(tenant_id,program_id,depart_at);
CREATE TABLE program_room_packages (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 program_id uuid NOT NULL,
 departure_id uuid NOT NULL,
 hotel_name text NOT NULL CHECK(length(btrim(hotel_name)) BETWEEN 2 AND 160),
 room_type text NOT NULL CHECK(room_type IN ('SINGLE','DOUBLE','TRIPLE','QUAD','FAMILY')),
 occupancy integer NOT NULL CHECK(occupancy BETWEEN 1 AND 8),
 nights integer NOT NULL CHECK(nights BETWEEN 1 AND 90),
 units_total integer NOT NULL CHECK(units_total BETWEEN 0 AND 100000),
 units_booked integer NOT NULL DEFAULT 0 CHECK(units_booked>=0),
 price_minor bigint NOT NULL CHECK(price_minor>=0),
 currency char(3) NOT NULL,
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,program_id,departure_id,id),
 FOREIGN KEY(tenant_id,program_id,departure_id) REFERENCES program_departures(tenant_id,program_id,id) ON DELETE CASCADE,
 CHECK(units_booked<=units_total)
);
CREATE INDEX rooms_departure_idx ON program_room_packages(tenant_id,departure_id);
ALTER TABLE booking_requests ADD COLUMN departure_id uuid;
ALTER TABLE booking_requests ADD COLUMN room_package_id uuid;
ALTER TABLE booking_requests ADD COLUMN room_units integer CHECK(room_units>0);
ALTER TABLE booking_requests ADD CONSTRAINT booking_departure_reference FOREIGN KEY(tenant_id,program_id,departure_id)
 REFERENCES program_departures(tenant_id,program_id,id);
ALTER TABLE booking_requests ADD CONSTRAINT booking_room_reference FOREIGN KEY(tenant_id,program_id,departure_id,room_package_id)
 REFERENCES program_room_packages(tenant_id,program_id,departure_id,id);
ALTER TABLE booking_requests ADD CONSTRAINT booking_room_requirements CHECK((room_package_id IS NULL AND room_units IS NULL) OR (room_package_id IS NOT NULL AND departure_id IS NOT NULL AND room_units IS NOT NULL));
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['program_departures','program_room_packages'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t||'_tenant',t);
 END LOOP;
END $$;
COMMIT;