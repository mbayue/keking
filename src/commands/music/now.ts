import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../utils/music.js';
import { createInfoEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('now')
    .setDescription('Show currently playing track with queue info'),
  async execute(interaction) {
    const player = getPlayer(interaction.guildId!);
    const nowPlaying = player.getNowPlayingDetails();

    if (!nowPlaying) {
      await interaction.reply({
        embeds: [createInfoEmbed({
          title: 'Now Playing',
          description: 'No track is currently playing.',
        })],
      });
      return;
    }

    await interaction.reply({
      embeds: [createInfoEmbed({
        title: '🎵 Now Playing',
        description: nowPlaying.track,
        fields: [
          {
            name: 'Duration',
            value: nowPlaying.duration,
            inline: true,
          },
          {
            name: 'Queue Size',
            value: `${nowPlaying.queueSize} tracks`,
            inline: true,
          },
        ],
      })],
    });
  },
};
