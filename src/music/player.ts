import { Player, Track, QueueRepeatMode, QueryType } from "discord-player";
import { SpotifyExtractor, DefaultExtractors } from "@discord-player/extractor";
import { YoutubeExtractor } from "discord-player-youtubei";
import type { GuildMember, VoiceBasedChannel } from "discord.js";
import { Client } from "discord.js";
import { KekingTTSExtractor } from "../tts/index.js";
import { isElevenLabsConfigured } from "../tts/elevenlabs-tts.js";
import { fetchLyrics } from "./lyrics.js";
import { registerMusicEvents } from "./events.js";
import { config } from "../config.js";
import { assertBotCanJoinVoice } from "../utils/permissions.js";

function getCookiesShape(ytCookies: string): string {
  if (ytCookies.length === 0) {
    return "missing";
  }
  if (ytCookies.startsWith("[") || ytCookies.startsWith("{")) {
    return "json-not-a-raw-header";
  }
  if (ytCookies.includes("#HttpOnly") || ytCookies.includes("\t")) {
    return "netscape-file-not-a-raw-header";
  }
  return "header-like";
}

/** Boot-time self-check: metadata APIs vs media RPCs. Never logs secrets. */
async function diagnoseStreamReachability(ytCookies: string): Promise<void> {
  const summary: Record<string, unknown> = {
    cookiesPresent: ytCookies.length > 0,
    cookiesLength: ytCookies.length,
    cookiesShape: getCookiesShape(ytCookies),
  };

  try {
    const body = "f.req=" + encodeURIComponent(
      JSON.stringify([[[ "jQ1olc", JSON.stringify(["hello", "en", null, "null"]), null, "generic" ]]])
    );
    const res = await fetch("https://translate.google.com/_/TranslateWebserverUi/data/batchexecute", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    summary.ttsRpc = { status: res.status, bytes: text.length, head: text.slice(0, 80) };
  } catch (error) {
    summary.ttsRpc = { error: error instanceof Error ? error.message : String(error) };
  }

  try {
    const res = await fetch("https://www.youtube.com/watch?v=jNQXAC9IVRw", {
      headers: { "user-agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    summary.youtubeWatch = {
      status: res.status,
      hasVideo: text.includes("Me at the zoo"),
      botWall: text.includes("unusual traffic") || text.includes("not a bot"),
    };
  } catch (error) {
    summary.youtubeWatch = { error: error instanceof Error ? error.message : String(error) };
  }

  console.log(`[music] stream-reachability ${JSON.stringify(summary)}`);
}

// Initialize discord-player
let player: Player | null = null;

export async function initializePlayer(client: Client): Promise<Player> {
  if (!player) {
    player = new Player(client);
    // One service owns provider selection; TTS stays available even when music playback is disabled.
    await player.extractors.register(KekingTTSExtractor, {});

    if (!config.musicEnabled) {
      console.log("[music] playback disabled (MUSIC_ENABLED!=true); TTS only.");
    }

    if (isElevenLabsConfigured()) {
      console.log(`[tts] ElevenLabs voice enabled (${config.elevenLabsModelId}).`);
    } else {
      console.log("[tts] ElevenLabs not configured; using Google Translate TTS.");
    }

    if (config.musicEnabled) {
      // Spotify must be registered before the defaults so configured credentials
      // are used; loadMulti skips extractors whose identifier already exists.
      if (config.spotifyClientId && config.spotifyClientSecret) {
        await player.extractors.register(SpotifyExtractor, {
          clientId: config.spotifyClientId,
          clientSecret: config.spotifyClientSecret,
        });
      }
      await player.extractors.loadMulti(DefaultExtractors);
      await player.extractors.register(YoutubeExtractor, {
        cookie: config.ytCookies,
      });
      registerMusicEvents(player, client);

      if (process.env.MUSIC_DEBUG === "1") {
        void diagnoseStreamReachability(config.ytCookies);
      }
    }
  }
  return player;
}

export class MusicPlayer {
  private activeChannel: VoiceBasedChannel | null = null;
  private textChannelId: string | null = null;
  private readonly discordPlayer: Player;
  private readonly guildId: string;

  constructor(discordPlayer: Player, guildId: string) {
    this.discordPlayer = discordPlayer;
    this.guildId = guildId;
  }

  setTextChannel(channelId: string): void {
    this.textChannelId = channelId;
  }

  joinChannel(member: GuildMember): boolean {
    if (!member.voice.channel) return false;
    assertBotCanJoinVoice(member);
    this.activeChannel = member.voice.channel;
    return true;
  }

  async joinVoice(member: GuildMember): Promise<string> {
    const channel = member.voice.channel;
    if (!channel) {
      return "Join a voice channel first.";
    }

    assertBotCanJoinVoice(member);
    this.activeChannel = channel;

    const queue = this.discordPlayer.nodes.get(this.guildId) ?? this.discordPlayer.nodes.create(this.guildId, {
      metadata: { guildId: this.guildId, textChannelId: this.textChannelId },
      leaveOnEnd: false,
      leaveOnEmpty: false,
      leaveOnStop: false,
    });

    queue.options.leaveOnEnd = false;
    queue.options.leaveOnEmpty = false;
    queue.options.leaveOnStop = false;

    if (this.textChannelId) {
      queue.metadata = { ...queue.metadata, guildId: this.guildId, textChannelId: this.textChannelId };
    }

    if (queue.connection?.joinConfig.channelId !== channel.id) {
      await queue.connect(channel);
    }

    this.logVoiceConnectionState("joinVoice");
    return `Joined ${channel.name}.`;
  }

  async play(urlOrQuery: string): Promise<string> {
    if (!this.activeChannel) return "Not connected to a voice channel.";

    try {
      const normalizedQuery = this.normalizeQuery(urlOrQuery);
      // soundcloud.ts streams via undici Pool, which returns no response under Bun —
      // bridge SoundCloud links through YouTube instead of playing them directly.
      if (this.isSoundCloudLink(normalizedQuery)) {
        return await this.playSoundCloudBridge(normalizedQuery);
      }
      const isDirectLink = this.isDirectLink(normalizedQuery);
      const result = await this.discordPlayer.play(this.activeChannel as any, normalizedQuery, {
        searchEngine: isDirectLink ? QueryType.AUTO : QueryType.YOUTUBE_SEARCH,
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

    if (trimmed.includes("youtu")) {
      try {
        const url = new URL(trimmed);
        const videoId = url.searchParams.get("v");
        if (videoId) {
          return `https://www.youtube.com/watch?v=${videoId}`;
        }
      } catch {
        return trimmed;
      }
    }

    try {
      const url = new URL(trimmed);
      if (url.hostname.toLowerCase() === "open.spotify.com") {
        return trimmed;
      }
    } catch {
      // Not a URL; fall through and return as-is
    }

    return trimmed;
  }

  addToQueue(url: string): void {
    void this.play(url);
  }

  private isDirectLink(input: string): boolean {
    try {
      const url = new URL(input);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  private isSoundCloudLink(input: string): boolean {
    try {
      const hostname = new URL(input).hostname.toLowerCase();
      return hostname === "soundcloud.com" || hostname.endsWith(".soundcloud.com");
    } catch {
      return false;
    }
  }

  private async playSoundCloudBridge(soundcloudUrl: string): Promise<string> {
    if (new URL(soundcloudUrl).pathname.includes("/sets/")) {
      return "SoundCloud playlists aren't supported yet — paste a single track link.";
    }

    // Public oEmbed needs no API key; soundcloud.ts API calls ride undici Pool,
    // which returns no response under Bun.
    let title = "";
    let author = "";
    try {
      const res = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(soundcloudUrl)}`);
      if (!res.ok) return "Could not find that SoundCloud track.";
      const data: unknown = await res.json();
      if (typeof data === "object" && data !== null) {
        if ("title" in data && typeof data.title === "string") title = data.title;
        if ("author_name" in data && typeof data.author_name === "string") author = data.author_name;
      }
    } catch {
      return "Could not reach SoundCloud to look up that link.";
    }
    if (!title) return "Could not find that SoundCloud track.";

    const ytResult = await this.discordPlayer.search(author ? `${author} - ${title}` : title, {
      searchEngine: QueryType.YOUTUBE_SEARCH,
    });
    const ytTrack = ytResult.tracks[0];
    if (!ytTrack) return `Found "${title}" on SoundCloud but found no YouTube match.`;

    const started = await this.playTrack(ytTrack);
    return `SoundCloud bridged via YouTube — ${started}`;
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

  getNowPlayingDetails(): { track: string; duration: string; queueSize: number; progressBar: string; thumbnail: string | null; url: string | null } | null {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    if (!queue?.currentTrack) return null;

    const durationMs = queue.currentTrack.durationMS || 0;
    const durationMins = Math.floor(durationMs / 60000);
    const durationSecs = Math.floor((durationMs % 60000) / 1000);
    const progressBar = queue.node.createProgressBar({
      length: 30,
      leftChar: "=",
      indicator: "o",
      rightChar: "-",
      queue: false,
    }) ?? "`0:00 |o-----------------| 0:00`";

    return {
      track: `${queue.currentTrack.title} by ${queue.currentTrack.author}`,
      duration: `${durationMins}:${durationSecs.toString().padStart(2, '0')}`,
      queueSize: queue.tracks.size,
      progressBar,
      thumbnail: queue.currentTrack.thumbnail ?? null,
      url: queue.currentTrack.url ?? null,
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
    let query = '';
    if (trackTitle && artist) {
      query = `${trackTitle} ${artist}`;
    } else {
      const currentTrack = this.getCurrentTrack();
      if (!currentTrack) return null;
      query = currentTrack;
    }

    return fetchLyrics(query);
  }

  async search(query: string): Promise<Track[]> {
    try {
      const results = await this.discordPlayer.search(query, {
        searchEngine: QueryType.YOUTUBE_SEARCH,
      });
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

      if (!queue.connection) {
        await queue.connect(this.activeChannel as any);
        this.logVoiceConnectionState("playTrack.connect");
      }

      queue.addTrack(track);

      if (!queue.isPlaying()) {
        await queue.node.play();
        this.logVoiceConnectionState("playTrack.start");
      }

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
      const query = `tts:${text}`;
      await this.discordPlayer.play(this.activeChannel as any, query, {
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

  async speakInChannel(channel: VoiceBasedChannel, text: string): Promise<string> {
    this.activeChannel = channel;
    return this.playTTS(text);
  }

  disconnect(): string {
    const queue = this.discordPlayer.nodes.get(this.guildId);
    const channelName = this.activeChannel?.name ?? null;
    const wasConnected = Boolean(queue || this.activeChannel);

    if (queue) {
      queue.delete();
    }
    this.activeChannel = null;

    if (!wasConnected) {
      return "Not connected to a voice channel.";
    }

    return channelName ? `Left ${channelName}.` : "Left the voice channel.";
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
