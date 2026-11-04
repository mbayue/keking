import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Readable } from "node:stream";

import { synthesizeGoogleSpeech } from "../../src/tts/google-tts.ts";

const originalFetch = globalThis.fetch;
let handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function googleResponse(base64 = "QUJD"): Response {
  const payload = [[null, null, JSON.stringify([base64])]];
  return new Response(`)]}'\n${JSON.stringify(payload)}`, { status: 200 });
}

async function collect(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

beforeEach(() => {
  globalThis.fetch = ((input, init) => handler(input, init)) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("synthesizeGoogleSpeech", () => {
  test("returns concatenated audio bytes", async () => {
    handler = async () => googleResponse();
    const bytes = await collect(await synthesizeGoogleSpeech("hello"));
    expect(bytes.toString()).toBe("ABC");
  });

  test("splits long words into 200-character chunks", async () => {
    const bodies: string[] = [];
    handler = async (_input, init) => {
      bodies.push(String(init?.body));
      return googleResponse();
    };

    const bytes = await collect(await synthesizeGoogleSpeech("a".repeat(250)));
    expect(bodies).toHaveLength(2);
    expect(bytes).toHaveLength(6);
  });

  test("splits on whitespace and punctuation", async () => {
    let calls = 0;
    handler = async () => {
      calls += 1;
      return googleResponse();
    };

    await synthesizeGoogleSpeech(`${"word ".repeat(60)}end.`);
    expect(calls).toBeGreaterThan(1);
  });

  test("rejects blank text", async () => {
    handler = async () => googleResponse();
    await expect(synthesizeGoogleSpeech("   ")).rejects.toThrow("No text to synthesize.");
  });

  test("rejects HTTP failures", async () => {
    handler = async () => new Response("", { status: 503 });
    await expect(synthesizeGoogleSpeech("hello")).rejects.toThrow(
      "Google TTS request failed with status 503",
    );
  });

  test("rejects unreadable responses", async () => {
    handler = async () => new Response("xxxxxnot-json", { status: 200 });
    await expect(synthesizeGoogleSpeech("hello")).rejects.toThrow(
      "Google TTS returned an unreadable response.",
    );
  });

  test("rejects responses without encoded audio", async () => {
    handler = async () => new Response(")]}'\n[[null,null]]", { status: 200 });
    await expect(synthesizeGoogleSpeech("hello")).rejects.toThrow(
      'Google TTS has no audio for language "id"',
    );
  });

  test("rejects invalid encoded audio", async () => {
    handler = async () => new Response(")]}'\n[[null,null,\"not-json\"]]", { status: 200 });
    await expect(synthesizeGoogleSpeech("hello")).rejects.toThrow();
  });

  test("rejects unexpected decoded payloads", async () => {
    handler = async () => {
      const payload = [[null, null, JSON.stringify([42])]];
      return new Response(`)]}'\n${JSON.stringify(payload)}`, { status: 200 });
    };
    await expect(synthesizeGoogleSpeech("hello")).rejects.toThrow(
      "Google TTS returned an unexpected payload.",
    );
  });
});
