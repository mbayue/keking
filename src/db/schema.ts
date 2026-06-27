import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const botGuilds = pgTable("bot_guilds", {
  guild_id: text("guild_id").primaryKey(),
  guild_name: text("guild_name").notNull(),
  commands_hash: text("commands_hash"),
  social_preview_enabled: boolean("social_preview_enabled").default(true).notNull(),
  social_preview_changed_by: text("social_preview_changed_by"),
  social_preview_changed_at: timestamp("social_preview_changed_at", { withTimezone: true }),
  joined_at: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StoredGuildRecord = typeof botGuilds.$inferSelect;