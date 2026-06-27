import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type InteractionReplyOptions,
} from "discord.js";
import { config } from "../../config.js";
import type { SlashCommand } from "../../structures/command.js";
import { createErrorEmbed } from "../../utils/embeds.js";
import {
  getGuildRecord,
  isSocialPreviewEnabled,
  setSocialPreviewEnabled,
} from "../../db/postgres.js";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("social-preview")
    .setDescription("Toggle or check social link previews for this server.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) =>
      option
        .setName("enabled")
        .setDescription("Set social previews On or Off")
        .setRequired(false)
    ),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      const reply = {
        embeds: [createErrorEmbed("Server Only", "This command can only be used inside a server.")],
        flags: MessageFlags.Ephemeral,
      } satisfies InteractionReplyOptions;

      await interaction.reply(reply);
      return;
    }

    const member = interaction.member;
    const isOwner = member.id === config.botOwnerId;
    const hasPerm = member.permissions.has(PermissionFlagsBits.ManageGuild);

    // Only allow if user is bot owner OR has Manage Guild permission
    if (!isOwner && !hasPerm) {
      const reply = {
        embeds: [
          createErrorEmbed(
            "Access Denied",
            "You need the **Manage Server** permission to use this command."
          ),
        ],
        flags: MessageFlags.Ephemeral,
      } satisfies InteractionReplyOptions;

      await interaction.reply(reply);
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const enabledOption = interaction.options.getBoolean("enabled");
    const guildId = interaction.guild.id;

    try {
      if (enabledOption !== null) {
        // Set new preference
        await setSocialPreviewEnabled(guildId, enabledOption, interaction.user.tag);

        const embed = new EmbedBuilder()
          .setTitle("Social Previews Updated")
          .setColor(enabledOption ? 0x00ff00 : 0xff0000)
          .setDescription(
            `Social link previews have been successfully **${
              enabledOption ? "ENABLED" : "DISABLED"
            }** for this server.`
          )
          .addFields(
            { name: "Changed By", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: "Time", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
      } else {
        // Just show current status
        const isEnabled = await isSocialPreviewEnabled(guildId);
        const record = await getGuildRecord(guildId);

        const embed = new EmbedBuilder()
          .setTitle("Social Previews Status")
          .setColor(isEnabled ? 0x00ff00 : 0xff0000)
          .setDescription(
            `Social link previews are currenty **${isEnabled ? "ENABLED" : "DISABLED"}** in this server.`          );

        if (record && record.social_preview_changed_by) {
          const changedAtUnix = record.social_preview_changed_at
            ? Math.floor(new Date(record.social_preview_changed_at).getTime() / 1000)
            : null;

          embed.addFields(
            { name: "Last Changed By", value: record.social_preview_changed_by, inline: true },
            {
              name: "Last Changed At",
              value: changedAtUnix ? `<t:${changedAtUnix}:F> (<t:${changedAtUnix}:R>)` : "Unknown",
              inline: true,
            }
          );
        } else {
          embed.addFields({
            name: "Last Changed",
            value: "Never modified (Default is ENABLED)",
            inline: false,
          });
        }

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error("Social preview command failed:", error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Command Failed",
            "An error occurred while accessing the database."
          ),
        ],
      });
    }
  },
};
