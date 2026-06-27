import { Events, type Client } from "discord.js";

import { config } from "../config.js";
import type { BotEvent } from "../structures/event.js";
import { deployCommands, formatDeployReport } from "../utils/deploy-commands.js";
import { upsertGuild } from "../db/postgres.js";

export const event: BotEvent = {
  name: Events.ClientReady,
  once: true,
  async execute(...args) {
    const [client] = args as [Client<true>];
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Client is in ${client.guilds.cache.size} guild(s).`);

    // Auto-deploy commands on startup (production: global, development: guild-only)
    const isProduction = !config.guildId;
    if (isProduction) {
      console.log("Production mode: deploying commands globally...");
      const result = await deployCommands({ guildId: null });
      console.log(formatDeployReport(result, null));
    }

     if (!isProduction) {
      console.log(`Development mode: deploying commands for guild ${config.guildId}...`);
      const result = await deployCommands({ guildId: config.guildId });
      const constResult = formatDeployReport(result, config.guildId);
      console.log(constResult);
    }

    if (config.databaseUrl) {
      console.log("Syncing guilds to database...");
      for (const guild of client.guilds.cache.values()) {
        try {
          await upsertGuild(guild.id, guild.name);
          console.log(`Synced guild: ${guild.name} (${guild.id})`);
        } catch (error) {
          console.error(`Failed to sync guild ${guild.name}:`, error);
        }
      }
    } else {
      console.warn("DATABASE_URL is not set. Guild persistence is disabled.");
    }
  },
};