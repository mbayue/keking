import {
  Events,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
  type InteractionReplyOptions,
} from "discord.js";
import {
  incrementCounter,
  observeDuration,
} from "../observability/metrics.js";


import { config } from "../config.js";
import type { BotEvent } from "../structures/event.js";
import type { BotClient } from "../types/client.js";
import { createErrorEmbed } from "../utils/embeds.js";
import { getPlayer } from "../music/player.js";
import { MissingBotPermissionsError, createMissingPermissionsReply } from "../utils/permissions.js";

export const event: BotEvent = {
  name: Events.InteractionCreate,
  async execute(...args) {
    const [interaction] = args as [Interaction];

    if (interaction.isChatInputCommand()) {
      await handleChatInputCommand(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("music_")) {
      if (!config.musicEnabled) {
        await interaction.reply({
          content: "Music playback is currently disabled.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await handleMusicButtonSafely(interaction);
    }
  },
};

async function respondToInteractionError(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  error: unknown,
  logLabel: string,
  fallbackTitle: string,
  fallbackDescription: string,
): Promise<void> {
  console.error(`Failed ${logLabel}:`, error);
  const reply = error instanceof MissingBotPermissionsError
    ? createMissingPermissionsReply(error)
    : {
      embeds: [createErrorEmbed(fallbackTitle, fallbackDescription)],
      flags: MessageFlags.Ephemeral,
    } satisfies InteractionReplyOptions;

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(reply);
    return;
  }

  await interaction.reply(reply);
}

async function handleChatInputCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const client = interaction.client as BotClient;
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      embeds: [createErrorEmbed("Unknown Command", "That command is not implemented yet.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const startedAt = performance.now();
  try {
    await command.execute(interaction);
  } catch (error) {
    incrementCounter("keking_commands_total", { command: interaction.commandName, status: "error" });
    observeDuration("keking_command_duration_seconds", (performance.now() - startedAt) / 1000, { command: interaction.commandName, status: "error" });
    await respondToInteractionError(interaction, error, `to execute /${interaction.commandName}`, "Command Failed", "Something went wrong while running that command.");
    return;
  }
  incrementCounter("keking_commands_total", { command: interaction.commandName, status: "ok" });
  observeDuration("keking_command_duration_seconds", (performance.now() - startedAt) / 1000, { command: interaction.commandName, status: "ok" });
}

async function handleMusicButtonSafely(interaction: ButtonInteraction): Promise<void> {
  try {
    await handleMusicButton(interaction);
  } catch (error) {
    await respondToInteractionError(interaction, error, `to handle button ${interaction.customId}`, "Action Failed", "Something went wrong while running that action.");
  }
}

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
