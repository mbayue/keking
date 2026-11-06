import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";

import { importModulesFrom } from "../../src/utils/load-files.ts";

const fixtureDirectory = path.join(
  import.meta.dir,
  "..",
  "fixtures",
  "load-files",
);

describe("importModulesFrom", () => {
  test("loads .ts and .js files recursively and skips .d.ts", async () => {
    const modules = await importModulesFrom("../test/fixtures/load-files");
    const values = modules as Array<{ alpha?: number; beta?: number }>;

    expect(modules).toHaveLength(2);
    expect(values.some((module) => module.alpha === 1)).toBe(true);
    expect(values.some((module) => module.beta === 2)).toBe(true);
  });

  test("keeps the .d.ts fixture so the skip path stays covered", () => {
    // This file is gitignored by the "*.d.ts" rule and needs an explicit
    // negation in .gitignore. Without it the skip branch in load-files.ts is
    // never executed and the 100% coverage gate fails.
    expect(existsSync(path.join(fixtureDirectory, "ignored.d.ts"))).toBe(true);
  });
});
