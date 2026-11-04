CREATE TABLE "ai_chat_memories" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"turns" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_chat_memories_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
