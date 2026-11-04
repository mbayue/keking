import { Client as GeniusClient } from "genius-lyrics";

export interface LyricsResult {
  lyrics: string;
  title: string;
  artist: string;
}

type GeniusSong = {
  title?: string;
  artist?: { name?: string };
  lyrics: () => Promise<string>;
};

type LyricsClient = {
  songs: {
    search: (query: string) => Promise<GeniusSong[]>;
  };
};

export async function fetchLyrics(
  query: string,
  client: LyricsClient = new GeniusClient() as unknown as LyricsClient,
): Promise<LyricsResult | null> {
  try {
    const songs = await client.songs.search(query);
    const song = songs[0];
    if (!song) {
      return null;
    }

    const lyrics = await song.lyrics();
    return {
      lyrics: lyrics || "No lyrics found.",
      title: song.title || "Unknown",
      artist: song.artist?.name || "Unknown",
    };
  } catch (error) {
    console.error("Lyrics error:", error);
    return null;
  }
}
