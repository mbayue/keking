const IMAGE_VERB = /\b(generate|create|make|draw|paint|imagine|buatkan|buat|gambarkan)\b/i;
const IMAGE_NOUN = /\b(image|picture|photo|art|illustration|gambar|foto|ilustrasi)\b/i;
const DIRECT_DRAW_VERB = /\b(draw|paint|gambarkan)\b/i;
const QUESTION_START = /^\s*(what|how|why|describe|explain|apa|jelaskan|bagaimana)\b/i;
const DISCORD_MENTION = /<@!?\d+>|<@&\d+>/g;
const PLAIN_MENTION = /@[\w.-]+(?:\s+[\w.-]+)?/g;

const SELF_PORTRAIT_PROMPT =
  "Keqing from Genshin Impact, anime girl, long purple hair, purple eyes, purple hair ornament, white and purple outfit, confident playful expression, tongue out, upper body portrait, anime style, no hat";

const PHRASE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/\bnaga hitam\b/gi, "black dragon"],
  [/\bnaga\b/gi, "dragon"],
  [/\bhitam\b/gi, "black"],
  [/\bputih\b/gi, "white"],
  [/\bmerah\b/gi, "red"],
  [/\bbiru\b/gi, "blue"],
  [/\bhijau\b/gi, "green"],
  [/\bkucing\b/gi, "cat"],
  [/\banjing\b/gi, "dog"],
  [/\bburung\b/gi, "bird"],
  [/\bgunung\b/gi, "mountain"],
  [/\blaut\b/gi, "sea"],
  [/\bgambar kamu\b|\bfoto kamu\b|\bdirimu\b|\bdiri kamu\b|\bkamu\b/gi, "Keqing from Genshin Impact"],
  [/\byang seperti itu\b|\byg seperti itu\b|\bseperti itu\b|\byg seperti ini\b|\bseperti ini\b/gi, "in the style of the referenced image"],
];

function describeReferenceStyle(reference: string): string[] {
  const text = reference.toLowerCase();
  const traits: string[] = [];

  if (/rambut panjang|long hair/.test(text)) traits.push("long hair");
  if (/menggoda|playful|flirty/.test(text)) traits.push("playful expression");
  if (/lidah|tongue/.test(text)) traits.push("tongue out");
  if (/hitam putih|monokrom|sketch|line art/.test(text)) traits.push("monochrome anime sketch style");

  return traits;
}

function translateImagePrompt(value: string): string {
  let translated = value;
  for (const [pattern, replacement] of PHRASE_TRANSLATIONS) {
    translated = translated.replace(pattern, replacement);
  }
  return translated;
}

export function isImageGenerationRequest(text: string): boolean {
  if (QUESTION_START.test(text)) {
    return false;
  }

  return DIRECT_DRAW_VERB.test(text) || (IMAGE_VERB.test(text) && IMAGE_NOUN.test(text));
}

export function extractImagePrompt(text: string): string {
  const normalized = text
    .replace(DISCORD_MENTION, " ")
    .replace(PLAIN_MENTION, " ")
    .replace(/\s+/g, " ")
    .trim();

  const cleaned = normalized
    .replace(/^(?:can you|could you|please|tolong|coba|bisa|boleh)\s+/i, "")
    .replace(
      /^(?:generate|create|make|draw|paint|imagine|buatkan|buat|gambarkan)\s+(?:an?\s+|the\s+)?(?:image|picture|photo|art|illustration|gambar|foto|ilustrasi)\s*(?:of|about|tentang|dari|:)?\s*/i,
      "",
    )
    .replace(/^(?:draw|paint|gambarkan)\s+/i, "")
    .replace(/\s+(?:untuk|for|buat|to)\s*$/i, "")
    .trim();

  return translateImagePrompt(cleaned || normalized || text.trim());
}

export function buildImagePrompt(text: string, referenceContext?: string | null): string {
  if (/\bdirimu\b|\bdiri kamu\b|\bgambar kamu\b|\bfoto kamu\b|\bkamu\b|\byourself\b/i.test(text)) {
    return [
      SELF_PORTRAIT_PROMPT,
      ...describeReferenceStyle(referenceContext ?? ""),
    ].join(", ");
  }

  const base = extractImagePrompt(text);
  const reference = referenceContext
    ?.split("\n")
    .find((line) => line.startsWith("Content:"))
    ?.slice("Content:".length)
    .trim();

  return [base, reference ? `Reference style: ${reference.slice(0, 500)}` : ""]
    .filter(Boolean)
    .join(". ");
}
