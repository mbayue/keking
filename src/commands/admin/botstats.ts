import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type InteractionReplyOptions,
} from "discord.js";

import { config } from "../../config.js";
import { getStoredGuildCount } from "../../db/postgres.js";
import type { SlashCommand } from "../../structures/command.js";
import { createErrorEmbed } from "../../utils/embeds.js";

function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return [days ? `${days}d` : null, hours ? `${hours}h` : null, minutes ? `${minutes}m` : null, `${seconds}s`]
    .filter(Boolean)
    .join(" ");
}

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("botstats")
    .setDescription("Shows bot health and database stats."),
  async execute(interaction) {
    const reply = {
      flags: MessageFlags.Ephemeral,
    } satisfies InteractionReplyOptions;

    await interaction.deferReply(reply);

    try {
      const uptimeMs = interaction.client.uptime ?? 0;
      const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
      const storedGuildCount = config.databaseUrl ? await getStoredGuildCount() : 0;

      const embed = new EmbedBuilder()
        .setTitle("Bot Stats")
        .addFields(
          { name: "Uptime", value: formatUptime(Math.floor(uptimeMs / 1000)), inline: true },
          { name: "Guilds", value: interaction.client.guilds.cache.size.toString(), inline: true },
          { name: "Ping", value: `${Math.round(interaction.client.ws.ping)} ms`, inline: true },
          { name: "Memory", value: `${rssMb} MB RSS`, inline: true },
          { name: "Database", value: config.databaseUrl ? "Connected" : "Disabled", inline: true },
          { name: "Stored Guild Rows", value: storedGuildCount.toString(), inline: true },
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Bot stats failed:", error);
      await interaction.editReply({ embeds: [createErrorEmbed("Bot Stats Failed", "Failed to load bot stats.")] });
    }
  },
};
