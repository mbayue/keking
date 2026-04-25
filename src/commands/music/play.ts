import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../utils/music.js';
import { createErrorEmbed, createInfoEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play music from YouTube or Spotify')
    .addStringOption((option) =>
      option
        .setName('url')
        .setDescription('YouTube or Spotify URL to play')
        .setRequired(true),
    ),
  async execute(interaction) {
    const url = interaction.options.getString('url', true).trim();
    const member = interaction.member as any;

    if (!member.voice.channel) {
      await interaction.reply({
        embeds: [createErrorEmbed('Voice Channel Required', 'You must be in a voice channel to play music.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const player = getPlayer(interaction.guildId!);
    player.setTextChannel(interaction.channelId);

    const joined = await player.joinChannel(member);
    if (!joined) {
      await interaction.reply({
        embeds: [createErrorEmbed('Failed to Join', 'Could not join the voice channel.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const result = await player.play(url);
    let title = 'Added to Queue';


    if (player.getQueue().length === 0) {
      title = 'Started Playing';
    }

    await interaction.editReply({
      embeds: [createInfoEmbed({
        title: title,
        description: result,
      })],
    });
  },
};
