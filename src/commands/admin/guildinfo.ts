import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type InteractionReplyOptions,
} from "discord.js";

import { config } from "../../config.js";
import { getGuildRecord } from "../../db/postgres.js";
import type { SlashCommand } from "../../structures/command.js";
import { getCurrentCommandsHash } from "../../utils/deploy-commands.js";
import { createErrorEmbed } from "../../utils/embeds.js";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("guildinfo")
    .setDescription("Shows guild and deployment info for this server.")
    .setDMPermission(false),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      const reply = {
        embeds: [createErrorEmbed("Server Only", "This command can only be used inside a server.")],
        flags: MessageFlags.Ephemeral,
      } satisfies InteractionReplyOptions;

      await interaction.reply(reply);
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const currentHash = await getCurrentCommandsHash();
      const storedGuild = config.databaseUrl ? await getGuildRecord(interaction.guild.id) : null;
      const isHashCurrent = storedGuild?.commands_hash === currentHash;

      const embed = new EmbedBuilder()
        .setTitle("Guild Info")
        .addFields(
          { name: "Guild", value: `${interaction.guild.name} (${interaction.guild.id})` },
          { name: "Members", value: interaction.guild.memberCount.toString(), inline: true },
          { name: "Database", value: config.databaseUrl ? "Connected" : "Disabled", inline: true },
          { name: "Command Hash", value: `\`${currentHash.slice(0, 12)}\``, inline: true },
          {
            name: "DB Sync",
            value: storedGuild ? (isHashCurrent ? "Up to date" : "Needs deploy") : "No DB row",
            inline: true,
          },
        );

      if (storedGuild?.updated_at) {
        embed.addFields({
          name: "Last DB Update",
          value: `<t:${Math.floor(storedGuild.updated_at.getTime() / 1000)}:F>`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Guild info failed:", error);
      await interaction.editReply({ embeds: [createErrorEmbed("Guild Info Failed", "Failed to load guild info.")] });
    }
  },
};
