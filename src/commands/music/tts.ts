import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../utils/music.js';
import { createInfoEmbed, createErrorEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('tts')
        .setDescription('Convert text to speech and play it in voice channel')
        .addStringOption((option) =>
            option
                .setName('text')
                .setDescription('Text to convert to speech')
                .setRequired(true),
        ),
    async execute(interaction) {
        const text = interaction.options.getString('text', true);

        if (!interaction.guildId) {
            await interaction.reply({
                embeds: [createErrorEmbed('Error', 'This command can only be used in a guild.')],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const member = await interaction.guild?.members.fetch(interaction.user.id);
        if (!member?.voice.channel) {
            await interaction.reply({
                embeds: [createErrorEmbed('Error', 'You must be in a voice channel to use this command.')],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        try {
            const player = getPlayer(interaction.guildId);
            player.setTextChannel(interaction.channelId);
            const joined = await player.joinChannel(member);
            if (!joined) {
                await interaction.reply({
                    embeds: [createErrorEmbed('Failed to Join', 'Could not join the voice channel.')],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const result = await player.playTTS(text);
            await interaction.reply({
                embeds: [createInfoEmbed({
                    title: 'TTS',
                    description: result,
                })],
            });
        } catch (error) {
            console.error('Error in TTS command:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('Error', 'Failed to play TTS.')],
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
