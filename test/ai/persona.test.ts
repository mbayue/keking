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

  test("follows the Soul schema", () => {
    expect(KEQING_SYSTEM_PROMPT.startsWith("# Soul")).toBe(true);
    expect(KEQING_SYSTEM_PROMPT).toContain("## Basic Identity");
    expect(KEQING_SYSTEM_PROMPT).toContain("## Core Temperament");
    expect(KEQING_SYSTEM_PROMPT).toContain("## Outer Style");
    expect(KEQING_SYSTEM_PROMPT).toContain("## Language System");
    expect(KEQING_SYSTEM_PROMPT).toContain("## Action Logic");
    expect(KEQING_SYSTEM_PROMPT).toContain("## Hidden Traits");
    expect(KEQING_SYSTEM_PROMPT).toContain("## Boundaries");
  });

  test("keeps the prompt compact", () => {
    // The mention rules cost ~200 chars. The prompt was 6364 before them and
    // stays well under the original 7633, so it is still a net reduction.
    expect(KEQING_SYSTEM_PROMPT.length).toBeLessThan(6_700);
  });

  test("states hidden traits rather than only surface rules", () => {
    const hidden = KEQING_SYSTEM_PROMPT.split("## Hidden Traits")[1] ?? "";
    expect(hidden).toContain("composure hides real care");
    expect(hidden).toContain("remembering what people told her");
  });

  test("anchors the reply language to the conversation, not the last message", () => {
    expect(KEQING_SYSTEM_PROMPT).toContain("whole conversation");
    expect(KEQING_SYSTEM_PROMPT).not.toContain("mirror the language they use");
  });

  test("forbids echoing the user's words back as the answer", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/Never echoes the user.s words back/i);
  });

  test("forbids announcing what the bot was asked to do", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/what it is about to do/i);
  });

  test("forbids talking about itself as a bot or a persona", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/talks about itself as a system/i);
    expect(KEQING_SYSTEM_PROMPT).toMatch(/never analyze the criticism/i);
  });

  test("bans corporate Indonesian and markdown emphasis", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/ada yang perlu ditangani/i);
    expect(KEQING_SYSTEM_PROMPT).toMatch(/markdown emphasis/i);
  });

  test("bans borrowed English jargon", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/English jargon/i);
  });

  test("keeps replies in Indonesian when the user mixes English in", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/translating rather than copying/i);
  });

  test("bans reflective essays and motivational advice", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/reflective essay/i);
    expect(KEQING_SYSTEM_PROMPT).toMatch(/The longer the user's message, the shorter/i);
  });

  test("pins the self-reference pronoun to aku", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/never "kuring", "gw", or "saya"/i);
  });

  test("allows a one-line model identity answer without boasting", () => {
    expect(KEQING_SYSTEM_PROMPT).toMatch(/what model it runs on/i);
  });
});
