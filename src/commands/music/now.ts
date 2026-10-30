import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../utils/music.js';
import { createInfoEmbed } from '../../utils/embeds.js';

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
          title: '🎵 Now Playing',
          description: 'No track is currently playing.',
        })],
      });
      return;
    }

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

    const trackLink = nowPlaying.url ? `[${nowPlaying.track}](${nowPlaying.url})` : nowPlaying.track;

    let em = [createInfoEmbed({
      title: '🎵 Now Playing',
      description: trackLink,
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
          value: nowPlaying.progressBar,
          inline: false,
        },
      ],
    })]

    if (nowPlaying.thumbnail) {
      em[0]?.setThumbnail(nowPlaying.thumbnail);
    }

    await interaction.reply({
      embeds: em,
      components: [row],
    });
  },
};
