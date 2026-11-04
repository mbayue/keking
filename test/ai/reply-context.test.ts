import { describe, expect, test } from "bun:test";
import type { Message } from "discord.js";

import {
  buildReplyContext,
  MAX_QUOTE_CONTENT_CHARS,
} from "../../src/ai/keqing/reply-context.ts";

type FakeAttachment = {
  contentType?: string | null;
  name?: string | null;
};

function makeMessage(options: {
  authorName?: string;
  authorId?: string;
  bot?: boolean;
  content?: string;
  attachments?: FakeAttachment[];
  embeds?: Array<{ title?: string | null; description?: string | null }>;
} = {}): Message {
  const attachments = options.attachments ?? [];

  return {
    author: {
      username: options.authorName ?? "Keqing",
      id: options.authorId ?? "123",
      bot: options.bot ?? false,
    },
    content: options.content ?? "",
    attachments: {
      values: () => attachments.values(),
    },
    embeds: options.embeds ?? [],
  } as unknown as Message;
}

describe("buildReplyContext", () => {
  test("formats author and content", () => {
    const context = buildReplyContext(makeMessage({
      authorName: "Keqing",
      authorId: "456",
      bot: true,
      content: "  what did you mean?  ",
    }));

    expect(context).toBe("Author: Keqing (456) [bot]\nContent: what did you mean?");
  });

  test("caps quoted content", () => {
    const content = "x".repeat(MAX_QUOTE_CONTENT_CHARS + 100);
    const context = buildReplyContext(makeMessage({ content }));

    expect(context).toContain("x".repeat(MAX_QUOTE_CONTENT_CHARS));
    expect(context).not.toContain("x".repeat(MAX_QUOTE_CONTENT_CHARS + 1));
  });

  test("summarizes attachments and embeds without text", () => {
    const context = buildReplyContext(makeMessage({
      attachments: [
        { contentType: "image/png", name: "image.png" },
        { contentType: null, name: "document.pdf" },
        { contentType: null, name: null },
      ],
      embeds: [
        { title: " Title ", description: " Description " },
        { title: null, description: null },
      ],
    }));

    expect(context).toContain("Author: Keqing (123)");
    expect(context).toContain("Attachments: image/png, document.pdf, file");
    expect(context).toContain("Embeds: Title — Description");
  });

  test("returns null for an empty reference", () => {
    expect(buildReplyContext(makeMessage())).toBeNull();
  });
});
