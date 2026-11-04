import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../music/player.js';
import { createErrorEmbed, createInfoEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the voice channel'),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [createErrorEmbed('Server Only', 'This command can only be used inside a server.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const player = getPlayer(interaction.guild.id);
    const result = player.disconnect();

    if (result.startsWith('Not connected')) {
      await interaction.reply({
        embeds: [createErrorEmbed('Not Connected', result)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [createInfoEmbed({
        title: '🔊 Left Voice Channel',
        description: result,
      })],
    });
  },
};
