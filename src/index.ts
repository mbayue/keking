import { ActivityType, Client, GatewayIntentBits, Partials, PresenceUpdateStatus } from "discord.js";
import { config } from "./config.js";
import { checkDatabaseConnection, closeDb, initializeGuildStorage } from "./db/postgres.js";
import {
  type HealthServerHandle,
  startHealthServer,
} from "./observability/health.js";
import { logger } from "./observability/logger.js";
import { loadCommands } from "./loaders/commands.js";
import { loadEvents } from "./loaders/events.js";
import type { BotClient } from "./types/client.js";
import { initializePlayer } from "./music/player.js";

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
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
}) as BotClient;

client.musicPlayer = await initializePlayer(client);

client.commands = new Map((await loadCommands()).entries());

if (config.databaseUrl) {
  await initializeGuildStorage();
}

await loadEvents(client);
const healthServer: HealthServerHandle | null = startHealthServer({
  healthEnabled: config.healthEnabled,
  healthHost: config.healthHost,
  healthPort: config.healthPort,
}, {
  startedAt: Date.now(),
  isDiscordReady: () => client.isReady(),
  checkDatabase: checkDatabaseConnection,
  collectQueueMetrics: () => {
    const queues = [...client.musicPlayer.nodes.cache.values()];
    return {
      queues: queues.length,
      tracks: queues.reduce((total, queue) => total + queue.tracks.size, 0),
      playing: queues.filter((queue) => queue.isPlaying()).length,
    };
  },
  metricsToken: config.metricsToken,
});

if (healthServer) {
  logger.info("health_server_started", {
    host: config.healthHost,
    port: config.healthPort,
  });
}


async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  try {
    await client.destroy();
    await healthServer?.stop();
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
