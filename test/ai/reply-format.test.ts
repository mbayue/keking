import { describe, expect, test } from "bun:test";

import { stripEmojis, stripReasoning } from "../../src/ai/keqing/reply-format.ts";

describe("stripReasoning", () => {
  test("removes a complete think block", () => {
    expect(stripReasoning("<think>hidden</think>Halo")).toBe("Halo");
  });

  test("removes a truncated think block", () => {
    expect(stripReasoning("Halo<think>still thinking")).toBe("Halo");
    expect(stripReasoning("<think>only reasoning")).toBe("");
  });

  test("preserves normal prose", () => {
    expect(stripReasoning("Halo, dunia.")).toBe("Halo, dunia.");
  });
});

describe("stripEmojis", () => {
  test("removes the Keqing lightning bolt", () => {
    expect(stripEmojis("Halo ⚡")).toBe("Halo");
  });

  test("removes pictographs and ZWJ sequences", () => {
    expect(stripEmojis("A✨B")).toBe("AB");
    expect(stripEmojis("family 👨‍👩‍👧‍👦")).toBe("family");
  });

  test("removes skin-tone modifiers", () => {
    expect(stripEmojis("ok 👍🏽")).toBe("ok");
  });

  test("preserves ordinary punctuation and prose", () => {
    expect(stripEmojis("Halo, dunia. Apa kabar?")).toBe("Halo, dunia. Apa kabar?");
  });

  test("returns an empty string when only emoji remain", () => {
    expect(stripEmojis("⚡")).toBe("");
  });
});
