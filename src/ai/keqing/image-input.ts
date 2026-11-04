import type { Message } from "discord.js";

import type { ChatContentPart } from "./completion.js";

export const MAX_IMAGE_COUNT = 3;
export const MAX_IMAGE_BYTES = 5_000_000;

const ALLOWED_IMAGE_TYPES: Record<string, true> = {
  "image/png": true,
  "image/jpeg": true,
  "image/webp": true,
  "image/gif": true,
};

export async function buildImageParts(message: Message): Promise<ChatContentPart[]> {
  const parts: ChatContentPart[] = [];

  for (const attachment of message.attachments.values()) {
    if (parts.length >= MAX_IMAGE_COUNT) {
      break;
    }

    const contentType = attachment.contentType;
    if (
      !contentType ||
      !ALLOWED_IMAGE_TYPES[contentType] ||
      attachment.size > MAX_IMAGE_BYTES
    ) {
      continue;
    }

    parts.push({
      type: "image_url",
      image_url: { url: attachment.url },
    });
  }

  return parts;
}
