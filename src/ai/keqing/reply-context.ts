import type { Message } from "discord.js";

export const MAX_QUOTE_CONTENT_CHARS = 1_000;

export function buildReplyContext(message: Message): string | null {
  const content = message.content.trim().slice(0, MAX_QUOTE_CONTENT_CHARS);
  const attachments = [...message.attachments.values()]
    .slice(0, 5)
    .map((attachment) => attachment.contentType ?? attachment.name ?? "file");
  const embeds = message.embeds
    .slice(0, 3)
    .flatMap((embed) => {
      const parts = [embed.title?.trim(), embed.description?.trim()]
        .filter((part): part is string => Boolean(part));
      return parts.length > 0 ? [parts.join(" — ").slice(0, 400)] : [];
    });

  if (!content && attachments.length === 0 && embeds.length === 0) {
    return null;
  }

  const lines = [
    `Author: ${message.author.username} (${message.author.id})${message.author.bot ? " [bot]" : ""}`,
  ];
  if (content) {
    lines.push(`Content: ${content}`);
  }
  if (attachments.length > 0) {
    lines.push(`Attachments: ${attachments.join(", ")}`);
  }
  if (embeds.length > 0) {
    lines.push(`Embeds: ${embeds.join(" | ")}`);
  }

  return lines.join("\n");
}
