import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../utils/music.js';
import { createErrorEmbed, createInfoEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for a track and select one to play')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Song name or artist to search for')
        .setRequired(true)
    ),
  async execute(interaction) {
    const query = interaction.options.getString('query')!;
    const member = await interaction.guild?.members.fetch(interaction.user.id);

    if (!member?.voice.channel) {
      await interaction.reply({
        embeds: [createErrorEmbed('Voice Channel Required', 'You must be in a voice channel to play music.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const player = getPlayer(interaction.guildId!);

    // Join the channel if not already joined
    const joined = await player.joinChannel(member);
    if (!joined) {
      await interaction.reply({
        embeds: [createErrorEmbed('Failed to Join', 'Could not join the voice channel.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const results = await player.search(query);

    if (results.length === 0) {
      await interaction.editReply({
        embeds: [createInfoEmbed({
          title: 'Search Results',
          description: 'No tracks found for your search.',
        })],
      });
      return;
    }

    const description = results
      .map((track, index) => `**${index + 1}.** ${track.title} by ${track.author}`)
      .join('\n');

    const buttons = results.map((_, index) =>
      new ButtonBuilder()
        .setCustomId(`search_select_${index}`)
        .setLabel(`${index + 1}`)
        .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(buttons);

    const reply = await interaction.editReply({
      embeds: [createInfoEmbed({
        title: 'Search Results',
        description: description,
      })],
      components: [row],
    });

    const collector = reply.createMessageComponentCollector({
      time: 30_000,
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: 'You did not initiate this search.',
          ephemeral: true,
        });
        return;
      }

      const indexStr = buttonInteraction.customId.split('_')[2];
      const selectedIndex = indexStr ? parseInt(indexStr) : -1;

      if (selectedIndex < 0 || selectedIndex >= results.length) {
        await buttonInteraction.deferUpdate();
        return;
      }

      const selected = results[selectedIndex];
      if (!selected) {
        await buttonInteraction.deferUpdate();
        return;
      }

      await buttonInteraction.deferUpdate();
      const result = await player.playTrack(selected);

      let reply = ''
      if (result.includes('Now playing:')) {
        reply = 'Now playing:';
      } else {
        reply = 'Added to queue:';
      }

      await interaction.editReply({
        embeds: [createInfoEmbed({
          title: reply,
          description: result,
        })],
        components: [],
      });

      collector.stop();
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        await interaction.editReply({
          components: [],
        });
      }
    });
  },
};
