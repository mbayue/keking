const EMOJI_SEQUENCE = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu;
const EMOJI_MODIFIERS = /[\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}]/gu;

export function stripReasoning(value: string): string {
  return value
    .replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .replace(/<think(?:ing)?\b[^>]*>[\s\S]*$/i, "")
    .replace(/<\/?think(?:ing)?\b[^>]*>/gi, "")
    .trim();
}

export function stripEmojis(value: string): string {
  return value
    .replace(EMOJI_SEQUENCE, "")
    .replace(EMOJI_MODIFIERS, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}
