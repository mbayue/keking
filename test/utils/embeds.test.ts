import { describe, expect, test } from "bun:test";

import { createErrorEmbed, createInfoEmbed } from "../../src/utils/embeds.ts";

describe("embed helpers", () => {
  test("creates an info embed with description and fields", () => {
    const json = createInfoEmbed({
      title: "Title",
      description: "Description",
      fields: [{ name: "Field", value: "Value" }],
    }).toJSON();

    expect(json.color).toBe(0x4f46e5);
    expect(json.title).toBe("Title");
    expect(json.description).toBe("Description");
    expect(json.fields).toEqual([{ name: "Field", value: "Value" }]);
    expect(typeof json.timestamp).toBe("string");
  });

  test("creates an info embed without optional content", () => {
    const json = createInfoEmbed({ title: "Title" }).toJSON();
    expect(json.description).toBeUndefined();
    expect(json.fields).toBeUndefined();
  });

  test("creates an error embed", () => {
    const json = createErrorEmbed("Error", "Something failed").toJSON();
    expect(json.color).toBe(0xdc2626);
    expect(json.title).toBe("Error");
    expect(json.description).toBe("Something failed");
    expect(typeof json.timestamp).toBe("string");
  });
});
