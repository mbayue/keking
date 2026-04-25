import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../utils/music.js';
import { createInfoEmbed, createErrorEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('now')
    .setDescription('Show currently playing track with enhanced details and controls'),
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

    // Create progress bar
    const progressBar = createProgressBar(nowPlaying);

    // Create control buttons
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('music_pause_resume')
          .setLabel('⏸️/▶️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('music_skip')
          .setLabel('⏭️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('music_stop')
          .setLabel('⏹️')
          .setStyle(ButtonStyle.Danger),
      );

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
          {
            name: 'Progress',
            value: progressBar,
            inline: false,
          },
        ],
      })],
      components: [row],
    });
  },
};

function createProgressBar(nowPlaying: { track: string; duration: string; queueSize: number }): string {
  // For now, create a simple progress bar since we don't have current position
  // In a real implementation, you'd need to track current playback position
  const barLength = 20;
  const filled = Math.floor(Math.random() * barLength); // Placeholder - replace with actual progress
  const empty = barLength - filled;

  const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
  return `\`${progressBar}\``;
}
