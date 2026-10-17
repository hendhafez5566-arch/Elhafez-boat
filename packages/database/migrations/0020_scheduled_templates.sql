BEGIN;
ALTER TABLE whatsapp_outbox ADD COLUMN scheduled_for timestamptz;
COMMIT;
