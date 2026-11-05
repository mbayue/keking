import { config } from "../../config.js";
import {
  incrementCounter,
  observeDuration,
} from "../../observability/metrics.js";


const MAX_PROMPT_CHARS = 1_000;

export type GeneratedImage = {
  buffer: Buffer;
  mimeType: string;
};

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const trimmed = prompt.trim().slice(0, MAX_PROMPT_CHARS);
  if (!trimmed) {
    throw new Error("No image prompt provided.");
  }
  const startedAt = performance.now();
  const model = config.aiImageModel;

  const response = await fetch(`${config.aiBaseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.aiApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: trimmed,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    incrementCounter("keking_image_requests_total", { model, status: `http_${response.status}` });
    observeDuration("keking_image_request_duration_seconds", (performance.now() - startedAt) / 1000, { model, status: `http_${response.status}` });
    throw new Error(`Image request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const encoded = payload.data?.[0]?.b64_json;
  if (!encoded) {
    incrementCounter("keking_image_requests_total", { model, status: "no_image" });
    observeDuration("keking_image_request_duration_seconds", (performance.now() - startedAt) / 1000, { model, status: "no_image" });
    throw new Error("Image response contained no image.");
  }
  incrementCounter("keking_image_requests_total", { model, status: "ok" });
  observeDuration("keking_image_request_duration_seconds", (performance.now() - startedAt) / 1000, { model, status: "ok" });

  const buffer = Buffer.from(encoded, "base64");
  incrementCounter("keking_image_bytes_total", { model }, buffer.length);

  return {
    buffer,
    mimeType: "image/png",
  };
}
