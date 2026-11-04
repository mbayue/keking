import { describe, expect, test } from "bun:test";

import { MAX_REPLY_CHARS, limitReply } from "../../src/ai/keqing/completion.ts";

describe("limitReply", () => {
  test("keeps short replies unchanged", () => {
    expect(limitReply("  halo  ")).toBe("halo");
  });

  test("cuts at a sentence boundary near the limit", () => {
    const reply = `${"a".repeat(250)}. ${"b".repeat(300)}`;
    const result = limitReply(reply);

    expect(result).toBe(`${"a".repeat(250)}.`);
    expect(result.length).toBeLessThanOrEqual(MAX_REPLY_CHARS);
  });

  test("adds an ellipsis when no sentence boundary is available", () => {
    const result = limitReply("x".repeat(MAX_REPLY_CHARS + 100));

    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(MAX_REPLY_CHARS + 1);
  });
});
