ALTER TABLE "bot_guilds" ALTER COLUMN "bot_talk_cooldown_seconds" SET DEFAULT 300;--> statement-breakpoint
-- Rows still holding the old 60s default move to the new 5 minute default.
-- Servers that set a custom cooldown keep their value.
UPDATE "bot_guilds" SET "bot_talk_cooldown_seconds" = 300 WHERE "bot_talk_cooldown_seconds" = 60;
