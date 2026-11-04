import { Readable } from "node:stream";

import {
  BaseExtractor,
  Track,
  Util,
  type ExtractorInfo,
  type ExtractorSearchContext,
} from "discord-player";

import { isElevenLabsConfigured, synthesizeElevenLabsSpeech } from "./elevenlabs-tts.js";
import { synthesizeGoogleSpeech } from "./google-tts.js";

const TTS_QUERY_PREFIX = "tts:";

export class KekingTTSExtractor extends BaseExtractor {
  static readonly identifier = "com.keking.tts";

  activate(): Promise<void> {
    this.protocols = ["tts"];
    return Promise.resolve();
  }

  deactivate(): Promise<void> {
    this.protocols = [];
    return Promise.resolve();
  }

  validate(query: string): Promise<boolean> {
    return Promise.resolve(typeof query === "string" && query.startsWith(TTS_QUERY_PREFIX));
  }

  handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    const text = query.slice(TTS_QUERY_PREFIX.length).trim();
    if (!text) {
      return Promise.resolve(this.createResponse(null, []));
    }

    const provider = isElevenLabsConfigured() ? "ElevenLabs" : "Google Translate";
    const trackInfo = {
      title: "TTS",
      author: provider,
      duration: 0,
      description: text,
      thumbnail: "",
      raw: { text },
    };

    const track = new Track(this.context.player, {
      title: trackInfo.title,
      duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration)),
      url: "tts://keking",
      description: trackInfo.description,
      thumbnail: trackInfo.thumbnail,
      views: 0,
      author: trackInfo.author,
      requestedBy: context.requestedBy,
      source: "arbitrary",
      metadata: trackInfo,
      query,
      // @ts-expect-error queryType is not in the type definition
      queryType: "tts",
      raw: trackInfo.raw,
      requestMetadata: () => Promise.resolve(trackInfo),
    });

    track.extractor = this;
    return Promise.resolve(this.createResponse(null, [track]));
  }

  stream(track: Track): Promise<Readable> {
    const raw = track.raw;
    const text =
      typeof raw === "object" && raw !== null && "text" in raw && typeof raw.text === "string"
        ? raw.text
        : track.description ?? "";

    return isElevenLabsConfigured()
      ? synthesizeElevenLabsSpeech(text)
      : synthesizeGoogleSpeech(text);
  }

  getRelatedTracks(): Promise<ExtractorInfo> {
    return Promise.resolve(this.createResponse(null, []));
  }
}
