import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { and, eq, lt } from 'drizzle-orm';
import * as schema from './schema.js';
import { aiChatMemories, botGuilds, socialPreviewChannels, socialPreviewDomains, socialPreviewReplies, type StoredChatTurn, type StoredGuildRecord, type StoredPreviewLink } from './schema.js';
import { config } from '../config.js';

export function createDatabase(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const database: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
  return { pool, database };
}

const { pool, database: db } = createDatabase(config.databaseUrl ?? "");

const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

type InitializeGuildStorageOptions = {
  prune?: typeof pruneAiChatMemory;
  schedule?: (task: () => void) => void;
};

export async function runScheduledPrune(
  prune: typeof pruneAiChatMemory = pruneAiChatMemory,
): Promise<void> {
  try {
    await prune(config.aiMemoryRetentionDays);
  } catch (error) {
    console.error('[ai] failed to prune expired memory:', error);
  }
}

export async function initializeGuildStorage(
  options: InitializeGuildStorageOptions = {},
): Promise<void> {
  await migrate(db, { migrationsFolder: 'drizzle' });

  const prune = options.prune ?? pruneAiChatMemory;
  const pruned = await prune(config.aiMemoryRetentionDays);
  if (pruned > 0) {
    console.log(`[ai] pruned ${pruned} expired memory row(s).`);
  }

  const schedule = options.schedule ?? ((task) => {
    setInterval(task, PRUNE_INTERVAL_MS).unref();
  });
  schedule(() => {
    void runScheduledPrune(prune);
  });
}
export async function upsertGuild(guildId: string, guildName: string): Promise<void> {
  await db
    .insert(botGuilds)
    .values({ guild_id: guildId, guild_name: guildName })
    .onConflictDoUpdate({
      target: botGuilds.guild_id,
      set: { guild_name: guildName, updated_at: new Date() },
    });
}
export async function getGuildCommandHash(guildId: string): Promise<string | null> {
  const rows = await db
    .select({ commands_hash: botGuilds.commands_hash })
    .from(botGuilds)
    .where(eq(botGuilds.guild_id, guildId))
    .limit(1);
  return rows[0]?.commands_hash ?? null;
}
export async function getGuildRecord(guildId: string): Promise<StoredGuildRecord | null> {
  const rows = await db
    .select()
    .from(botGuilds)
    .where(eq(botGuilds.guild_id, guildId))
    .limit(1);
  return rows[0] ?? null;
}
export async function setGuildCommandHash(guildId: string, commandsHash: string): Promise<void> {
  await db
    .update(botGuilds)
    .set({ commands_hash: commandsHash, updated_at: new Date() })
    .where(eq(botGuilds.guild_id, guildId));
}
export async function isAiEnabled(guildId: string): Promise<boolean> {
  const rows = await db
    .select({ ai_enabled: botGuilds.ai_enabled })
    .from(botGuilds)
    .where(eq(botGuilds.guild_id, guildId))
    .limit(1);
  return rows[0]?.ai_enabled ?? true;
}
export async function setAiEnabled(guildId: string, enabled: boolean): Promise<void> {
  await db
    .update(botGuilds)
    .set({ ai_enabled: enabled, updated_at: new Date() })
    .where(eq(botGuilds.guild_id, guildId));
}
export async function isSocialPreviewEnabled(guildId: string): Promise<boolean> {
  const rows = await db
    .select({ social_preview_enabled: botGuilds.social_preview_enabled })
    .from(botGuilds)
    .where(eq(botGuilds.guild_id, guildId))
    .limit(1);
  return rows[0]?.social_preview_enabled ?? true;
}
export async function setSocialPreviewEnabled(
  guildId: string,
  enabled: boolean,
  changedBy: string
): Promise<void> {
  await db
    .update(botGuilds)
    .set({
      social_preview_enabled: enabled,
      social_preview_changed_by: changedBy,
      social_preview_changed_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(botGuilds.guild_id, guildId));
}
export async function deleteGuild(guildId: string): Promise<void> {
  await db.delete(aiChatMemories).where(eq(aiChatMemories.guild_id, guildId));
  await db.delete(botGuilds).where(eq(botGuilds.guild_id, guildId));
}
export async function closeDb(): Promise<void> {
  await pool.end();
}
export type { StoredChatTurn, StoredGuildRecord, StoredPreviewLink } from './schema.js';

export async function getAiChatMemory(guildId: string, userId: string): Promise<StoredChatTurn[]> {
  const rows = await db
    .select({ turns: aiChatMemories.turns })
    .from(aiChatMemories)
    .where(and(eq(aiChatMemories.guild_id, guildId), eq(aiChatMemories.user_id, userId)))
    .limit(1);
  return rows[0]?.turns ?? [];
}
export async function saveAiChatMemory(
  guildId: string,
  userId: string,
  turns: StoredChatTurn[],
): Promise<void> {
  await db
    .insert(aiChatMemories)
    .values({ guild_id: guildId, user_id: userId, turns })
    .onConflictDoUpdate({
      target: [aiChatMemories.guild_id, aiChatMemories.user_id],
      set: { turns, updated_at: new Date() },
    });
}
export async function deleteAiChatMemory(guildId: string, userId: string): Promise<void> {
  await db
    .delete(aiChatMemories)
    .where(and(eq(aiChatMemories.guild_id, guildId), eq(aiChatMemories.user_id, userId)));
}
export async function deleteAllAiChatMemory(guildId: string): Promise<number> {
  const result = await db
    .delete(aiChatMemories)
    .where(eq(aiChatMemories.guild_id, guildId));
  return result.rowCount ?? 0;
}
export async function pruneAiChatMemory(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(aiChatMemories)
    .where(lt(aiChatMemories.updated_at, cutoff));
  return result.rowCount ?? 0;
}

export interface StoredPreviewReply {
  guildId: string;
  channelId: string;
  links: StoredPreviewLink[];
}

export async function getSocialPreviewDomainState(guildId: string, domain: string): Promise<boolean | null> {
  const rows = await db
    .select({ enabled: socialPreviewDomains.enabled })
    .from(socialPreviewDomains)
    .where(and(eq(socialPreviewDomains.guild_id, guildId), eq(socialPreviewDomains.domain, domain)))
    .limit(1);
  return rows[0]?.enabled ?? null;
}
export async function setSocialPreviewDomain(
  guildId: string,
  domain: string,
  enabled: boolean,
  changedBy: string
): Promise<void> {
  await db
    .insert(socialPreviewDomains)
    .values({ guild_id: guildId, domain, enabled, changed_by: changedBy })
    .onConflictDoUpdate({
      target: [socialPreviewDomains.guild_id, socialPreviewDomains.domain],
      set: { enabled, changed_by: changedBy, updated_at: new Date() },
    });
}
export async function getSocialPreviewChannelState(guildId: string, channelId: string): Promise<boolean | null> {
  const rows = await db
    .select({ enabled: socialPreviewChannels.enabled })
    .from(socialPreviewChannels)
    .where(and(eq(socialPreviewChannels.guild_id, guildId), eq(socialPreviewChannels.channel_id, channelId)))
    .limit(1);
  return rows[0]?.enabled ?? null;
}
export async function setSocialPreviewChannel(
  guildId: string,
  channelId: string,
  enabled: boolean,
  changedBy: string
): Promise<void> {
  await db
    .insert(socialPreviewChannels)
    .values({ guild_id: guildId, channel_id: channelId, enabled, changed_by: changedBy })
    .onConflictDoUpdate({
      target: [socialPreviewChannels.guild_id, socialPreviewChannels.channel_id],
      set: { enabled, changed_by: changedBy, updated_at: new Date() },
    });
}
export async function isSocialPreviewAllowed(
  guildId: string,
  channelId: string,
  domain: string
): Promise<boolean> {
  const [master, domainState, channelState] = await Promise.all([
    isSocialPreviewEnabled(guildId),
    getSocialPreviewDomainState(guildId, domain),
    getSocialPreviewChannelState(guildId, channelId),
  ]);
  return master && domainState !== false && channelState !== false;
}
export async function savePreviewReply(
  messageId: string,
  guildId: string,
  channelId: string,
  links: StoredPreviewLink[]
): Promise<void> {
  await db
    .insert(socialPreviewReplies)
    .values({ message_id: messageId, guild_id: guildId, channel_id: channelId, links })
    .onConflictDoUpdate({
      target: socialPreviewReplies.message_id,
      set: { guild_id: guildId, channel_id: channelId, links },
    });
}
export async function getPreviewReply(messageId: string): Promise<StoredPreviewReply | null> {
  const rows = await db
    .select()
    .from(socialPreviewReplies)
    .where(eq(socialPreviewReplies.message_id, messageId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { guildId: row.guild_id, channelId: row.channel_id, links: row.links };
}
export async function updatePreviewReplyLinks(messageId: string, links: StoredPreviewLink[]): Promise<void> {
  await db
    .update(socialPreviewReplies)
    .set({ links })
    .where(eq(socialPreviewReplies.message_id, messageId));
}