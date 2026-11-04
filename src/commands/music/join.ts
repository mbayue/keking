import { MessageFlags, SlashCommandBuilder } from "discord.js";

import type { SlashCommand } from "../../structures/command.js";
import { createErrorEmbed, createInfoEmbed } from "../../utils/embeds.js";
import { getPlayer } from "../../music/player.js";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("Join your current voice channel and stay connected"),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [createErrorEmbed("Server Only", "This command can only be used inside a server.")],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const player = getPlayer(interaction.guild.id);
    player.setTextChannel(interaction.channelId);

    const result = await player.joinVoice(interaction.member);
    if (result.startsWith("Join a voice channel")) {
      await interaction.reply({
        embeds: [createErrorEmbed("Voice Channel Required", result)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [createInfoEmbed({
        title: "🔊 Joined Voice",
        description: result,
      })],
    });
  },
};
