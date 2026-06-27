CREATE TABLE "bot_guilds" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"guild_name" text NOT NULL,
	"commands_hash" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
