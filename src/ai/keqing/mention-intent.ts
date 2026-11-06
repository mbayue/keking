/**
 * Detects that the user asked Keking to address someone else.
 *
 * A mention is request-driven: "@keking sapa @iris" should ping Iris, while a
 * plain question that happens to mention someone should not.
 */

const ADDRESS_REQUEST =
  /\b(sapa|salam|greet|greets|menyapa|menyalami|tolong (sapa|bilang|salam)|bilang (ke|kepada) dia|tell (him|her|them)|say (hi|hello|salam) to|bikin (salam|balas))\b/i;

export function wantsMention(content: string): boolean {
  return ADDRESS_REQUEST.test(content);
}
