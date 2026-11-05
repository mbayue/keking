// Bun autoloads .env — no dotenv import needed.

import { isLoopbackHost } from "./observability/health.js";

type Env = NodeJS.ProcessEnv;

function getEnv(env: Env, name: string): string {
  const value = env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPositiveInt(env: Env, name: string, fallback: number): number {
  const parsed = Number.parseInt(env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }
  return value.slice(0, end);
}

export function loadConfig(env: Env = process.env) {
  const metricsToken = (env.METRICS_TOKEN || "").trim() || undefined;
  const healthHost = env.HEALTH_HOST || "127.0.0.1";
  const healthEnabled = env.HEALTH_ENABLED !== "false";

  if (healthEnabled && !isLoopbackHost(healthHost) && !metricsToken) {
    throw new Error(
      "METRICS_TOKEN must be set when HEALTH_HOST is not a loopback address",
    );
  }

  return {
    token: getEnv(env, "DISCORD_TOKEN"),
    clientId: getEnv(env, "DISCORD_CLIENT_ID"),
    guildId: env.DISCORD_GUILD_ID,
    databaseUrl: env.DATABASE_URL,
    musicEnabled: env.MUSIC_ENABLED === "true",
    aiApiKey: (env.AI_API_KEY || '').trim(),
    aiBaseUrl: trimTrailingSlashes(env.AI_BASE_URL || 'https://api.openai.com/v1'),
    aiModel: env.AI_MODEL || 'minimax-m3.1-flash',
    aiFallbackModel: env.AI_FALLBACK_MODEL || 'mimo-v2.6-flash',
    aiPremiumModel: env.AI_PREMIUM_MODEL || 'deepseek-v4.1-flash-1017',
    aiVisionModel: env.AI_VISION_MODEL || 'qwen3.8-flash-next',
    aiImageModel: env.AI_IMAGE_MODEL || 'qwen-image-2.1',
    aiMaxTokens: getPositiveInt(env, "AI_MAX_TOKENS", 1200),
    aiReasoningEffort: env.AI_REASONING_EFFORT || "minimal",
    aiMemoryRetentionDays: getPositiveInt(env, "AI_MEMORY_RETENTION_DAYS", 30),
    elevenLabsEnabled: env.ELEVENLABS_ENABLED === 'true',
    elevenLabsApiKey: (env.ELEVENLABS_API_KEY || '').trim(),
    elevenLabsVoiceId: (env.ELEVENLABS_VOICE_ID || '').trim(),
    elevenLabsModelId: env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    ytCookies: env.YOUTUBE_COOKIES || '',
    spotifyClientId: env.SPOTIFY_CLIENT_ID || '',
    spotifyClientSecret: env.SPOTIFY_CLIENT_SECRET || '',
    metricsToken,
    healthEnabled,
    healthHost,
    healthPort: getPositiveInt(env, "HEALTH_PORT", 3000),
    botOwnerId: env.BOT_OWNER_ID || "330320305606230016",
  };
}

export const config = loadConfig();
