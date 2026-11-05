import { describe, expect, test } from "bun:test";

import { loadConfig } from "../src/config.ts";

const required = {
  DISCORD_TOKEN: "token",
  DISCORD_CLIENT_ID: "client",
};

describe("config", () => {
  test("loads defaults", () => {
    const config = loadConfig(required);

    expect(config.token).toBe("token");
    expect(config.clientId).toBe("client");
    expect(config.aiBaseUrl).toBe("https://api.openai.com/v1");
    expect(config.aiModel).toBe("minimax-m3.1-flash");
    expect(config.aiFallbackModel).toBe("qwen3.8-flash-next");
    expect(config.aiPremiumModel).toBe("mimo-v2.6-flash");
    expect(config.aiVisionModel).toBe("qwen3.8-flash-next");
    expect(config.aiImageModel).toBe("sdxl");
    expect(config.aiMaxTokens).toBe(1200);
    expect(config.aiMemoryRetentionDays).toBe(30);
    expect(config.healthEnabled).toBe(true);
    expect(config.healthHost).toBe("127.0.0.1");
    expect(config.healthPort).toBe(3000);
    expect(config.metricsToken).toBeUndefined();
    expect(config.elevenLabsModelId).toBe("eleven_multilingual_v2");
    expect(config.botOwnerId).toBe("330320305606230016");
  });

  test("normalizes configured values", () => {
    const config = loadConfig({
      ...required,
      DISCORD_GUILD_ID: "guild",
      DATABASE_URL: "postgres://db",
      MUSIC_ENABLED: "true",
      AI_API_KEY: "  key  ",
      AI_BASE_URL: "https://example.test///",
      AI_MODEL: "model",
      AI_FALLBACK_MODEL: "fallback",
      AI_PREMIUM_MODEL: "premium",
      AI_VISION_MODEL: "vision",
      AI_IMAGE_MODEL: "image",
      AI_MAX_TOKENS: "12",
      AI_MEMORY_RETENTION_DAYS: "7",
      ELEVENLABS_ENABLED: "true",
      ELEVENLABS_API_KEY: "  eleven  ",
      ELEVENLABS_VOICE_ID: "  voice  ",
      ELEVENLABS_MODEL_ID: "model-id",
      YOUTUBE_COOKIES: "cookies",
      SPOTIFY_CLIENT_ID: "spotify-id",
      SPOTIFY_CLIENT_SECRET: "spotify-secret",
      BOT_OWNER_ID: "owner",
    });

    expect(config.aiBaseUrl).toBe("https://example.test");
    expect(config.aiApiKey).toBe("key");
    expect(config.aiModel).toBe("model");
    expect(config.aiFallbackModel).toBe("fallback");
    expect(config.aiPremiumModel).toBe("premium");
    expect(config.aiVisionModel).toBe("vision");
    expect(config.aiImageModel).toBe("image");
    expect(config.aiMaxTokens).toBe(12);
    expect(config.aiMemoryRetentionDays).toBe(7);
    expect(config.databaseUrl).toBe("postgres://db");
    expect(config.musicEnabled).toBe(true);
    expect(config.elevenLabsEnabled).toBe(true);
    expect(config.elevenLabsApiKey).toBe("eleven");
    expect(config.elevenLabsVoiceId).toBe("voice");
    expect(config.elevenLabsModelId).toBe("model-id");
    expect(config.ytCookies).toBe("cookies");
    expect(config.spotifyClientId).toBe("spotify-id");
    expect(config.spotifyClientSecret).toBe("spotify-secret");
    expect(config.botOwnerId).toBe("owner");
  });

  test("falls back for invalid positive integers and empty envs", () => {
    const config = loadConfig({
      ...required,
      AI_MAX_TOKENS: "0",
      AI_MEMORY_RETENTION_DAYS: "not-a-number",
    });

    expect(config.aiMaxTokens).toBe(1200);
    expect(config.aiMemoryRetentionDays).toBe(30);
  });

  test("requires a metrics token for non-loopback health binds", () => {
    expect(() =>
      loadConfig({
        ...required,
        HEALTH_HOST: "0.0.0.0",
      }),
    ).toThrow("METRICS_TOKEN must be set when HEALTH_HOST is not a loopback address");
  });

  test("allows a non-loopback health bind when a metrics token is set", () => {
    const config = loadConfig({
      ...required,
      HEALTH_HOST: "0.0.0.0",
      METRICS_TOKEN: "secret",
    });

    expect(config.healthHost).toBe("0.0.0.0");
    expect(config.metricsToken).toBe("secret");
  });

  test("allows a loopback health bind without a metrics token", () => {
    const config = loadConfig({
      ...required,
      HEALTH_HOST: "127.0.0.1",
    });

    expect(config.metricsToken).toBeUndefined();
  });

  test("ignores a blank metrics token", () => {
    const config = loadConfig({
      ...required,
      METRICS_TOKEN: "   ",
    });

    expect(config.metricsToken).toBeUndefined();
  });

  test("throws when required environment values are missing", () => {
    expect(() => loadConfig({ DISCORD_CLIENT_ID: "client" })).toThrow(
      "Missing required environment variable: DISCORD_TOKEN",
    );
    expect(() => loadConfig({ DISCORD_TOKEN: "token" })).toThrow(
      "Missing required environment variable: DISCORD_CLIENT_ID",
    );
  });
});
