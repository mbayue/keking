import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../utils/music.js';
import { createInfoEmbed, createErrorEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the loop mode for music playback')
    .addStringOption(option =>
      option
        .setName('mode')
        .setDescription('Loop mode to set')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' },
          { name: 'Autoplay', value: 'autoplay' },
        )),
  async execute(interaction) {
    const mode = interaction.options.getString('mode', true) as 'off' | 'track' | 'queue' | 'autoplay';
    const player = getPlayer(interaction.guildId!);

    const result = player.setLoopMode(mode);

    if (result.includes('No queue available')) {
      await interaction.reply({
        embeds: [createErrorEmbed('No Queue', result)],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [createInfoEmbed({
        title: 'Loop Mode Updated',
        description: result,
      })],
    });
  },
};