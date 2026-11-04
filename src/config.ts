// Bun autoloads .env — no dotenv import needed.

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
  return {
    token: getEnv(env, "DISCORD_TOKEN"),
    clientId: getEnv(env, "DISCORD_CLIENT_ID"),
    guildId: env.DISCORD_GUILD_ID,
    databaseUrl: env.DATABASE_URL,
    musicEnabled: env.MUSIC_ENABLED === "true",
    aiApiKey: (env.AI_API_KEY || '').trim(),
    aiBaseUrl: trimTrailingSlashes(env.AI_BASE_URL || 'https://api.openai.com/v1'),
    aiModel: env.AI_MODEL || 'spur-qwen3-8b',
    aiFallbackModel: env.AI_FALLBACK_MODEL || 'spur-qwen2.5-7b',
    aiPremiumModel: env.AI_PREMIUM_MODEL || 'spur-glm-air',
    aiVisionModel: env.AI_VISION_MODEL || 'spur-gemma4',
    aiImageModel: env.AI_IMAGE_MODEL || 'sdxl',
    aiMaxTokens: getPositiveInt(env, "AI_MAX_TOKENS", 220),
    aiMemoryRetentionDays: getPositiveInt(env, "AI_MEMORY_RETENTION_DAYS", 30),
    elevenLabsEnabled: env.ELEVENLABS_ENABLED === 'true',
    elevenLabsApiKey: (env.ELEVENLABS_API_KEY || '').trim(),
    elevenLabsVoiceId: (env.ELEVENLABS_VOICE_ID || '').trim(),
    elevenLabsModelId: env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    ytCookies: env.YOUTUBE_COOKIES || '',
    spotifyClientId: env.SPOTIFY_CLIENT_ID || '',
    spotifyClientSecret: env.SPOTIFY_CLIENT_SECRET || '',
    botOwnerId: env.BOT_OWNER_ID || "330320305606230016",
  };
}

export const config = loadConfig();
