import { REST, Routes } from "discord.js";
import { Pool } from "pg";

import { config } from "../src/config.js";

const EXPECTED_COMMANDS = [
  "ai",
  "botstats",
  "forget",
  "guildinfo",
  "help",
  "join",
  "leave",
  "pia",
  "ping",
  "server",
  "social-preview",
  "tts",
];

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required for the smoke test.");
}

const pool = new Pool({ connectionString: config.databaseUrl });
const rest = new REST({ version: "10" }).setToken(config.token);

try {
  const memoryTable = await pool.query(
    "SELECT to_regclass('public.ai_chat_memories') AS table_name",
  );
  const aiColumn = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_guilds' AND column_name = 'ai_enabled'",
  );
  const guildCount = await pool.query("SELECT count(*)::int AS count FROM bot_guilds");

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);
  const commandResponse: unknown = await rest.get(route);
  const commandNames = Array.isArray(commandResponse)
    ? commandResponse
        .flatMap((entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "name" in entry &&
          typeof entry.name === "string"
            ? [entry.name]
            : [],
        )
        .sort()
    : [];
  const missingCommands = EXPECTED_COMMANDS.filter((name) => !commandNames.includes(name));

  const result = {
    database: {
      memoryTable: Boolean(memoryTable.rows[0]?.table_name),
      aiEnabledColumn: aiColumn.rowCount === 1,
      guilds: Number(guildCount.rows[0]?.count ?? 0),
    },
    commands: {
      target: config.guildId ? `guild:${config.guildId}` : "global",
      count: commandNames.length,
      missing: missingCommands,
    },
    ai: {
      configured: config.aiApiKey.length > 0,
      model: config.aiModel,
      memoryRetentionDays: config.aiMemoryRetentionDays,
      enabledByGuildFlag: true,
    },
    tts: {
      elevenLabsEnabled: config.elevenLabsEnabled,
    },
  };

  console.log(JSON.stringify(result, null, 2));

  if (
    !result.database.memoryTable ||
    !result.database.aiEnabledColumn ||
    missingCommands.length > 0 ||
    !result.ai.configured
  ) {
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
