import {
  Events,
  MessageFlags,
  type ButtonInteraction,
  type Interaction,
  type InteractionReplyOptions,
} from "discord.js";

import type { BotEvent } from "../structures/event.js";
import type { BotClient } from "../types/client.js";
import { createErrorEmbed } from "../utils/embeds.js";
import { getPlayer } from "../utils/music.js";

export const event: BotEvent = {
  name: Events.InteractionCreate,
  async execute(...args) {
    const [interaction] = args as [Interaction];

    if (interaction.isChatInputCommand()) {
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
    } else if (interaction.isButton()) {
      // Handle button interactions
      if (interaction.customId.startsWith('music_')) {
        await handleMusicButton(interaction);
      }
    }
  },
};

async function handleMusicButton(interaction: ButtonInteraction) {
  const player = getPlayer(interaction.guildId!);

  switch (interaction.customId) {
    case 'music_pause_resume': {
      const queue = player["discordPlayer"].nodes.get(interaction.guildId!);
      const paused = queue?.isPlaying() && !queue.node.isPaused();
      const message = paused ? player.pause() : player.resume();
      await interaction.reply({
        content: message,
        ephemeral: true,
      });
      break;
    }

    case 'music_skip': {
      const message = player.skip();
      await interaction.reply({
        content: message,
        ephemeral: true,
      });
      break;
    }

    case 'music_stop':
      {
      const message = player.stop();
      await interaction.reply({
        content: message,
        ephemeral: true,
      });
      break;
      }
  }
}
