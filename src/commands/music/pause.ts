import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../utils/music.js';
import { createInfoEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current music'),
  async execute(interaction) {
    const player = getPlayer(interaction.guildId!);
    const result = player.pause();

    await interaction.reply({
      embeds: [createInfoEmbed({
        title: 'Music Paused',
        description: result,
      })],
    });
  },
};
