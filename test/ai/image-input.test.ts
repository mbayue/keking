import { describe, expect, test } from "bun:test";
import type { Message } from "discord.js";

import {
  MAX_IMAGE_BYTES,
  buildImageParts,
} from "../../src/ai/keqing/image-input.ts";

type FakeAttachment = {
  contentType: string | null;
  size: number;
  url: string;
};

function makeMessage(attachments: FakeAttachment[]): Message {
  return {
    attachments: {
      values: () => attachments.values(),
    },
  } as unknown as Message;
}

describe("buildImageParts", () => {
  test("passes allowed image URLs to the vision model", async () => {
    const parts = await buildImageParts(makeMessage([
      { contentType: "image/png", size: 3, url: "https://cdn.test/a.png" },
    ]));

    expect(parts).toEqual([{
      type: "image_url",
      image_url: { url: "https://cdn.test/a.png" },
    }]);
  });

  test("skips unsupported and oversized images", async () => {
    const parts = await buildImageParts(makeMessage([
      { contentType: "application/pdf", size: 10, url: "https://cdn.test/a.pdf" },
      { contentType: "image/png", size: MAX_IMAGE_BYTES + 1, url: "https://cdn.test/large.png" },
    ]));

    expect(parts).toEqual([]);
  });

  test("caps the number of images", async () => {
    const parts = await buildImageParts(makeMessage(
      Array.from({ length: 4 }, (_, index) => ({
        contentType: "image/png",
        size: 1,
        url: `https://cdn.test/${index}.png`,
      })),
    ));

    expect(parts).toHaveLength(3);
  });
});
