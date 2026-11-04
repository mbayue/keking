import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import { config } from "../config.js";
import { elevenLabsClient } from "../elevenlabs-client.js";

const MAX_TEXT_CHARS = 5_000;

type SpeechClient = {
  textToSpeech: {
    convert: (
      voiceId: string,
      options: {
        text: string;
        modelId: string;
        outputFormat: string;
        voiceSettings: {
          stability: number;
          similarityBoost: number;
          style: number;
          useSpeakerBoost: boolean;
        };
      },
    ) => Promise<ReadableStream<Uint8Array>>;
  };
};

export { isElevenLabsConfigured } from "../elevenlabs-client.js";

export async function synthesizeElevenLabsSpeech(
  text: string,
  client: SpeechClient | null = elevenLabsClient as unknown as SpeechClient | null,
): Promise<Readable> {
  if (!client) {
    throw new Error("ElevenLabs is not configured.");
  }

  const trimmed = text.trim().slice(0, MAX_TEXT_CHARS);
  if (!trimmed) {
    throw new Error("No text to synthesize.");
  }

  const audio = await client.textToSpeech.convert(config.elevenLabsVoiceId, {
    text: trimmed,
    modelId: config.elevenLabsModelId,
    outputFormat: "mp3_44100_128",
    voiceSettings: {
      stability: 0.4,
      similarityBoost: 0.75,
      style: 0.35,
      useSpeakerBoost: true,
    },
  });

  // The SDK returns a web stream; Node's stream types describe the same shape.
  return Readable.fromWeb(audio as NodeReadableStream<Uint8Array>);
}
