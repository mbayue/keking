import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type InteractionReplyOptions,
} from "discord.js";

import { config } from "../../config.js";
import { getGuildRecord, upsertGuild } from "../../db/postgres.js";
import type { SlashCommand } from "../../structures/command.js";
import { deployCommands, formatDeployReport } from "../../utils/deploy-commands.js";
import { createErrorEmbed } from "../../utils/embeds.js";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Deploys this bot's slash commands to the current server.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) =>
      option
        .setName("force")
        .setDescription("Deploy even if the command hash is unchanged."),
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

    const force = interaction.options.getBoolean("force") ?? false;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      if (config.databaseUrl) {
        await upsertGuild(interaction.guild.id, interaction.guild.name);
      }

      const result = await deployCommands({
        guildId: interaction.guild.id,
        force,
      });
      console.log(formatDeployReport(result, interaction.guild.id));

      const storedGuild = config.databaseUrl ? await getGuildRecord(interaction.guild.id) : null;
      const embed = new EmbedBuilder()
        .setTitle("Command Sync")
        .setDescription(
          result.skipped
            ? "Commands were already up to date for this guild."
            : "Commands were deployed to this guild successfully.",
        )
        .addFields(
          { name: "Guild", value: `${interaction.guild.name} (${interaction.guild.id})` },
          { name: "Commands", value: result.count.toString(), inline: true },
          { name: "Forced", value: force ? "Yes" : "No", inline: true },
          { name: "Hash", value: `\`${result.hash.slice(0, 12)}\``, inline: true },
          { name: "Command Names", value: result.commandNames.join(", ").slice(0, 1024) },
        );

      if (storedGuild?.updated_at) {
        embed.addFields({
          name: "DB Updated",
          value: `<t:${Math.floor(storedGuild.updated_at.getTime() / 1000)}:F>`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Guild sync failed:", error);
      await interaction.editReply({
        embeds: [createErrorEmbed("Sync Failed", "Guild command sync failed. Check the bot logs for details.")],
      });
    }
  },
};
