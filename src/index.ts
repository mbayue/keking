import { ActivityType, Client, GatewayIntentBits, PresenceUpdateStatus } from "discord.js";
import { config } from "./config.js";
import { closeDb, initializeGuildStorage } from "./db/postgres.js";
import { loadCommands } from "./loaders/commands.js";
import { loadEvents } from "./loaders/events.js";
import type { BotClient } from "./types/client.js";
import { initializePlayer } from "./utils/music.js";

const client = new Client({
  presence: {
    activities: [
      {
        name: "Youtube",
        type: ActivityType.Watching,
      }
    ],
    status: PresenceUpdateStatus.Online,
  },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
}) as BotClient;

client.musicPlayer = await initializePlayer(client);

client.commands = new Map((await loadCommands()).entries());

if (config.databaseUrl) {
  await initializeGuildStorage();
}

await loadEvents(client);

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  try {
    client.destroy();
    await closeDb();
  } finally {
    process.exit(0);
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

await client.login(config.token);
