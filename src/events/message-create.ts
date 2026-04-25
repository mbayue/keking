import { Events, MessageFlags, type Message } from "discord.js";

import type { BotEvent } from "../structures/event.js";
import { extractSocialMirrorLinks } from "../utils/social-preview.js";

async function previewSocialLinks(message: Message): Promise<void> {
  if (!message.inGuild() || message.author.bot) {
    return;
  }

  const links = extractSocialMirrorLinks(message.content);

  if (links.length === 0) {
    return;
  }

  const previewContent = links.join("\n").slice(0, 1900);

  await message.reply({
    content: previewContent,
    allowedMentions: {
      repliedUser: false,
    },
    flags: MessageFlags.SuppressNotifications,
  });

  await message.suppressEmbeds(true).catch(() => null);
}

export const event: BotEvent = {
  name: Events.MessageCreate,
  execute(message) {
    return previewSocialLinks(message as Message);
  },
};
