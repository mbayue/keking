import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../utils/music.js';
import { createInfoEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear all tracks from the queue'),
  async execute(interaction) {
    const player = getPlayer(interaction.guildId!);
    const result = player.clearQueue();

    await interaction.reply({
      embeds: [createInfoEmbed({
        title: 'Queue Cleared',
        description: result,
      })],
    });
  },
};
