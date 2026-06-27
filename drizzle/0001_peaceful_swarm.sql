ALTER TABLE "bot_guilds" ADD COLUMN "social_preview_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "bot_guilds" ADD COLUMN "social_preview_changed_by" text;--> statement-breakpoint
ALTER TABLE "bot_guilds" ADD COLUMN "social_preview_changed_at" timestamp with time zone;