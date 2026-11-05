import { Readable } from "node:stream";
import {
  incrementCounter,
  observeDuration,
} from "../observability/metrics.js";


const GOOGLE_TTS_HOST = "https://translate.google.com";
const GOOGLE_TTS_LANGUAGE = "id";
const GOOGLE_TTS_TIMEOUT_MS = 10_000;
const MAX_TEXT_CHARS = 5_000;
const MAX_CHUNK_CHARS = 200;

type BatchExecuteResponse = Array<[unknown, unknown, string?]>;

async function getAudioBase64(text: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(controller.abort.bind(controller), GOOGLE_TTS_TIMEOUT_MS);

  const startedAt = performance.now();
  try {
    const response = await fetch(`${GOOGLE_TTS_HOST}/_/TranslateWebserverUi/data/batchexecute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `f.req=${encodeURIComponent(JSON.stringify([
        [["jQ1olc", JSON.stringify([text, GOOGLE_TTS_LANGUAGE, null, "null"]), null, "generic"]],
      ]))}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      incrementCounter("keking_tts_requests_total", { provider: "google", status: `http_${response.status}` });
      throw new Error(`Google TTS request failed with status ${response.status}`);
    }


    const data = await response.text();
    let parsed: BatchExecuteResponse;
    try {
      parsed = JSON.parse(data.slice(5)) as BatchExecuteResponse;
    } catch {
      throw new Error("Google TTS returned an unreadable response.");
    }

    const encoded = parsed[0]?.[2];
    if (typeof encoded !== "string") {
      throw new Error(`Google TTS has no audio for language "${GOOGLE_TTS_LANGUAGE}".`);
    }

    const decoded = JSON.parse(encoded) as unknown;
    if (!Array.isArray(decoded) || typeof decoded[0] !== "string") {
      throw new Error("Google TTS returned an unexpected payload.");
    }

    const result = decoded[0];
    incrementCounter("keking_tts_requests_total", { provider: "google", status: "ok" });
    observeDuration("keking_tts_request_duration_seconds", (performance.now() - startedAt) / 1000, { provider: "google", status: "ok" });
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

function splitText(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_CHUNK_CHARS) {
    let splitAt = -1;
    for (let index = MAX_CHUNK_CHARS - 1; index >= 0; index -= 1) {
      const char = remaining[index];
      if (char && /[\s,.;:!?]/.test(char)) {
        splitAt = index + 1;
        break;
      }
    }

    if (splitAt <= 0) {
      splitAt = MAX_CHUNK_CHARS;
    }

    const chunk = remaining.slice(0, splitAt).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

export async function synthesizeGoogleSpeech(text: string): Promise<Readable> {
  const trimmed = text.trim().slice(0, MAX_TEXT_CHARS);
  if (!trimmed) {
    throw new Error("No text to synthesize.");
  }

  const chunks = splitText(trimmed);
  const buffers = await Promise.all(
    chunks.map(async (chunk) => Buffer.from(await getAudioBase64(chunk), "base64")),
  );

  return Readable.from([Buffer.concat(buffers)]);
}
