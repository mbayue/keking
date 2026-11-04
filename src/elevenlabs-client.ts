import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { config } from "./config.js";

/**
 * The SDK reads ELEVENLABS_API_KEY from the environment by default.
 * Bun loads .env automatically; the key is never passed in code.
 */
export const elevenLabsClient = config.elevenLabsEnabled && config.elevenLabsApiKey.length > 0
  ? new ElevenLabsClient()
  : null;

export function isElevenLabsConfigured(): boolean {
  return (
    config.elevenLabsEnabled &&
    config.elevenLabsApiKey.length > 0 &&
    config.elevenLabsVoiceId.length > 0
  );
}
