import { describe, expect, test } from "bun:test";

import {
  KEQING_LOVED_USER_CONTEXT,
  KEQING_LOVED_USER_ID,
  KEQING_LOVED_USER_NAME_PATTERN,
  KEQING_RELATIONSHIP_CONTEXT,
  KEQING_SYSTEM_PROMPT,
} from "../../src/ai/keqing/persona.ts";

describe("Keqing persona", () => {
  test("exports a system prompt and relationship context", () => {
    expect(KEQING_SYSTEM_PROMPT).toContain("Keqing");
    expect(KEQING_LOVED_USER_ID).toBe("330320305606230016");
    expect(KEQING_LOVED_USER_NAME_PATTERN.test("Bayu")).toBe(true);
    expect(KEQING_LOVED_USER_CONTEXT).toContain("Special context");
    expect(KEQING_RELATIONSHIP_CONTEXT).toContain("Relationship context");
  });
});
