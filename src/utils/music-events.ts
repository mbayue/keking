import { Client } from "discord.js";
import { Player, GuildQueueEvent, QueueRepeatMode } from "discord-player";
import { createInfoEmbed } from "./embeds.js";
import { config } from "../config.js";

export function registerMusicEvents(player: Player, client: Client): void {
    console.log("core || ", player.scanDeps());
    console.log("[music] events registered (shell-track guard active)");

    player.events.on(GuildQueueEvent.PlayerStart, async (queue, track) => {
        const metadata = queue.metadata as Record<string, unknown> | null;
        const channelId = metadata?.textChannelId as string | undefined;
        if (!channelId) return;

        if (queue.size === 0) {
            return;
        }

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel || !('isTextBased' in channel) || !channel.isTextBased() || !('send' in channel)) return;
            if (track.title === 'TTS') return

            if (!track.url?.trim() || !track.title?.trim()) {
                const details = track as unknown as Record<string, unknown>;
                console.error(`[music] unresolvable track started playback: ${JSON.stringify({ title: track.title, author: track.author, url: track.url, duration: track.duration, query: details.query ?? null, extractor: details.extractor ?? null, requestedBy: details.requestedBy ?? null })}`);
                await channel.send({
                    embeds: [createInfoEmbed({
                        title: '🎵 Could Not Play',
                        description: 'The search resolved but produced no playable audio. Try a full YouTube watch URL or a different title.',
                    })],
                }).catch((sendError: unknown) => console.error('[music] failed to announce unplayable track:', sendError));
                queue.node.skip();
                return;
            }

            const trackLabel = track.url ? `[${track.title} by ${track.author}](${track.url})` : `${track.title} by ${track.author}`;
            const em = [createInfoEmbed({
                title: '🎵 Started Playing',
                description: trackLabel,
            })];

            if (track.thumbnail) {
                em[0]?.setThumbnail(track.thumbnail);
            }

            await channel.send({
                embeds: em,
            });
        } catch (error) {
            console.error('[music] failed to announce playback:', error);
        }
    });

    player.events.on(GuildQueueEvent.EmptyQueue, async (queue) => {
        const metadata = queue.metadata as Record<string, unknown> | null;
        const channelId = metadata?.textChannelId as string | undefined;
        if (!channelId) return;

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel || !('isTextBased' in channel) || !channel.isTextBased() || !('send' in channel)) return;

            await channel.send({
                embeds: [createInfoEmbed({
                    title: '🎵 Queue Ended',
                    description: 'The music queue has ended.',
                })],
            });
        } catch (error) {
            console.error('[music] failed to announce queue end:', error);
        }
    });

    player.events.on(GuildQueueEvent.Disconnect, async (queue) => {
        const metadata = queue.metadata as Record<string, unknown> | null;
        const channelId = metadata?.textChannelId as string | undefined;
        if (!channelId) return;

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel || !('isTextBased' in channel) || !channel.isTextBased() || !('send' in channel)) return;

            await channel.send({
                embeds: [createInfoEmbed({
                    title: '🎵 Disconnected',
                    description: 'Looks like my job here is done, leaving now!',
                })],
            });
        } catch (error) {
            console.error('[music] failed to announce disconnection:', error);
        }
    });

    player.events.on(GuildQueueEvent.EmptyChannel, async (queue) => {
        const metadata = queue.metadata as Record<string, unknown> | null;
        const channelId = metadata?.textChannelId as string | undefined;
        if (!channelId) return;

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel || !('isTextBased' in channel) || !channel.isTextBased() || !('send' in channel)) return;

            await channel.send({
                embeds: [createInfoEmbed({
                    title: '🎵 Voice Channel Empty',
                    description: 'Everyone left the voice channel, leaving now!',
                })],
            });
        } catch (error) {
            console.error('[music] failed to announce empty channel:', error);
        }
    });

    player.events.on(GuildQueueEvent.PlayerError, async (queue, error) => {
        const metadata = queue.metadata as Record<string, unknown> | null;
        const channelId = metadata?.textChannelId as string | undefined;
        if (!channelId) return;

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel || !('isTextBased' in channel) || !channel.isTextBased() || !('send' in channel)) return;

            await channel.send({
                embeds: [createInfoEmbed({
                    title: '🎵 Playback Error',
                    description: `An error occurred during playback: ${error.message}`,
                })],
            });

            if (
                queue.repeatMode === QueueRepeatMode.AUTOPLAY &&
                error.message?.includes('Could not extract stream')
            ) {
                const failedTrack = queue.currentTrack;
                const failedTitle = failedTrack ? `${failedTrack.title} by ${failedTrack.author}` : 'Unknown track';
                queue.node.skip();
                await channel.send({
                    embeds: [createInfoEmbed({
                        title: '🎵 Skipped Unplayable Autoplay Track',
                        description: `Skipped a track that could not be streamed: ${failedTitle}`,
                    })],
                });
            }
        } catch (error) {
            console.error('[music] failed to announce playback error:', error);
        }
    });

    if (config.guildId) {
        player.on(GuildQueueEvent.Debug, (message) => {
            // Emitted when the player sends debug info
            // Useful for seeing what dependencies, extractors, etc are loaded
            console.log(`General player debug event: ${message}`);
        });

        player.events.on(GuildQueueEvent.Debug, (queue, message) => {
            // Emitted when the player queue sends debug info
            // Useful for seeing what state the current queue is at
            console.log(`[DEBUG ${queue.guild.id}] ${message}`);
        });
    }

    player.events.on(GuildQueueEvent.Error, (queue, error) => {
        console.log(`General player error event: ${error}`);
    });

    player.events.on(GuildQueueEvent.PlayerError, (queue, error) => {
        console.log(`Player error event: ${error}`);
    });
}
