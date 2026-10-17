-- Customer-specific booking choices are stored server-side to prevent trusting
-- client-visible labels or unverified WhatsApp Flow payload price fields.
BEGIN;
ALTER TABLE whatsapp_conversation_states
  ADD COLUMN booking_departure_id uuid,
  ADD COLUMN booking_room_package_id uuid;
ALTER TABLE whatsapp_conversation_states DROP CONSTRAINT whatsapp_conversation_states_awaiting_check;
ALTER TABLE whatsapp_conversation_states ADD CONSTRAINT whatsapp_conversation_states_awaiting_check
  CHECK(awaiting IN ('NONE','BOOKING_DEPARTURE','BOOKING_ROOM','BOOKING_NAME','BOOKING_PARTY'));
ALTER TABLE whatsapp_conversation_states ADD CONSTRAINT wa_booking_departure_fk
  FOREIGN KEY(tenant_id,booking_program_id,booking_departure_id)
  REFERENCES program_departures(tenant_id,program_id,id);
ALTER TABLE whatsapp_conversation_states ADD CONSTRAINT wa_booking_room_fk
  FOREIGN KEY(tenant_id,booking_program_id,booking_departure_id,booking_room_package_id)
  REFERENCES program_room_packages(tenant_id,program_id,departure_id,id);
ALTER TABLE whatsapp_flow_sessions
  ADD COLUMN departure_id uuid,
  ADD COLUMN room_package_id uuid;
ALTER TABLE whatsapp_flow_sessions ADD CONSTRAINT wa_flow_departure_fk
  FOREIGN KEY(tenant_id,program_id,departure_id)
  REFERENCES program_departures(tenant_id,program_id,id);
ALTER TABLE whatsapp_flow_sessions ADD CONSTRAINT wa_flow_room_fk
  FOREIGN KEY(tenant_id,program_id,departure_id,room_package_id)
  REFERENCES program_room_packages(tenant_id,program_id,departure_id,id);
COMMIT;