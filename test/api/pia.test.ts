import { afterEach, describe, expect, test } from "bun:test";

import { searchNovels } from "../../src/api/pia.ts";

const originalFetch = globalThis.fetch;

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function item(overrides: {
  writerList?: Array<{ flag_type: number; writer_name: string }>;
  image?: string;
  adult?: number;
  complete?: number;
} = {}) {
  return {
    novel: {
      novel_no: 7,
      novel_name: "Novel",
      novel_story: "Story",
      novel_img: overrides.image ?? "//cdn.example/cover.jpg",
      count_view: 10,
      count_like: 20,
      count_epi: 30,
      flag_adult: overrides.adult ?? 1,
      flag_complete: overrides.complete ?? 1,
      novel_locale: "id",
      new_epi_open_dt: "2026-01-01",
    },
    tag_list: [{ tag_name: "fantasy" }, { tag_name: "drama" }],
    writer_list: overrides.writerList ?? [
      { flag_type: 1, writer_name: "Secondary" },
      { flag_type: 0, writer_name: "Primary" },
    ],
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("searchNovels", () => {
  test("maps a successful response", async () => {
    let requestedUrl = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return response({ code: "0000", errmsg: "", result: { list: [item()] } });
    }) as typeof fetch;

    const novels = await searchNovels("keqing", 2);

    expect(novels).toEqual([{
      id: 7,
      title: "Novel",
      description: "Story",
      imageUrl: "https://cdn.example/cover.jpg",
      views: 10,
      likes: 20,
      episodes: 30,
      isAdult: true,
      isComplete: true,
      locale: "id",
      author: "Primary",
      updatedAt: "2026-01-01",
      tags: ["fantasy", "drama"],
      url: "https://global.novelpia.com/novel/7",
    }]);
    expect(requestedUrl).toContain("page=2");
  });

  test("preserves absolute image URLs", async () => {
    globalThis.fetch = (async () => response({
      code: "0000",
      errmsg: "",
      result: { list: [item({ image: "https://cdn.example/absolute.jpg" })] },
    })) as typeof fetch;

    const [novel] = await searchNovels("query");
    expect(novel?.imageUrl).toBe("https://cdn.example/absolute.jpg");
  });

  test("uses the first writer when no primary writer exists", async () => {
    globalThis.fetch = (async () => response({
      code: "0000",
      errmsg: "",
      result: {
        list: [item({ writerList: [{ flag_type: 1, writer_name: "First" }], adult: 0, complete: 0 })],
      },
    })) as typeof fetch;

    const [novel] = await searchNovels("query");
    expect(novel?.author).toBe("First");
    expect(novel?.isAdult).toBe(false);
    expect(novel?.isComplete).toBe(false);
  });

  test("falls back to Unknown for an empty writer list", async () => {
    globalThis.fetch = (async () => response({
      code: "0000",
      errmsg: "",
      result: { list: [item({ writerList: [] })] },
    })) as typeof fetch;

    const [novel] = await searchNovels("query");
    expect(novel?.author).toBe("Unknown");
  });

  test("returns an empty list when the result has no list", async () => {
    globalThis.fetch = (async () => response({ code: "0000", errmsg: "" })) as typeof fetch;
    await expect(searchNovels("query")).resolves.toEqual([]);
  });

  test("throws on an API error code", async () => {
    globalThis.fetch = (async () => response({ code: "E1", errmsg: "Nope" })) as typeof fetch;
    await expect(searchNovels("query")).rejects.toThrow("Nope");
  });

  test("throws a fallback error when errmsg is empty", async () => {
    globalThis.fetch = (async () => response({ code: "E2", errmsg: "" })) as typeof fetch;
    await expect(searchNovels("query")).rejects.toThrow("NovelPia returned error code E2");
  });

  test("throws on HTTP failure", async () => {
    globalThis.fetch = (async () => response({}, 500)) as typeof fetch;
    await expect(searchNovels("query")).rejects.toThrow("NovelPia request failed with status 500");
  });
});
