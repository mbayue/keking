import {
  Events,
  MessageFlags,
  type Interaction,
  type InteractionReplyOptions,
} from "discord.js";

import type { BotEvent } from "../structures/event.js";
import type { BotClient } from "../types/client.js";
import { createErrorEmbed } from "../utils/embeds.js";

export const event: BotEvent = {
  name: Events.InteractionCreate,
  async execute(...args) {
    const [interaction] = args as [Interaction];

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const client = interaction.client as BotClient;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      const reply = {
        embeds: [createErrorEmbed("Unknown Command", "That command is not implemented yet.")],
        flags: MessageFlags.Ephemeral,
      } satisfies InteractionReplyOptions;

      await interaction.reply(reply);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Failed to execute /${interaction.commandName}:`, error);

      const reply = {
        embeds: [createErrorEmbed("Command Failed", "Something went wrong while running that command.")],
        flags: MessageFlags.Ephemeral,
      } satisfies InteractionReplyOptions;

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
        return;
      }

      await interaction.reply(reply);
    }
  },
};
