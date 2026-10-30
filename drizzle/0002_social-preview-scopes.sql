CREATE TABLE "social_preview_channels" (
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"enabled" boolean NOT NULL,
	"changed_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_preview_channels_guild_id_channel_id_pk" PRIMARY KEY("guild_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "social_preview_domains" (
	"guild_id" text NOT NULL,
	"domain" text NOT NULL,
	"enabled" boolean NOT NULL,
	"changed_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_preview_domains_guild_id_domain_pk" PRIMARY KEY("guild_id","domain")
);
--> statement-breakpoint
CREATE TABLE "social_preview_replies" (
	"message_id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"links" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
