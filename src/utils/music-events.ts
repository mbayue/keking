import { Client } from "discord.js";
import { Player, GuildQueueEvent } from "discord-player";
import { createInfoEmbed } from "./embeds.js";

export async function registerMusicEvents(player: Player, client: Client): Promise<void> {
    console.log("core || ", player.scanDeps());

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

            await channel.send({
                embeds: [createInfoEmbed({
                    title: 'Started Playing',
                    description: `${track.title} by ${track.author}`,
                })],
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
                    title: 'Queue Ended',
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
                    title: 'Disconnected',
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
                    title: 'Voice Channel Empty',
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
                    title: 'Playback Error',
                    description: `An error occurred during playback: ${error.message}`,
                })],
            });
        } catch (error) {
            console.error('[music] failed to announce playback error:', error);
        }
    });

    // player.on(GuildQueueEvent.Debug, (message) => {
    //     // Emitted when the player sends debug info
    //     // Useful for seeing what dependencies, extractors, etc are loaded
    //     console.log(`General player debug event: ${message}`);
    // });

    // player.events.on(GuildQueueEvent.Debug, (queue, message) => {
    //     // Emitted when the player queue sends debug info
    //     // Useful for seeing what state the current queue is at
    //     console.log(`[DEBUG ${queue.guild.id}] ${message}`);
    // });

    player.events.on(GuildQueueEvent.Error, (queue, error) => {
        console.log(`General player error event: ${error}`);
    });

    player.events.on(GuildQueueEvent.PlayerError, (queue, error) => {
        console.log(`Player error event: ${error}`);
    });
}
