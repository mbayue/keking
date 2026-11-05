import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Pool } from "pg";

import { config } from "../../src/config.ts";
import { renderPrometheus, resetMetrics } from "../../src/observability/metrics.ts";
import {
  checkDatabaseConnection,
  closeDb,
  createDatabase,
  deleteAiChatMemory,
  deleteAllAiChatMemory,
  deleteGuild,
  getAiChatMemory,
  getBotTalkLimits,
  getGuildCommandHash,
  getGuildRecord,
  getPreviewReply,
  getSocialPreviewChannelState,
  getSocialPreviewDomainState,
  initializeGuildStorage,
  isAiEnabled,
  isBotTalkEnabled,
  isSocialPreviewAllowed,
  isSocialPreviewEnabled,
  pruneAiChatMemory,
  runScheduledPrune,
  saveAiChatMemory,
  savePreviewReply,
  setAiEnabled,
  setBotTalkEnabled,
  setBotTalkLimits,
  setGuildCommandHash,
  setSocialPreviewChannel,
  setSocialPreviewDomain,
  setSocialPreviewEnabled,
  updatePreviewReplyLinks,
  upsertGuild,
} from "../../src/db/postgres.ts";

const describeDb = config.databaseUrl ? describe : describe.skip;
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const guildId = `test-db-${suffix}`;
const messageId = `test-preview-${suffix}`;
let directPool: Pool | null = null;

function requireDatabaseUrl(): string {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required for database tests.");
  }
  return config.databaseUrl;
}

beforeAll(async () => {
  if (!config.databaseUrl) {
    return;
  }
  directPool = new Pool({ connectionString: config.databaseUrl });
});

afterAll(async () => {
  if (directPool) {
    await directPool.query("DELETE FROM social_preview_replies WHERE guild_id = $1", [guildId]);
    await directPool.query("DELETE FROM social_preview_channels WHERE guild_id = $1", [guildId]);
    await directPool.query("DELETE FROM social_preview_domains WHERE guild_id = $1", [guildId]);
    await directPool.query("DELETE FROM ai_chat_memories WHERE guild_id = $1", [guildId]);
    await directPool.query("DELETE FROM bot_guilds WHERE guild_id = $1", [guildId]);
    await directPool.end();
  }
  await closeDb();
});

describeDb("postgres storage", () => {
  test("creates and closes an independent database connection", async () => {
    expect(() => createDatabase("")).toThrow(
      "Missing required environment variable: DATABASE_URL",
    );

    const local = createDatabase(requireDatabaseUrl());
    expect(local.pool).toBeDefined();
    expect(local.database).toBeDefined();
    await local.pool.end();
  });

  test("counts pool errors and verifies the database connection", async () => {
    resetMetrics();
    const local = createDatabase(requireDatabaseUrl());

    local.pool.emit("error", new Error("pool failure"));
    expect(renderPrometheus()).toContain("keking_db_pool_errors_total 1");

    await checkDatabaseConnection();

    await local.pool.end();
  });

  test("initializes storage and runs scheduled prune paths", async () => {
    await initializeGuildStorage({ prune: async () => 0, schedule: (task) => task() });

    const scheduled: Array<() => void> = [];
    await initializeGuildStorage({
      prune: async () => 1,
      schedule: (task) => {
        scheduled.push(task);
      },
    });
    for (const task of scheduled) {
      task();
    }

    await initializeGuildStorage({ prune: async () => 0 });
    await runScheduledPrune(async () => 0);
    await runScheduledPrune(async () => {
      throw new Error("prune failure");
    });
  });

  test("stores guild records, hashes, and toggles", async () => {
    expect(await getGuildRecord(guildId)).toBeNull();
    expect(await getGuildCommandHash(guildId)).toBeNull();
    expect(await isAiEnabled(guildId)).toBe(true);
    expect(await isSocialPreviewEnabled(guildId)).toBe(true);
    expect(await isBotTalkEnabled(guildId)).toBe(false);

    await upsertGuild(guildId, "First");
    await upsertGuild(guildId, "Second");
    const record = await getGuildRecord(guildId);
    expect(record?.guild_name).toBe("Second");
    expect(record?.commands_hash).toBeNull();

    await setGuildCommandHash(guildId, "hash");
    expect(await getGuildCommandHash(guildId)).toBe("hash");

    await setAiEnabled(guildId, false);
    expect(await isAiEnabled(guildId)).toBe(false);
    await setAiEnabled(guildId, true);
    expect(await isAiEnabled(guildId)).toBe(true);

    await setBotTalkEnabled(guildId, true);
    expect(await isBotTalkEnabled(guildId)).toBe(true);
    await setBotTalkEnabled(guildId, false);
    expect(await isBotTalkEnabled(guildId)).toBe(false);

    expect(await getBotTalkLimits(guildId)).toEqual({ maxDepth: 20, cooldownSeconds: 60 });
    await setBotTalkLimits(guildId, { maxDepth: 35, cooldownSeconds: 90 });
    expect(await getBotTalkLimits(guildId)).toEqual({ maxDepth: 35, cooldownSeconds: 90 });
    await setBotTalkLimits(guildId, { maxDepth: 20 });
    expect(await getBotTalkLimits(guildId)).toEqual({ maxDepth: 20, cooldownSeconds: 90 });

    await setSocialPreviewEnabled(guildId, false, "user");
    expect(await isSocialPreviewEnabled(guildId)).toBe(false);
    await setSocialPreviewEnabled(guildId, true, "user");
    expect(await isSocialPreviewEnabled(guildId)).toBe(true);
  });

  test("stores and prunes AI memory", async () => {
    expect(await getAiChatMemory(guildId, "user")).toEqual([]);

    await saveAiChatMemory(guildId, "user", [{ role: "user", content: "hello" }]);
    expect(await getAiChatMemory(guildId, "user")).toHaveLength(1);

    await saveAiChatMemory(guildId, "user", [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]);
    expect(await getAiChatMemory(guildId, "user")).toHaveLength(2);

    await saveAiChatMemory(guildId, "second", [{ role: "user", content: "other" }]);
    expect(await deleteAllAiChatMemory(guildId)).toBe(2);

    await saveAiChatMemory(guildId, "delete-me", [{ role: "user", content: "bye" }]);
    await deleteAiChatMemory(guildId, "delete-me");
    expect(await getAiChatMemory(guildId, "delete-me")).toEqual([]);

    await saveAiChatMemory(guildId, "expired", [{ role: "user", content: "old" }]);
    if (!directPool) {
      throw new Error("Database pool is unavailable.");
    }
    await directPool.query(
      "UPDATE ai_chat_memories SET updated_at = NOW() - INTERVAL '31 days' WHERE guild_id = $1 AND user_id = $2",
      [guildId, "expired"],
    );
    await runScheduledPrune();
    expect(await getAiChatMemory(guildId, "expired")).toEqual([]);

    await saveAiChatMemory(guildId, "prune-one", [{ role: "user", content: "old" }]);
    await directPool.query(
      "UPDATE ai_chat_memories SET updated_at = NOW() - INTERVAL '2 days' WHERE guild_id = $1 AND user_id = $2",
      [guildId, "prune-one"],
    );
    expect(await pruneAiChatMemory(1)).toBe(1);
  });

  test("stores social scopes and evaluates allow rules", async () => {
    expect(await getSocialPreviewDomainState(guildId, "twitter")).toBeNull();
    expect(await getSocialPreviewChannelState(guildId, "channel")).toBeNull();

    await setSocialPreviewDomain(guildId, "twitter", false, "user");
    expect(await getSocialPreviewDomainState(guildId, "twitter")).toBe(false);
    await setSocialPreviewDomain(guildId, "twitter", true, "user");
    expect(await getSocialPreviewDomainState(guildId, "twitter")).toBe(true);

    await setSocialPreviewChannel(guildId, "channel", false, "user");
    expect(await getSocialPreviewChannelState(guildId, "channel")).toBe(false);
    await setSocialPreviewChannel(guildId, "channel", true, "user");
    expect(await getSocialPreviewChannelState(guildId, "channel")).toBe(true);

    await setSocialPreviewEnabled(guildId, false, "user");
    expect(await isSocialPreviewAllowed(guildId, "channel", "twitter")).toBe(false);

    await setSocialPreviewEnabled(guildId, true, "user");
    await setSocialPreviewDomain(guildId, "twitter", false, "user");
    expect(await isSocialPreviewAllowed(guildId, "channel", "twitter")).toBe(false);

    await setSocialPreviewDomain(guildId, "twitter", true, "user");
    await setSocialPreviewChannel(guildId, "channel", false, "user");
    expect(await isSocialPreviewAllowed(guildId, "channel", "twitter")).toBe(false);

    await setSocialPreviewChannel(guildId, "channel", true, "user");
    expect(await isSocialPreviewAllowed(guildId, "channel", "twitter")).toBe(true);
  });

  test("stores and updates preview replies", async () => {
    expect(await getPreviewReply(messageId)).toBeNull();

    const firstLinks = [{
      originalUrl: "https://x.com/a/status/1",
      domainId: "twitter",
      methodId: 1,
    }];
    await savePreviewReply(messageId, guildId, "channel", firstLinks);
    expect(await getPreviewReply(messageId)).toEqual({
      guildId,
      channelId: "channel",
      links: firstLinks,
    });

    const secondLinks = [{
      originalUrl: "https://x.com/a/status/1",
      domainId: "twitter",
      methodId: 2,
    }];
    await updatePreviewReplyLinks(messageId, secondLinks);
    expect((await getPreviewReply(messageId))?.links).toEqual(secondLinks);

    await savePreviewReply(messageId, guildId, "other-channel", secondLinks);
    expect((await getPreviewReply(messageId))?.channelId).toBe("other-channel");
  });

  test("deletes guild data", async () => {
    await saveAiChatMemory(guildId, "cleanup", [{ role: "user", content: "delete" }]);
    await deleteGuild(guildId);
    expect(await getGuildRecord(guildId)).toBeNull();
    expect(await getAiChatMemory(guildId, "cleanup")).toEqual([]);
  });
});
