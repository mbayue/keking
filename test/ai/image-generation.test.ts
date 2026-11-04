import { afterEach, describe, expect, test } from "bun:test";

import { generateImage } from "../../src/ai/keqing/image-generation.ts";

const originalFetch = globalThis.fetch;

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("generateImage", () => {
  test("returns a decoded PNG", async () => {
    let body: Record<string, unknown> | null = null;
    globalThis.fetch = (async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return response({
        data: [{ b64_json: Buffer.from("image-bytes").toString("base64") }],
      });
    }) as typeof fetch;

    const image = await generateImage("a red apple");

    expect(image.buffer.toString()).toBe("image-bytes");
    expect(image.mimeType).toBe("image/png");
    expect(body?.model).toBe("sdxl");
    expect(body?.prompt).toBe("a red apple");
  });

  test("rejects empty prompts", async () => {
    await expect(generateImage("  ")).rejects.toThrow("No image prompt provided.");
  });

  test("rejects HTTP failures", async () => {
    globalThis.fetch = (async () => response({}, 500)) as typeof fetch;
    await expect(generateImage("a cat")).rejects.toThrow(
      "Image request failed with status 500.",
    );
  });

  test("rejects missing image payloads", async () => {
    globalThis.fetch = (async () => response({ data: [] })) as typeof fetch;
    await expect(generateImage("a cat")).rejects.toThrow(
      "Image response contained no image.",
    );
  });
});
