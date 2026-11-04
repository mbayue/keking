import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../music/player.js';
import { createInfoEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
  requiresMusic: true,
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and clear the queue'),
  async execute(interaction) {
    const player = getPlayer(interaction.guildId!);
    const result = player.stop();

    await interaction.reply({
      embeds: [createInfoEmbed({
        title: '🎵 Playback Stopped',
        description: result,
      })],
    });
  },
};
