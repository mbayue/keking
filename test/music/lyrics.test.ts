import { describe, expect, test } from "bun:test";

import { fetchLyrics } from "../../src/music/lyrics.ts";

describe("lyrics", () => {
  test("returns lyrics and metadata", async () => {
    const result = await fetchLyrics("query", {
      songs: {
        search: async () => [{
          title: "Song",
          artist: { name: "Artist" },
          lyrics: async () => "la la",
        }],
      },
    });

    expect(result).toEqual({ lyrics: "la la", title: "Song", artist: "Artist" });
  });

  test("returns null when no song matches", async () => {
    const result = await fetchLyrics("query", {
      songs: { search: async () => [] },
    });
    expect(result).toBeNull();
  });

  test("uses fallback text for missing fields", async () => {
    const result = await fetchLyrics("query", {
      songs: {
        search: async () => [{
          artist: {},
          lyrics: async () => "",
        }],
      },
    });

    expect(result).toEqual({
      lyrics: "No lyrics found.",
      title: "Unknown",
      artist: "Unknown",
    });
  });

  test("returns null on lookup failure", async () => {
    const result = await fetchLyrics("query", {
      songs: {
        search: async () => {
          throw new Error("genius down");
        },
      },
    });
    expect(result).toBeNull();
  });
});
