import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type InteractionReplyOptions,
} from "discord.js";
import { config } from "../../config.js";
import type { SlashCommand } from "../../structures/command.js";
import { getCurrentCommandsHash } from "../../utils/deploy-commands.js";
import { createErrorEmbed } from "../../utils/embeds.js";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("guildinfo")
    .setDescription("Shows guild and deployment info for this server.")
    .setContexts(InteractionContextType.Guild),
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

      const embed = new EmbedBuilder()
        .setTitle("Guild Info")
        .addFields(
          { name: "Guild", value: `${interaction.guild.name} (${interaction.guild.id})` },
          { name: "Members", value: interaction.guild.memberCount.toString(), inline: true },
          { name: "Database", value: config.databaseUrl ? "Connected" : "Disabled", inline: true },
          { name: "Command Hash", value: `\`${currentHash.slice(0, 12)}\``, inline: true },
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Guild info failed:", error);
      await interaction.editReply({ embeds: [createErrorEmbed("Guild Info Failed", "Failed to load guild info.")] });
    }
  },
};
