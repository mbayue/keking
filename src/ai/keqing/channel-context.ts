import type { Message } from "discord.js";

export const MAX_CHANNEL_MESSAGES = 50;
export const MAX_CHANNEL_CONTEXT_CHARS = 6_000;
export const MAX_CHANNEL_MESSAGE_CHARS = 400;

const SUMMARY_INTENT =
  /\b(summarize|summarise|summary|recap|ringkas|rangkum|rangkuman|kesimpulan|what happened|what's going on|whats going on|apa yang terjadi)\b/i;
const CHANNEL_SCOPE =
  /\b(channel|chat|conversation|percakapan|obrolan|diskusi|thread|history|riwayat|messages|pesan|here|ini)\b/i;
const DIRECT_CONTEXT_INTENT = /\b(what did i miss|catch me up|fill me in|apa yang terlewat)\b/i;

export function wantsChannelContext(content: string): boolean {
  return (
    DIRECT_CONTEXT_INTENT.test(content) ||
    (SUMMARY_INTENT.test(content) && CHANNEL_SCOPE.test(content))
  );
}

export function formatChannelContext(messages: Iterable<Message>): string | null {
  const lines: string[] = [];

  for (const message of Array.from(messages).reverse()) {
    const content = message.content.trim().replace(/\s+/g, " ").slice(0, MAX_CHANNEL_MESSAGE_CHARS);
    const extras: string[] = [];

    if (message.attachments.size > 0) {
      extras.push(`[${message.attachments.size} attachment(s)]`);
    }
    if (message.embeds.length > 0) {
      extras.push(`[${message.embeds.length} embed(s)]`);
    }
    if (!content && extras.length === 0) {
      continue;
    }

    const author = message.author.bot
      ? `${message.author.username} [bot]`
      : message.author.username;
    const body = [content, ...extras].filter(Boolean).join(" ");
    lines.push(`${author}: ${body}`);
  }

  let output = "";
  for (const line of lines) {
    const next = output ? `${output}\n${line}` : line;
    if (next.length > MAX_CHANNEL_CONTEXT_CHARS) {
      break;
    }
    output = next;
  }

  return output || null;
}
