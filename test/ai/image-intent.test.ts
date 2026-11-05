import { describe, expect, test } from "bun:test";

import {
  buildImagePrompt,
  extractImagePrompt,
  isImageGenerationRequest,
} from "../../src/ai/keqing/image-intent.ts";

describe("image intent", () => {
  test("detects image generation requests", () => {
    expect(isImageGenerationRequest("generate an image of a cat")).toBe(true);
    expect(isImageGenerationRequest("can you make a picture of a cat?")).toBe(true);
    expect(isImageGenerationRequest("buatkan gambar kucing")).toBe(true);
    expect(isImageGenerationRequest("draw a blue apple")).toBe(true);
  });

  test("does not treat image questions as generation", () => {
    expect(isImageGenerationRequest("what is in this image?")).toBe(false);
    expect(isImageGenerationRequest("describe this picture")).toBe(false);
    expect(isImageGenerationRequest("hello")).toBe(false);
  });

  test("extracts the image prompt", () => {
    expect(extractImagePrompt("generate an image of a cat")).toBe("a cat");
    expect(extractImagePrompt("can you make a picture of a cat?")).toBe("a cat?");
    expect(extractImagePrompt("draw a blue apple")).toBe("a blue apple");
    expect(extractImagePrompt("buatkan gambar kucing")).toBe("cat");
  });

  test("removes the target mention and translates Indonesian concepts", () => {
    expect(
      extractImagePrompt("buatkan gambar naga hitam untuk <@123456789>"),
    ).toBe("black dragon");
    expect(
      extractImagePrompt("generate an image of a black dragon for <@123456789>"),
    ).toBe("a black dragon");
  });

  test("maps self-reference and reference style phrases", () => {
    expect(
      extractImagePrompt("coba buatkan gambar dirimu yg seperti itu"),
    ).toBe("Keqing from Genshin Impact in the style of the referenced image");
    expect(
      extractImagePrompt("coba buat gambar kamu yg seperti ini <@123456789>"),
    ).toBe("Keqing from Genshin Impact in the style of the referenced image");
  });

  test("builds a canonical self-image prompt with reference traits", () => {
    const prompt = buildImagePrompt(
      "coba buatkan gambar dirimu yg seperti itu",
      "Author: Keking\nContent: gadis anime berambut panjang, ekspresi menggoda, menjulurkan lidah, sketsa hitam putih",
    );

    expect(prompt).toContain("Keqing from Genshin Impact");
    expect(prompt).toContain("long purple hair");
    expect(prompt).toContain("long hair");
    expect(prompt).toContain("playful expression");
    expect(prompt).toContain("tongue out");
    expect(prompt).toContain("monochrome anime sketch style");
    expect(prompt).not.toContain("gadis anime berambut panjang");
  });

  test("keeps reference text for non-self image prompts", () => {
    expect(
      buildImagePrompt(
        "generate an image of a cat",
        "Author: Keking\nContent: cute fluffy cat",
      ),
    ).toBe("a cat. Reference style: cute fluffy cat");
  });

  test("translates common Indonesian subjects, colors, and places", () => {
    expect(extractImagePrompt("buatkan gambar pedang elektro ungu")).toBe(
      "sword electro purple",
    );
    expect(extractImagePrompt("gambar kucing biru di taman")).toBe(
      "gambar cat blue in garden",
    );
    expect(extractImagePrompt("gambar kota di malam hari")).toBe(
      "gambar city in malam hari",
    );
    expect(extractImagePrompt("gambar pedang di meja batu")).toBe(
      "gambar sword in table stone",
    );
  });

  test("keeps multi-word translations intact", () => {
    expect(extractImagePrompt("gambar naga hitam")).toBe("gambar black dragon");
  });

  test("falls back to the full text when extraction is empty", () => {
    expect(extractImagePrompt("make an image")).toBe("make an image");
  });
});
