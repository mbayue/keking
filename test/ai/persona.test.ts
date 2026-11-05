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

  test("anchors the reply language to the conversation, not the last message", () => {
    expect(KEQING_SYSTEM_PROMPT).toContain("whole conversation");
    expect(KEQING_SYSTEM_PROMPT).not.toContain("mirror the language they use");
  });

  test("forbids echoing the user's words back as the answer", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/echo, or paraphrase/i);
  });

  test("forbids announcing what the bot was asked to do", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/what you are about to do/i);
  });

  test("forbids a stock self-introduction and slang mimicry", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/stock self-introduction/i);
    expect(KEQING_SYSTEM_PROMPT).toMatch(/No slang or street speak/i);
  });

  test("pins the self-reference pronoun to aku", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/Always "aku"/);
  });

  test("allows a one-line model identity answer without boasting", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/what model or version you run on/i);
  });
});
