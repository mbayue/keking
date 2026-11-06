/**
 * Detects that the user asked Keking to address someone else.
 *
 * A mention is request-driven: "@keking sapa @iris" should ping Iris, while a
 * plain question that happens to mention someone should not.
 */

const ADDRESS_REQUEST =
  /\b(mention|mentions|mentioned|sapa|salam|greet|greets|menyapa|menyalami|tolong (sapa|bilang|salam)|bilang (ke|kepada) dia|tell (him|her|them)|say (hi|hello|salam) to|bikin (salam|balas))\b/i;

/** "jangan mention", "no need to mention it" — asking not to tag, not to tag. */
const NEGATED_REQUEST =
  /\b(jangan|janganlah|ga ada|gapapa|nggak?(?: perlu)?)\b[^.?!]{0,20}\b(mention|sapa|salam|bilang|tell|say)\b/i;

export function wantsMention(content: string): boolean {
  if (NEGATED_REQUEST.test(content)) {
    return false;
  }
  return ADDRESS_REQUEST.test(content);
}
