import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type CacheType,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
} from "discord.js";
import { config } from "../../config.js";
import type { SlashCommand } from "../../structures/command.js";
import type { StoredGuildRecord } from "../../db/postgres.js";
import { createErrorEmbed } from "../../utils/embeds.js";
import { SOCIAL_DOMAINS, isSocialDomainId } from "../../utils/social-preview.js";
import {
  getGuildRecord,
  getSocialPreviewChannelState,
  getSocialPreviewDomainState,
  isSocialPreviewEnabled,
  setSocialPreviewChannel,
  setSocialPreviewDomain,
  setSocialPreviewEnabled,
} from "../../db/postgres.js";

function updatedEmbed(
  description: string,
  enabled: boolean,
  user: { tag: string; id: string },
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Social Previews Updated")
    .setColor(enabled ? 0x00ff00 : 0xff0000)
    .setDescription(description)
    .addFields(
      { name: "Changed By", value: `${user.tag} (${user.id})`, inline: true },
      { name: "Time", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
    );
}

function toUnixSeconds(value: Date | null | undefined): number | null {
  if (!(value instanceof Date)) return null;
  const time = Math.floor(value.getTime() / 1000);
  return Number.isNaN(time) ? null : time;
}

function channelStateText(channelState: boolean | null): string {
  if (channelState === null) return "Follows server settings";
  if (channelState) return "✅ On (override)";
  return "❌ Off (override)";
}

async function applyGuildToggle(
  interaction: ChatInputCommandInteraction<CacheType>,
  guildId: string,
  enabled: boolean,
): Promise<void> {
  await setSocialPreviewEnabled(guildId, enabled, interaction.user.tag);
  await interaction.editReply({
    embeds: [
      updatedEmbed(
        `Social link previews have been successfully **${enabled ? "ENABLED" : "DISABLED"}** for this server.`,
        enabled,
        interaction.user,
      ),
    ],
  });
}

async function applyDomainToggle(
  guildId: string,
  domain: string,
  enabled: boolean,
  changedBy: string,
): Promise<string> {
  const names: Record<string, string> = Object.fromEntries(SOCIAL_DOMAINS.map((entry) => [entry.id, entry.name]));
  if (!isSocialDomainId(domain)) {
    return `Unknown link source: ${domain}.`;
  }
  await setSocialPreviewDomain(guildId, domain, enabled, changedBy);
  return `**${names[domain] ?? domain}**: ${enabled ? "ENABLED" : "DISABLED"}`;
}

async function applyChannelToggle(
  guildId: string,
  channelId: string,
  enabled: boolean,
  changedBy: string,
): Promise<string> {
  await setSocialPreviewChannel(guildId, channelId, enabled, changedBy);
  return `<#${channelId}>: ${enabled ? "ENABLED" : "DISABLED"}`;
}

function historyFields(record: StoredGuildRecord | null): { name: string; value: string; inline: boolean }[] {
  if (!record?.social_preview_changed_by) {
    return [{ name: "Last Changed", value: "Never modified (Default is ENABLED)", inline: false }];
  }
  const changedAtUnix = toUnixSeconds(record.social_preview_changed_at);
  return [
    { name: "Last Changed By", value: record.social_preview_changed_by, inline: true },
    {
      name: "Last Changed At",
      value: changedAtUnix ? `<t:${changedAtUnix}:F> (<t:${changedAtUnix}:R>)` : "Unknown",
      inline: true,
    },
  ];
}

async function showStatus(interaction: ChatInputCommandInteraction<CacheType>, guildId: string): Promise<void> {
  const isEnabled = await isSocialPreviewEnabled(guildId);
  const record = await getGuildRecord(guildId);
  const channelId = interaction.channelId;
  const channelState = channelId ? await getSocialPreviewChannelState(guildId, channelId) : null;

  const embed = new EmbedBuilder()
    .setTitle("Social Previews Status")
    .setColor(isEnabled ? 0x00ff00 : 0xff0000)
    .setDescription(`Social link previews are currenty **${isEnabled ? "ENABLED" : "DISABLED"}** in this server.`);

  if (channelId) {
    embed.addFields({ name: "This Channel", value: channelStateText(channelState), inline: false });
  }

  const domainStates = await Promise.all(
    SOCIAL_DOMAINS.map(async (domain) => {
      const state = await getSocialPreviewDomainState(guildId, domain.id);
      return { name: domain.name, value: isEnabled && state !== false ? "✅ On" : "❌ Off", inline: true };
    }),
  );
  embed.addFields(domainStates);
  embed.addFields(historyFields(record));

  await interaction.editReply({ embeds: [embed] });
}

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("social-preview")
    .setDescription("Toggle or check social link previews for this server.")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) =>
      option
        .setName("enabled")
        .setDescription("Set social previews On or Off")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("domain")
        .setDescription("Limit the toggle to one link source (e.g. facebook)")
        .setRequired(false)
        .addChoices(SOCIAL_DOMAINS.map((domain) => ({ name: domain.name, value: domain.id })))
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Limit the toggle to one channel (defaults to the whole server)")
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
    const hasPermission = member.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isOwner && !hasPermission) {
      const reply = {
        embeds: [createErrorEmbed("Missing Permissions", "You need the Manage Server permission (or be the bot owner) to use this command.")],
        flags: MessageFlags.Ephemeral,
      } satisfies InteractionReplyOptions;

      await interaction.reply(reply);
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const enabledOption = interaction.options.getBoolean("enabled");
    const domainOption = interaction.options.getString("domain");
    const channelOption = interaction.options.getChannel("channel");
    const guildId = interaction.guild.id;

    try {
      if (enabledOption === null) {
        await showStatus(interaction, guildId);
        return;
      }
      const lines: string[] = [];
      if (domainOption) {
        lines.push(await applyDomainToggle(guildId, domainOption, enabledOption, interaction.user.tag));
      }
      if (channelOption) {
        lines.push(await applyChannelToggle(guildId, channelOption.id, enabledOption, interaction.user.tag));
      }
      if (lines.length > 0) {
        await interaction.editReply({
          embeds: [
            updatedEmbed(`Social link previews updated:\n${lines.join("\n")}`, enabledOption, interaction.user),
          ],
        });
        return;
      }
      await applyGuildToggle(interaction, guildId, enabledOption);
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
