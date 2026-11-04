import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import { config } from "../../config.js";
import { isAiEnabled, setAiEnabled, upsertGuild } from "../../db/postgres.js";
import type { SlashCommand } from "../../structures/command.js";
import { createErrorEmbed } from "../../utils/embeds.js";

function statusEmbed(enabled: boolean): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("AI Chat Status")
    .setColor(enabled ? 0x00ff00 : 0xff0000)
    .setDescription(`AI chat features are currently **${enabled ? "ENABLED" : "DISABLED"}** in this server.`);
}

function updatedEmbed(enabled: boolean, user: { tag: string; id: string }): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("AI Chat Updated")
    .setColor(enabled ? 0x00ff00 : 0xff0000)
    .setDescription(`AI chat features are now **${enabled ? "ENABLED" : "DISABLED"}** for this server.`)
    .addFields(
      { name: "Changed By", value: `${user.tag} (${user.id})`, inline: true },
      { name: "Time", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
    );
}

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Turn AI chat features on or off for this server.")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) =>
      option
        .setName("enabled")
        .setDescription("Enable or disable AI chat features")
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

    try {
      if (enabledOption === null) {
        await interaction.editReply({ embeds: [statusEmbed(await isAiEnabled(interaction.guild.id))] });
        return;
      }

      await upsertGuild(interaction.guild.id, interaction.guild.name);
      await setAiEnabled(interaction.guild.id, enabledOption);
      await interaction.editReply({ embeds: [updatedEmbed(enabledOption, interaction.user)] });
    } catch (error) {
      console.error("AI toggle failed:", error);
      await interaction.editReply({
        embeds: [createErrorEmbed("Command Failed", "An error occurred while accessing the database.")],
      });
    }
  },
};
