import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  MAX_REPLY_CHARS,
  limitReply,
  requestCompletion,
  requestCompletionWithFallback,
} from "../../src/ai/keqing/completion.ts";

const originalFetch = globalThis.fetch;
const bun = Bun as unknown as { sleep: (milliseconds: number) => Promise<void> };
const originalSleep = bun.sleep;
const messages = [{ role: "user" as const, content: "hi" }];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  bun.sleep = async () => {};
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

afterAll(() => {
  bun.sleep = originalSleep;
});

describe("requestCompletionWithFallback", () => {
  test("tries models in order", async () => {
    const used: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { model?: string };
      used.push(body.model ?? "");
      return used.length === 1
        ? jsonResponse({}, 400)
        : jsonResponse({ choices: [{ message: { content: "ok" } }] });
    }) as typeof fetch;

    await expect(
      requestCompletionWithFallback(messages, ["primary", "fallback"]),
    ).resolves.toBe("ok");
    expect(used).toEqual(["primary", "fallback"]);
  });

  test("deduplicates models and rethrows the last failure", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return jsonResponse({}, 400);
    }) as typeof fetch;

    await expect(
      requestCompletionWithFallback(messages, ["same", "same", "last"]),
    ).rejects.toThrow("AI request failed with status 400.");
    expect(calls).toBe(2);
  });

  test("rejects an empty model list", async () => {
    await expect(requestCompletionWithFallback(messages, [])).rejects.toThrow(
      "AI request failed.",
    );
  });
});

describe("requestCompletion", () => {
  test("sends the configured reasoning effort", async () => {
    let captured: { reasoning_effort?: string } = {};
    globalThis.fetch = (async (_input, init) => {
      captured = JSON.parse(String(init?.body)) as { reasoning_effort?: string };
      return jsonResponse({ choices: [{ message: { content: "ok" } }] });
    }) as typeof fetch;

    await requestCompletion(messages);

    expect(captured.reasoning_effort).toBe("minimal");
  });

  test("returns a trimmed string reply", async () => {
    globalThis.fetch = (async () => jsonResponse({
      choices: [{ message: { content: "  hello  " } }],
    })) as typeof fetch;

    await expect(requestCompletion(messages)).resolves.toBe("hello");
  });

  test("joins array content parts", async () => {
    globalThis.fetch = (async () => jsonResponse({
      choices: [{
        message: {
          content: [
            { text: "  a" },
            { text: "b  " },
            null,
            { text: 42 },
          ],
        },
      }],
    })) as typeof fetch;

    await expect(requestCompletion(messages)).resolves.toBe("ab");
  });

  test("rejects payloads without usable text", async () => {
    const payloads: unknown[] = [
      {},
      { choices: [] },
      { choices: [null] },
      { choices: [{}] },
      { choices: [{ message: {} }] },
      { choices: [{ message: { content: 42 } }] },
      { choices: [{ message: { content: [] } }] },
    ];

    for (const payload of payloads) {
      globalThis.fetch = (async () => jsonResponse(payload)) as typeof fetch;
      await expect(requestCompletion(messages)).rejects.toThrow("AI response contained no text.");
    }
  });

  test("does not retry non-retryable HTTP errors", async () => {
    globalThis.fetch = (async () => jsonResponse({}, 400)) as typeof fetch;
    await expect(requestCompletion(messages)).rejects.toThrow(
      "AI request failed with status 400.",
    );
  });

  test("retries rate limits once", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse({}, 429)
        : jsonResponse({ choices: [{ message: { content: "ok" } }] });
    }) as typeof fetch;

    await expect(requestCompletion(messages)).resolves.toBe("ok");
    expect(calls).toBe(2);
  });

  test("retries server errors once", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse({}, 500)
        : jsonResponse({ choices: [{ message: { content: "ok" } }] });
    }) as typeof fetch;

    await expect(requestCompletion(messages)).resolves.toBe("ok");
    expect(calls).toBe(2);
  });

  test("throws the second HTTP failure", async () => {
    globalThis.fetch = (async () => jsonResponse({}, 503)) as typeof fetch;
    await expect(requestCompletion(messages)).rejects.toThrow(
      "AI request failed with status 503.",
    );
  });

  test("retries a thrown fetch once", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("network");
      }
      return jsonResponse({ choices: [{ message: { content: "ok" } }] });
    }) as typeof fetch;

    await expect(requestCompletion(messages)).resolves.toBe("ok");
    expect(calls).toBe(2);
  });

  test("throws the last fetch error", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;

    await expect(requestCompletion(messages)).rejects.toThrow("network down");
  });

  test("normalizes non-Error fetch failures", async () => {
    globalThis.fetch = (async () => {
      throw "offline";
    }) as typeof fetch;

    await expect(requestCompletion(messages)).rejects.toThrow("AI request failed.");
  });

  test("rejects unreadable JSON", async () => {
    globalThis.fetch = (async () => new Response("not json", { status: 200 })) as typeof fetch;
    await expect(requestCompletion(messages)).rejects.toThrow("AI response contained no text.");
  });
});
