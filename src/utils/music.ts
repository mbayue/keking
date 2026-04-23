import { Player, Track } from "discord-player";
import { DefaultExtractors } from "@discord-player/extractor";
import { YoutubeiExtractor } from "discord-player-youtubei";
import type { GuildMember, VoiceBasedChannel } from "discord.js";
import { Client } from "discord.js";
import { config } from "../config.js";

// Initialize discord-player
let player: Player | null = null;

export async function initializePlayer(client: Client): Promise<Player> {
  if (!player) {
    player = new Player(client as any);
    await player.extractors.loadMulti(DefaultExtractors);
    await player.extractors.register(YoutubeiExtractor, {
      useYoutubeDL: true,
      cookie: config.ytCookies,
    });
    const extractorNames = player.extractors.store.map((extractor) => extractor.identifier).join(", ");
    console.log(`[music] loaded extractors: ${extractorNames}`);
  }
  return player;
}

export class MusicPlayer {
  private activeChannel: VoiceBasedChannel | null = null;
  private discordPlayer: Player;
  private guildId: string;

  constructor(discordPlayer: Player, guildId: string) {
    this.discordPlayer = discordPlayer;
    this.guildId = guildId;
  }

  async joinChannel(member: GuildMember): Promise<boolean> {
    if (!member.voice.channel) return false;
    this.activeChannel = member.voice.channel;
    return true;
  }

  async play(urlOrQuery: string): Promise<string> {
    if (!this.activeChannel) return "Not connected to a voice channel.";

    try {
      const normalizedQuery = this.normalizeQuery(urlOrQuery);
      const result = await this.discordPlayer.play(this.activeChannel as any, normalizedQuery, {
        nodeOptions: {
          leaveOnEnd: true,
          leaveOnEndCooldown: 60_000,
          metadata: { guildId: this.guildId },
        },
      });
      this.logVoiceConnectionState("play");

      let reply = ''
      if (this.discordPlayer.nodes.get(this.guildId)?.size === 0) {
        reply = `Now playing: ${result.track.title} by ${result.track.author}`;
      } else {
        reply = `Added to queue: ${result.track.title} by ${result.track.author}`;
      }

      return reply;
    } catch (error) {
      console.error("Error playing track:", error);
      return "Failed to play the track. If this is a YouTube link, try using the full watch URL or a song title.";
    }
  }

  private normalizeQuery(input: string): string {
    const trimmed = input.trim();

    // For YouTube URLs, preserve the video ID (v=...) but strip tracking params
    if (trimmed.includes("youtu")) {
      try {
        const url = new URL(trimmed);
        const videoId = url.searchParams.get("v");
        if (videoId) {
          return `https://www.youtube.com/watch?v=${videoId}`;
        }
      } catch {
        // If URL parsing fails, return original
        return trimmed;
      }
    }

    // For Spotify URLs, preserve them as-is
    if (trimmed.includes("open.spotify.com/")) {
      return trimmed;
    }

    // For other inputs, return as-is
    return trimmed;
  }

  addToQueue(url: string): void {
    void this.play(url);
  }

  skip(): string {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (queue?.node.skip()) {
      return "Skipped current track.";
    }
    return "No track is currently playing.";
  }

  pause(): string {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (!queue) return "No music is currently playing.";

    if (queue.node.pause()) {
      return "Music paused.";
    }
    return "Music is already paused.";
  }

  resume(): string {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (!queue) return "No music is currently playing.";

    if (queue.node.resume()) {
      return "Music resumed.";
    }
    return "Music is already playing.";
  }

  stop(): string {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (queue) {
      queue.delete();
    }
    this.activeChannel = null;
    return "Stopped playback and cleared queue.";
  }

  getQueue(): string[] {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (!queue) return [];
    return queue.tracks.toArray().map((track: Track) => `${track.title} by ${track.author}`);
  }

  getCurrentTrack(): string | null {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (!queue?.currentTrack) return null;
    return `${queue.currentTrack.title} by ${queue.currentTrack.author}`;
  }

  getNowPlayingDetails(): { track: string; duration: string; queueSize: number } | null {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (!queue?.currentTrack) return null;

    const durationMs = queue.currentTrack.durationMS || 0;
    const durationMins = Math.floor(durationMs / 60000);
    const durationSecs = Math.floor((durationMs % 60000) / 1000);

    return {
      track: `${queue.currentTrack.title} by ${queue.currentTrack.author}`,
      duration: `${durationMins}:${durationSecs.toString().padStart(2, '0')}`,
      queueSize: queue.tracks.size,
    };
  }

  removeTrack(index: number): string {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (!queue) return "No queue available.";

    const tracks = queue.tracks.toArray();
    if (index < 0 || index >= tracks.length) {
      return `Invalid track index. Queue has ${tracks.length} tracks.`;
    }

    const removed = tracks[index];
    if (removed) {
      queue.tracks.remove((track: Track) => track === removed);
      return `Removed: ${removed.title || 'Unknown'} by ${removed.author || 'Unknown'}`;
    }
    return "Failed to remove track.";
  }

  clearQueue(): string {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (!queue) return "No queue available.";

    const size = queue.tracks.size;
    queue.tracks.clear();
    return `Cleared ${size} tracks from the queue.`;
  }

  async search(query: string): Promise<Track[]> {
    try {
      const results = await this.discordPlayer.search(query, {});
      return results.tracks.slice(0, 5);
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  }

  async playTrack(track: Track): Promise<string> {
    if (!this.activeChannel) return "Not connected to a voice channel.";

    try {
      const queue = this.discordPlayer.nodes.get(this.guildId) ||
        this.discordPlayer.nodes.create(this.guildId, {
          metadata: { guildId: this.guildId },
          leaveOnEnd: true,
          leaveOnEndCooldown: 60000,
        });

      if (!queue.connection) {
        await queue.connect(this.activeChannel as any);
        this.logVoiceConnectionState("playTrack.connect");
      }

      queue.addTrack(track);

      let result = ''

      if (!queue.isPlaying()) {
        await queue.node.play();
        this.logVoiceConnectionState("playTrack.start");
        result = `Now playing: ${track.title} by ${track.author}`;
      }

      if (queue.size > 1) {
        result = `Added to queue: ${track.title} by ${track.author}`;
      }

      return result;
    } catch (error) {
      console.error("Error playing track:", error);
      return "Failed to play the track.";
    }
  }

  disconnect(): void {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (queue) {
      queue.delete();
    }
    this.activeChannel = null;
  }

  private logVoiceConnectionState(context: string): void {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    const status = queue?.connection?.state?.status ?? "no-connection";
    const channelId = this.activeChannel?.id ?? "none";
    console.log(`[voice:${context}] guild=${this.guildId} channel=${channelId} status=${status}`);
  }
}

// Global player instances per guild
const players = new Map<string, MusicPlayer>();

export function getPlayer(guildId: string): MusicPlayer {
  if (!player) {
    throw new Error("Music player has not been initialized.");
  }

  if (!players.has(guildId)) {
    players.set(guildId, new MusicPlayer(player, guildId));
  }
  return players.get(guildId)!;
}
