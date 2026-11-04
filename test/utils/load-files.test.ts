import { describe, expect, test } from "bun:test";

import { importModulesFrom } from "../../src/utils/load-files.ts";

describe("importModulesFrom", () => {
  test("loads .ts and .js files recursively and skips .d.ts", async () => {
    const modules = await importModulesFrom("../test/fixtures/load-files");
    const values = modules as Array<{ alpha?: number; beta?: number }>;

    expect(modules).toHaveLength(2);
    expect(values.some((module) => module.alpha === 1)).toBe(true);
    expect(values.some((module) => module.beta === 2)).toBe(true);
  });
});
