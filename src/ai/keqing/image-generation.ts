import { config } from "../../config.js";

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

  const response = await fetch(`${config.aiBaseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.aiApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: config.aiImageModel,
      prompt: trimmed,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    throw new Error(`Image request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const encoded = payload.data?.[0]?.b64_json;
  if (!encoded) {
    throw new Error("Image response contained no image.");
  }

  return {
    buffer: Buffer.from(encoded, "base64"),
    mimeType: "image/png",
  };
}
