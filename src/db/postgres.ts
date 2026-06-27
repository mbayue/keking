import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.js';
import { botGuilds, type StoredGuildRecord } from './schema.js';
import { config } from '../config.js';

if (!config.databaseUrl) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

const pool = new Pool({ connectionString: config.databaseUrl });
const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

export async function initializeGuildStorage(): Promise<void> {
  await migrate(db, { migrationsFolder: 'drizzle' });
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
  await db.delete(botGuilds).where(eq(botGuilds.guild_id, guildId));
}
export async function closeDb(): Promise<void> {
  await pool.end();
}
export type { StoredGuildRecord } from './schema.js';