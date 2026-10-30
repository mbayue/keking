import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../structures/command.js';
import { getPlayer } from '../../utils/music.js';
import { createInfoEmbed, createErrorEmbed } from '../../utils/embeds.js';

export const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Get lyrics for the currently playing track or search for specific lyrics')
        .addStringOption(option =>
            option
                .setName('song')
                .setDescription('Song title to search for (optional - uses current track if not provided)')
        )
        .addStringOption(option =>
            option
                .setName('artist')
                .setDescription('Artist name (optional - uses current track if not provided)')
        ),
    async execute(interaction) {
        const player = getPlayer(interaction.guildId!);
        const song = interaction.options.getString('song');
        const artist = interaction.options.getString('artist');

        await interaction.deferReply();

        const lyrics = await player.getLyrics(song || undefined, artist || undefined);

        if (!lyrics) {
            await interaction.editReply({
                embeds: [createErrorEmbed('Lyrics Not Found', 'Could not find lyrics for this track.')],
            });
            return;
        }

        const maxLength = 4000;
        const lyricsText = lyrics.lyrics;

        if (lyricsText.length <= maxLength) {
            await interaction.editReply({
                embeds: [createInfoEmbed({
                    title: `🎵 Lyrics: ${lyrics.title}`,
                    description: `**Artist:** ${lyrics.artist}\n\n${lyricsText}`,
                })],
            });
        } else {
            const chunks = [];
            for (let i = 0; i < lyricsText.length; i += maxLength) {
                chunks.push(lyricsText.slice(i, i + maxLength));
            }

            await interaction.editReply({
                embeds: [createInfoEmbed({
                    title: `🎵 Lyrics: ${lyrics.title}`,
                    description: `**Artist:** ${lyrics.artist}\n\n${chunks[0]}`,
                })],
            });

            const followUps = chunks.slice(1).map((chunk, index) =>
                interaction.followUp({
                    embeds: [createInfoEmbed({
                        title: `🎵 Lyrics (Part ${index + 2})`,
                        description: chunk || 'No content',
                    })],
                }),
            );
            await Promise.all(followUps);
        }
    },
};