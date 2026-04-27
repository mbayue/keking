import { Player, Track, QueueRepeatMode } from "discord-player";
import { DefaultExtractors } from "@discord-player/extractor";
import { YoutubeExtractor } from "discord-player-youtube";
import type { GuildMember, VoiceBasedChannel } from "discord.js";
import { Client } from "discord.js";
import { TTSExtractor } from "discord-player-tts";
import { registerMusicEvents } from "./music-events.js";
import { Client as GeniusClient } from "genius-lyrics";
import { config } from "../config.js";

// Initialize discord-player
let player: Player | null = null;

export async function initializePlayer(client: Client): Promise<Player> {
  if (!player) {
    player = new Player(client as any);
    await player.extractors.loadMulti(DefaultExtractors);
    await player.extractors.register(YoutubeExtractor, {
      cookie: config.ytCookies,
    });
    await player.extractors.register(TTSExtractor, {
      language: "en",
      slow: false
    });

    await registerMusicEvents(player, client);
  }
  return player;
}

export class MusicPlayer {
  private activeChannel: VoiceBasedChannel | null = null;
  private textChannelId: string | null = null;
  private discordPlayer: Player;
  private guildId: string;

  constructor(discordPlayer: Player, guildId: string) {
    this.discordPlayer = discordPlayer;
    this.guildId = guildId;
  }

  setTextChannel(channelId: string): void {
    this.textChannelId = channelId;
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
          leaveOnEndCooldown: 300_000,
          metadata: { guildId: this.guildId, textChannelId: this.textChannelId },
        },
      });
      this.logVoiceConnectionState("play");

      if (result.searchResult.playlist) {
        return `${result.searchResult.playlist.title} with ${result.searchResult.tracks.length} tracks to the queue.`;
      }

      return `${result.track.title} by ${result.track.author}`;
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

    // For Spotify URLs, preserve them as-is only when the parsed host is exactly open.spotify.com
    try {
      const url = new URL(trimmed);
      if (url.hostname.toLowerCase() === "open.spotify.com") {
        return trimmed;
      }
    } catch {
      // Not a URL; fall through and return as-is
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

  shuffle(): string {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (!queue) return "No queue available.";

    if (queue.tracks.size < 2) {
      return "Need at least 2 tracks in queue to shuffle.";
    }

    queue.tracks.shuffle();
    return "Queue shuffled!";
  }

  setLoopMode(mode: 'off' | 'track' | 'queue' | 'autoplay'): string {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (!queue) return "No queue available.";

    switch (mode) {
      case 'off':
        queue.setRepeatMode(QueueRepeatMode.OFF);
        return "Loop mode disabled.";
      case 'track':
        queue.setRepeatMode(QueueRepeatMode.TRACK);
        return "Now looping current track.";
      case 'queue':
        queue.setRepeatMode(QueueRepeatMode.QUEUE);
        return "Now looping entire queue.";
      case 'autoplay':
        queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
        return "Autoplay enabled - will add similar tracks when queue ends.";
      default:
        return "Invalid loop mode.";
    }
  }

  getLoopMode(): string {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (!queue) return "No queue available.";

    const mode = queue.repeatMode;
    switch (mode) {
      case QueueRepeatMode.OFF:
        return 'off';
      case QueueRepeatMode.TRACK:
        return 'track';
      case QueueRepeatMode.QUEUE:
        return 'queue';
      case QueueRepeatMode.AUTOPLAY:
        return 'autoplay';
      default:
        return 'unknown';
    }
  }

  async getLyrics(trackTitle?: string, artist?: string): Promise<{ lyrics: string; title: string; artist: string } | null> {
    try {
      let query = '';
      if (trackTitle && artist) {
        query = `${trackTitle} ${artist}`;
      } else {
        const currentTrack = this.getCurrentTrack();
        if (!currentTrack) return null;
        query = currentTrack;
      }

      const client = new GeniusClient();
      const songs = await client.songs.search(query);
      if (songs.length === 0 || !songs[0]) return null;

      const lyrics = await songs[0].lyrics();
      return {
        lyrics: lyrics || 'No lyrics found.',
        title: songs[0].title || 'Unknown',
        artist: songs[0].artist?.name || 'Unknown',
      };
    } catch (error) {
      console.error("Lyrics error:", error);
      return null;
    }
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
          metadata: { guildId: this.guildId, textChannelId: this.textChannelId },
          leaveOnEnd: true,
          leaveOnEndCooldown: 300_000,
        });

      if (this.textChannelId) {
        queue.metadata = { ...queue.metadata, guildId: this.guildId, textChannelId: this.textChannelId };
      }

      queue.addTrack(track);
      return `${track.title} by ${track.author}`;
    } catch (error) {
      console.error("Error playing track:", error);
      return "Failed to play the track.";
    }
  }

  async playTTS(text: string): Promise<string> {
    if (!this.activeChannel) return "Not connected to a voice channel.";
    if (!text || text.trim().length === 0) return "Please provide text to convert to speech.";

    try {
      await this.discordPlayer.play(this.activeChannel as any, `tts:${text}`, {
        nodeOptions: {
          leaveOnEnd: true,
          leaveOnEndCooldown: 300_000,
          metadata: { guildId: this.guildId, textChannelId: this.textChannelId },
        },
      });
      this.logVoiceConnectionState("playTTS");

      return `Playing TTS: ${text}`;
    } catch (error) {
      console.error("Error playing TTS:", error);
      return "Failed to play TTS. Please check the text format.";
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
