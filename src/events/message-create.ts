import { Events, MessageFlags, PermissionFlagsBits, type Message } from "discord.js";

import type { BotEvent } from "../structures/event.js";
import { extractSocialMirrorLinks } from "../utils/social-preview.js";
import {
  MissingBotPermissionsError,
  assertBotHasChannelPermissions,
  createMissingPermissionsMessage,
} from "../utils/permissions.js";
import { isSocialPreviewEnabled } from "../db/postgres.js";
import { config } from "../config.js";

const mentionReplies = [
  "iya beb",
  "iya sayang",
  "apa beb",
  "apa sayang",
];

async function handleMentionReply(message: Message): Promise<boolean> {
  if (!message.inGuild() || message.author.bot) {
    return false;
  }

  const botId = message.client.user?.id;
  const authorId = message.author.id;

  if (!botId || authorId !== config.botOwnerId) {
    return false;
  }

  if (!message.mentions.has(botId, { ignoreEveryone: true })) {
    return false;
  }

  const index = Math.floor(Math.random() * mentionReplies.length);
  const reply = mentionReplies[index] ?? "iya beb";

  await message.reply({
    content: reply,
    allowedMentions: {
      repliedUser: false,
    },
  });

  return true;
}

async function previewSocialLinks(message: Message): Promise<void> {
  if (!message.inGuild() || message.author.bot) {
    return;
  }

  // Fail-secure: If database query fails, we default to disabled (no previews)
  try {
    const isEnabled = await isSocialPreviewEnabled(message.guild.id);
    if (!isEnabled) {
      return;
    }
  } catch (error) {
    console.error("[SOCIAL PREVIEW] Failed to check database setting (failing secure):", error);
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

  try {
    const me = message.guild.members.me;
    if (me) {
      assertBotHasChannelPermissions(
        message.channel,
        me,
        [PermissionFlagsBits.ManageMessages],
      );
      await message.suppressEmbeds(true);
    }
  } catch (permsError) {
    console.warn("[SOCIAL PREVIEW] Could not suppress embeds:", permsError);
  }
}

export const event: BotEvent = {
  name: Events.MessageCreate,
  async execute(message) {
    const msg = message as Message;
    // return handleMentionReply(msg)
    //   .then((handled) => {
    // if (!handled) {
    try {
      return await previewSocialLinks(msg);
    } catch (error) {
      console.error("MessageCreate handler failed:", error);

      if (error instanceof MissingBotPermissionsError && msg.inGuild()) {
        await msg.reply({
          content: createMissingPermissionsMessage(error),
          allowedMentions: {
            repliedUser: false,
          },
          flags: MessageFlags.SuppressNotifications,
        }).catch(() => null);
        return;
      }

      throw error;
    }
  },
};