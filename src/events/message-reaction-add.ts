import { Events, type MessageReaction, type User } from "discord.js";

import { handlePreviewReaction } from "../social/handlers/reaction.js";
import type { BotEvent } from "../structures/event.js";

export const event: BotEvent = {
  name: Events.MessageReactionAdd,
  async execute(...args) {
    const [reaction, user] = args as [MessageReaction, User];
    await handlePreviewReaction(reaction, user);
  },
};
