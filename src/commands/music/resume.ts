import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../utils/music.js';
import { createInfoEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the paused music'),
  async execute(interaction) {
    const player = getPlayer(interaction.guildId!);
    const result = player.resume();

    await interaction.reply({
      embeds: [createInfoEmbed({
        title: 'Music Resumed',
        description: result,
      })],
    });
  },
};
