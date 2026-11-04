import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../music/player.js';
import { createInfoEmbed, createErrorEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
  requiresMusic: true,
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the current music queue'),
  async execute(interaction) {
    const player = getPlayer(interaction.guildId!);
    const result = player.shuffle();

    if (result.includes('Need at least 2 tracks')) {
      await interaction.reply({
        embeds: [createErrorEmbed('Cannot Shuffle', result)],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [createInfoEmbed({
        title: '🎵 Queue Shuffled',
        description: result,
      })],
    });
  },
};