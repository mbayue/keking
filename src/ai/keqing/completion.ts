import { config } from "../../config.js";

export const MAX_REPLY_CHARS = 400;

const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 1_000;

export type ChatRole = "system" | "user" | "assistant";

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: ChatRole;
  content: string | ChatContentPart[];
};

export async function requestCompletion(
  messages: ChatMessage[],
  model: string = config.aiModel,
): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${config.aiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.aiApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: config.aiMaxTokens,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await Bun.sleep(RETRY_DELAY_MS);
        continue;
      }
      break;
    }

    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        await Bun.sleep(RETRY_DELAY_MS);
        continue;
      }

      throw new Error(`AI request failed with status ${response.status}.`);
    }

    const payload: unknown = await response.json().catch(() => null);
    const content = readAssistantContent(payload);
    if (!content) {
      throw new Error("AI response contained no text.");
    }

    return content;
  }

  throw lastError instanceof Error ? lastError : new Error("AI request failed.");
}

export async function requestCompletionWithFallback(
  messages: ChatMessage[],
  models: string[],
): Promise<string> {
  let lastError: unknown = null;

  for (const model of [...new Set(models.filter(Boolean))]) {
    try {
      return await requestCompletion(messages, model);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI request failed.");
}

export function limitReply(reply: string): string {
  const normalized = reply.trim();
  if (normalized.length <= MAX_REPLY_CHARS) {
    return normalized;
  }

  const clipped = normalized.slice(0, MAX_REPLY_CHARS);
  let boundary = -1;
  for (const match of clipped.matchAll(/[.!?](?=\s|$)/g)) {
    boundary = (match.index ?? 0) + 1;
  }

  if (boundary >= MAX_REPLY_CHARS * 0.5) {
    return clipped.slice(0, boundary).trim();
  }

  return `${clipped.trimEnd()}…`;
}

function readAssistantContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("choices" in payload)) {
    return null;
  }

  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const first = choices[0];
  if (typeof first !== "object" || first === null || !("message" in first)) {
    return null;
  }

  const message = first.message;
  if (typeof message !== "object" || message === null || !("content" in message)) {
    return null;
  }

  const content = message.content;
  if (typeof content === "string") {
    return content.trim() || null;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part !== "object" || part === null || !("text" in part)) {
          return "";
        }
        return typeof part.text === "string" ? part.text : "";
      })
      .join("")
      .trim();
    return text || null;
  }

  return null;
}
