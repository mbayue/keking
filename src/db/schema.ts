import { jsonb, pgTable, primaryKey, text, timestamp, boolean } from "drizzle-orm/pg-core";

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

export const socialPreviewDomains = pgTable("social_preview_domains", {
  guild_id: text("guild_id").notNull(),
  domain: text("domain").notNull(),
  enabled: boolean("enabled").notNull(),
  changed_by: text("changed_by"),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.guild_id, table.domain] })]);

export const socialPreviewChannels = pgTable("social_preview_channels", {
  guild_id: text("guild_id").notNull(),
  channel_id: text("channel_id").notNull(),
  enabled: boolean("enabled").notNull(),
  changed_by: text("changed_by"),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.guild_id, table.channel_id] })]);

export interface StoredPreviewLink {
  originalUrl: string;
  domainId: string;
  methodId: number;
}

export const socialPreviewReplies = pgTable("social_preview_replies", {
  message_id: text("message_id").primaryKey(),
  guild_id: text("guild_id").notNull(),
  channel_id: text("channel_id").notNull(),
  links: jsonb("links").$type<StoredPreviewLink[]>().notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});