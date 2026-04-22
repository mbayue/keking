import { MessageFlags, SlashCommandBuilder, type InteractionReplyOptions } from "discord.js";

import type { SlashCommand } from "../../structures/command.js";
import { createErrorEmbed, createInfoEmbed } from "../../utils/embeds.js";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("Shows basic information about the current server."),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      const reply = {
        embeds: [createErrorEmbed("Server Only", "This command can only be used inside a server.")],
        flags: MessageFlags.Ephemeral,
      } satisfies InteractionReplyOptions;

      await interaction.reply(reply);
      return;
    }

    const { guild } = interaction;
    const embed = createInfoEmbed({
      title: "Server Info",
      fields: [
        { name: "Name", value: guild.name, inline: true },
        { name: "Members", value: guild.memberCount.toString(), inline: true },
        { name: "Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>` },
      ],
    });

    await interaction.reply({
      embeds: [embed],
    });
  },
};
