import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import { config } from "../../config.js";
import { deleteAiChatMemory, deleteAllAiChatMemory } from "../../db/postgres.js";
import type { SlashCommand } from "../../structures/command.js";
import { createErrorEmbed, createInfoEmbed } from "../../utils/embeds.js";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("forget")
    .setDescription("Delete stored AI conversation memory for this server.")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Admin only: delete another user's AI memory")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("all")
        .setDescription("Admin only: clear all AI memory in this server")
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

    const all = interaction.options.getBoolean("all") ?? false;
    const targetOption = interaction.options.getUser("user");
    if (all && targetOption) {
      await interaction.reply({
        embeds: [createErrorEmbed("Invalid Options", "Choose either `user` or `all`, not both.")],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const isOwner = interaction.user.id === config.botOwnerId;
    const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
    const isAdmin = isOwner || hasPermission;

    if (all) {
      if (!isAdmin) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(
              "Missing Permissions",
              "You need the Manage Server permission (or be the bot owner) to clear all AI memory.",
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      try {
        const count = await deleteAllAiChatMemory(interaction.guild.id);
        await interaction.reply({
          embeds: [
            createInfoEmbed({
              title: "AI Memory Cleared",
              description: `Deleted ${count} stored AI conversation${count === 1 ? "" : "s"} for this server.`,
            }),
          ],
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        console.error("Failed to clear all AI memory:", error);
        await interaction.reply({
          embeds: [createErrorEmbed("Command Failed", "An error occurred while accessing the database.")],
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    const target = targetOption ?? interaction.user;
    const isSelf = target.id === interaction.user.id;

    if (!isSelf && !isAdmin) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            "Missing Permissions",
            "You need the Manage Server permission (or be the bot owner) to clear another user's memory.",
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (target.bot) {
      await interaction.reply({
        embeds: [createErrorEmbed("Invalid User", "Bot users do not have AI memory to clear.")],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await deleteAiChatMemory(interaction.guild.id, target.id);
      await interaction.reply({
        embeds: [
          createInfoEmbed({
            title: "AI Memory Cleared",
            description: isSelf
              ? "Your stored AI conversation memory for this server has been deleted."
              : `Stored AI conversation memory for @${target.username} has been deleted.`,
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("Failed to clear AI memory:", error);
      await interaction.reply({
        embeds: [createErrorEmbed("Command Failed", "An error occurred while accessing the database.")],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
