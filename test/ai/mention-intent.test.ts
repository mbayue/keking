import { describe, expect, test } from "bun:test";

import { wantsMention } from "../../src/ai/keqing/mention-intent.ts";

describe("wantsMention", () => {
  test("detects an explicit ask to address someone", () => {
    expect(wantsMention("sapa <@123>")).toBe(true);
    expect(wantsMention("tolong sapa dia")).toBe(true);
    expect(wantsMention("salam dong")).toBe(true);
    expect(wantsMention("tolong bilang ke dia")).toBe(true);
    expect(wantsMention("bilang ke dia ini")).toBe(true);
    expect(wantsMention("greet them for me")).toBe(true);
    expect(wantsMention("say hi to her")).toBe(true);
  });

  test("ignores messages that do not ask for an address", () => {
    expect(wantsMention("halo")).toBe(false);
    expect(wantsMention("apa kabar?")).toBe(false);
    expect(wantsMention("sapaanCODE")).toBe(false);
    expect(wantsMention("")).toBe(false);
  });
});
