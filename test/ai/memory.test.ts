import { describe, expect, test } from "bun:test";

import { loadTurns, saveTurns, trimTurns } from "../../src/ai/keqing/memory.ts";

describe("AI memory", () => {
  test("loads turns from the injected store", async () => {
    const turns = [{ role: "user" as const, content: "halo" }];
    const result = await loadTurns("guild", "user", async () => turns);
    expect(result).toEqual(turns);
  });

  test("returns an empty history when loading fails", async () => {
    const result = await loadTurns("guild", "user", async () => {
      throw new Error("db down");
    });
    expect(result).toEqual([]);
  });

  test("saves turns through the injected store", async () => {
    let saved: unknown = null;
    await saveTurns("guild", "user", [{ role: "user", content: "hi" }], async (...args) => {
      saved = args;
    });
    expect(saved).toEqual([
      "guild",
      "user",
      [{ role: "user", content: "hi" }],
    ]);
  });

  test("swallows save failures", async () => {
    await expect(
      saveTurns("guild", "user", [], async () => {
        throw new Error("db down");
      }),
    ).resolves.toBeUndefined();
  });

  test("trims to 10 turns", () => {
    const turns = Array.from({ length: 30 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: String(index),
    }));
    trimTurns(turns);
    expect(turns).toHaveLength(10);
  });

  test("trims a stored window that predates the current limit", async () => {
    const stored = Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: String(index),
    }));

    const result = await loadTurns("guild", "user", async () => stored);

    expect(result).toHaveLength(10);
  });

  test("drops leading assistant turns", () => {
    const turns = [
      { role: "assistant" as const, content: "first" },
      { role: "assistant" as const, content: "second" },
      { role: "user" as const, content: "hello" },
    ];
    trimTurns(turns);
    expect(turns).toEqual([{ role: "user", content: "hello" }]);
  });

  test("trims by character budget", () => {
    const turns = [
      { role: "user" as const, content: "a".repeat(7_000) },
      { role: "assistant" as const, content: "b".repeat(7_000) },
      { role: "user" as const, content: "short" },
    ];
    trimTurns(turns);
    expect(turns.reduce((total, turn) => total + turn.content.length, 0)).toBeLessThanOrEqual(12_000);
    expect(turns.at(-1)?.content).toBe("short");
  });
});
