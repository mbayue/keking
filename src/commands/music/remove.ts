import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../music/player.js';
import { createInfoEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
  requiresMusic: true,
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue')
    .addIntegerOption(option =>
      option
        .setName('index')
        .setDescription('Position of the track to remove (starting from 1)')
        .setRequired(true)
    ),
  async execute(interaction) {
    const index = interaction.options.getInteger('index')! - 1;
    const player = getPlayer(interaction.guildId!);
    const result = player.removeTrack(index);

    await interaction.reply({
      embeds: [createInfoEmbed({
        title: '🎵 Track Removed',
        description: result,
      })],
    });
  },
};
