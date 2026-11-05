import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import { config } from "../../config.js";
import {
  getBotTalkLimits,
  isBotTalkEnabled,
  setBotTalkEnabled,
  setBotTalkLimits,
  upsertGuild,
} from "../../db/postgres.js";
import {
  DEFAULT_BOT_CHAIN_COOLDOWN_MS,
  DEFAULT_MAX_BOT_CHAIN_DEPTH,
  MAX_ALLOWED_BOT_CHAIN_COOLDOWN_SECONDS,
  MAX_ALLOWED_BOT_CHAIN_DEPTH,
  MIN_BOT_CHAIN_COOLDOWN_SECONDS,
  MIN_BOT_CHAIN_DEPTH,
  clampChainDepth,
  clampCooldownSeconds,
} from "../../ai/keqing/bot-talk.js";
import type { SlashCommand } from "../../structures/command.js";
import { createErrorEmbed } from "../../utils/embeds.js";

function statusEmbed(
  enabled: boolean,
  limits: { maxDepth: number; cooldownSeconds: number },
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Bot Talk Status")
    .setColor(enabled ? 0x00ff00 : 0xff6600)
    .setDescription(
      `Bot-to-bot conversation is currently **${enabled ? "ENABLED" : "DISABLED"}** in this server.`,
    )
    .addFields(
      { name: "Chain Limit", value: `${limits.maxDepth} replies`, inline: true },
      { name: "Cooldown", value: `${limits.cooldownSeconds}s`, inline: true },
      {
        name: "Guards",
        value:
          "A human speaking, or saying “stop”, ends the exchange. The chain resets once the cooldown passes.",
      },
    );
}

function updatedEmbed(
  enabled: boolean,
  limits: { maxDepth: number; cooldownSeconds: number },
  user: { tag: string; id: string },
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Bot Talk Updated")
    .setColor(enabled ? 0x00ff00 : 0xff6600)
    .setDescription(
      `Bot-to-bot conversation is now **${enabled ? "ENABLED" : "DISABLED"}** for this server.`,
    )
    .addFields(
      { name: "Chain Limit", value: `${limits.maxDepth} replies`, inline: true },
      { name: "Cooldown", value: `${limits.cooldownSeconds}s`, inline: true },
      { name: "Changed By", value: `${user.tag} (${user.id})`, inline: true },
      { name: "Time", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
    );
}

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("bottalk")
    .setDescription("Turn bot-to-bot conversation on or off in this server.")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) =>
      option
        .setName("enabled")
        .setDescription("Enable or disable bot-to-bot conversation")
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription(`Replies allowed per exchange (${MIN_BOT_CHAIN_DEPTH}-${MAX_ALLOWED_BOT_CHAIN_DEPTH})`)
        .setMinValue(MIN_BOT_CHAIN_DEPTH)
        .setMaxValue(MAX_ALLOWED_BOT_CHAIN_DEPTH)
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName("cooldown")
        .setDescription(`Seconds to pause after the limit (${MIN_BOT_CHAIN_COOLDOWN_SECONDS}-${MAX_ALLOWED_BOT_CHAIN_COOLDOWN_SECONDS})`)
        .setMinValue(MIN_BOT_CHAIN_COOLDOWN_SECONDS)
        .setMaxValue(MAX_ALLOWED_BOT_CHAIN_COOLDOWN_SECONDS)
        .setRequired(false),
    ),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [createErrorEmbed("Server Only", "This command can only be used inside a server.")],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const isOwner = interaction.user.id === config.botOwnerId;
    const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isOwner && !hasPermission) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            "Missing Permissions",
            "You need the Manage Server permission (or be the bot owner) to use this command.",
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const enabledOption = interaction.options.getBoolean("enabled");
    const limitOption = interaction.options.getInteger("limit");
    const cooldownOption = interaction.options.getInteger("cooldown");

    try {
      const current = await getBotTalkLimits(interaction.guild.id);
      const limits = {
        maxDepth: limitOption === null ? current.maxDepth : clampChainDepth(limitOption),
        cooldownSeconds:
          cooldownOption === null
            ? current.cooldownSeconds
            : clampCooldownSeconds(cooldownOption),
      };

      if (enabledOption === null && limitOption === null && cooldownOption === null) {
        await interaction.editReply({
          embeds: [statusEmbed(await isBotTalkEnabled(interaction.guild.id), limits)],
        });
        return;
      }

      await upsertGuild(interaction.guild.id, interaction.guild.name);
      if (enabledOption !== null) {
        await setBotTalkEnabled(interaction.guild.id, enabledOption);
      }
      if (limitOption !== null || cooldownOption !== null) {
        await setBotTalkLimits(interaction.guild.id, {
          maxDepth: limits.maxDepth,
          cooldownSeconds: limits.cooldownSeconds,
        });
      }

      await interaction.editReply({
        embeds: [
          updatedEmbed(
            await isBotTalkEnabled(interaction.guild.id),
            limits,
            interaction.user,
          ),
        ],
      });
    } catch (error) {
      console.error("Bot talk toggle failed:", error);
      await interaction.editReply({
        embeds: [createErrorEmbed("Command Failed", "An error occurred while accessing the database.")],
      });
    }
  },
};

export const defaults = {
  maxDepth: DEFAULT_MAX_BOT_CHAIN_DEPTH,
  cooldownSeconds: Math.round(DEFAULT_BOT_CHAIN_COOLDOWN_MS / 1000),
};
