import { describe, expect, test } from "bun:test";
import type { Readable } from "node:stream";

import { config } from "../../src/config.ts";
import { synthesizeElevenLabsSpeech } from "../../src/tts/elevenlabs-tts.ts";

async function collect(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function fakeClient(calls: Array<{ voiceId: string; options: Record<string, unknown> }>) {
  return {
    textToSpeech: {
      convert: async (voiceId: string, options: Record<string, unknown>) => {
        calls.push({ voiceId, options });
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            controller.close();
          },
        });
      },
    },
  };
}

describe("ElevenLabs TTS", () => {
  test("synthesizes audio with the configured voice", async () => {
    const calls: Array<{ voiceId: string; options: Record<string, unknown> }> = [];
    const audio = await synthesizeElevenLabsSpeech("  hello  ", fakeClient(calls));
    const bytes = await collect(audio);

    expect(bytes).toEqual(Buffer.from([1, 2, 3]));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.voiceId).toBe(config.elevenLabsVoiceId);
    expect(calls[0]?.options.text).toBe("hello");
    expect(calls[0]?.options.modelId).toBe(config.elevenLabsModelId);
  });

  test("caps text at 5,000 characters", async () => {
    const calls: Array<{ voiceId: string; options: Record<string, unknown> }> = [];
    await synthesizeElevenLabsSpeech("a".repeat(5_100), fakeClient(calls));
    expect(calls[0]?.options.text).toHaveLength(5_000);
  });

  test("throws when unconfigured", async () => {
    await expect(synthesizeElevenLabsSpeech("hello", null)).rejects.toThrow(
      "ElevenLabs is not configured.",
    );
  });

  test("throws for blank text", async () => {
    const calls: Array<{ voiceId: string; options: Record<string, unknown> }> = [];
    await expect(synthesizeElevenLabsSpeech("   ", fakeClient(calls))).rejects.toThrow(
      "No text to synthesize.",
    );
  });
});
