import { Events, MessageFlags, type Message } from "discord.js";

import { handleKeqingChat } from "../ai/keqing/index.js";
import { previewSocialLinks } from "../social/handlers/message.js";
import type { BotEvent } from "../structures/event.js";
import { MissingBotPermissionsError, createMissingPermissionsMessage } from "../utils/permissions.js";

export const event: BotEvent = {
  name: Events.MessageCreate,
  async execute(message) {
    const msg = message as Message;
    try {
      if (await handleKeqingChat(msg)) {
        return;
      }

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
