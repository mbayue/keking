import { describe, expect, test } from "bun:test";

import { keepMentions, stripMention } from "../../src/ai/keqing/handler.ts";

describe("stripMention", () => {
  test("removes a mention of the given user", () => {
    expect(stripMention("<@123> halo", "123")).toBe("halo");
  });

  test("removes a nickname mention of the given user", () => {
    expect(stripMention("<@!123> halo", "123")).toBe("halo");
  });

  test("removes every occurrence", () => {
    expect(stripMention("<@123> halo <@123> lagi", "123")).toBe("halo  lagi");
  });

  test("trims surrounding whitespace left behind", () => {
    expect(stripMention("  <@123> halo  ", "123")).toBe("halo");
  });

  test("keeps mentions of other users", () => {
    expect(stripMention("<@123> halo <@456>", "123")).toBe("halo <@456>");
  });

  test("leaves text without the mention untouched", () => {
    expect(stripMention("halo dunia", "123")).toBe("halo dunia");
  });
});

describe("keepMentions", () => {
  test("keeps a mention the user asked for", () => {
    expect(keepMentions("<@456> halo Iris", ["456"])).toBe("<@456> halo Iris");
  });

  test("drops a mention the model invented", () => {
    expect(keepMentions("<@456> halo Iris", [])).toBe("halo Iris");
  });

  test("drops mentions of users that were not requested", () => {
    expect(keepMentions("<@456> halo <@789>", ["456"])).toBe("<@456> halo");
  });

  test("keeps the nickname form of a mention", () => {
    expect(keepMentions("<@!456> halo", ["456"])).toBe("<@!456> halo");
  });

  test("cleans up spacing left by removed mentions", () => {
    expect(keepMentions("<@456> <@789> halo", ["456"])).toBe("<@456> halo");
  });

  test("leaves plain text untouched", () => {
    expect(keepMentions("halo dunia", ["456"])).toBe("halo dunia");
  });
});
