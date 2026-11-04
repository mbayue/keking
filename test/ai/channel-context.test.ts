import { describe, expect, test } from "bun:test";
import type { Message } from "discord.js";

import {
  MAX_CHANNEL_CONTEXT_CHARS,
  MAX_CHANNEL_MESSAGE_CHARS,
  formatChannelContext,
  wantsChannelContext,
} from "../../src/ai/keqing/channel-context.ts";

type FakeMessageOptions = {
  authorName?: string;
  bot?: boolean;
  content?: string;
  attachments?: number;
  embeds?: number;
};

function makeMessage(options: FakeMessageOptions = {}): Message {
  return {
    author: {
      username: options.authorName ?? "user",
      bot: options.bot ?? false,
    },
    content: options.content ?? "",
    attachments: {
      size: options.attachments ?? 0,
    },
    embeds: new Array(options.embeds ?? 0).fill({}),
  } as unknown as Message;
}

describe("wantsChannelContext", () => {
  test("detects English and Indonesian recap requests", () => {
    expect(wantsChannelContext("summarize this conversation")).toBe(true);
    expect(wantsChannelContext("what happened in this channel?")).toBe(true);
    expect(wantsChannelContext("ringkas percakapan ini")).toBe(true);
    expect(wantsChannelContext("apa yang terlewat?")).toBe(true);
    expect(wantsChannelContext("catch me up")).toBe(true);
  });

  test("ignores unrelated summarization requests", () => {
    expect(wantsChannelContext("summarize this article")).toBe(false);
    expect(wantsChannelContext("what happened to the build?")).toBe(false);
    expect(wantsChannelContext("hello")).toBe(false);
  });
});

describe("formatChannelContext", () => {
  test("orders messages oldest-first and marks bots", () => {
    const context = formatChannelContext([
      makeMessage({ authorName: "newest", content: "new" }),
      makeMessage({ authorName: "Keqing", bot: true, content: " old " }),
    ]);

    expect(context).toBe("Keqing [bot]: old\nnewest: new");
  });

  test("summarizes attachments and embeds without text", () => {
    const context = formatChannelContext([
      makeMessage({ authorName: "user", attachments: 2, embeds: 1 }),
    ]);

    expect(context).toBe("user: [2 attachment(s)] [1 embed(s)]");
  });

  test("skips empty messages", () => {
    expect(formatChannelContext([makeMessage()])).toBeNull();
  });

  test("caps individual messages", () => {
    const long = "x".repeat(MAX_CHANNEL_MESSAGE_CHARS + 100);
    const context = formatChannelContext([
      makeMessage({ authorName: "long", content: long }),
    ]);

    expect(context).toContain("x".repeat(MAX_CHANNEL_MESSAGE_CHARS));
    expect(context).not.toContain("x".repeat(MAX_CHANNEL_MESSAGE_CHARS + 1));
  });

  test("caps total context", () => {
    const context = formatChannelContext(
      Array.from({ length: 30 }, () =>
        makeMessage({ authorName: "filler", content: "y".repeat(400) })),
    );

    expect(context).not.toBeNull();
    expect(context!.length).toBeLessThanOrEqual(MAX_CHANNEL_CONTEXT_CHARS);
  });
});
