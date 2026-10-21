BEGIN;
-- Preserve existing rows and their RLS policies; EVENT names use the existing phrase column.
ALTER TABLE chatbot_triggers DROP CONSTRAINT chatbot_triggers_kind_check;
ALTER TABLE chatbot_triggers ADD CONSTRAINT chatbot_triggers_kind_check CHECK(kind IN ('KEYWORD','FIRST_MESSAGE','EVENT'));
ALTER TABLE chatbot_bot_triggers DROP CONSTRAINT chatbot_bot_triggers_kind_check;
ALTER TABLE chatbot_bot_triggers ADD CONSTRAINT chatbot_bot_triggers_kind_check CHECK(kind IN ('KEYWORD','FIRST_MESSAGE','EVENT'));
ALTER TABLE chatbot_triggers ADD COLUMN channel text CHECK(channel IN ('WHATSAPP','WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM'));
ALTER TABLE chatbot_bot_triggers ADD COLUMN channel text CHECK(channel IN ('WHATSAPP','WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM'));
ALTER TABLE chatbot_triggers ADD CONSTRAINT chatbot_triggers_event_check CHECK(kind<>'EVENT' OR phrase IN ('MESSAGE','POSTBACK','MEDIA','LOCATION'));
ALTER TABLE chatbot_bot_triggers ADD CONSTRAINT chatbot_bot_triggers_event_check CHECK(kind<>'EVENT' OR phrase IN ('MESSAGE','POSTBACK','MEDIA','LOCATION'));
COMMIT;
