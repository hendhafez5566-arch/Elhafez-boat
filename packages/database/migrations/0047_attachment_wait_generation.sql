BEGIN;
ALTER TABLE chatbot_flow_sessions ADD COLUMN observation_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE chatbot_attachment_intakes ADD COLUMN flow_session_token uuid;
COMMIT;
