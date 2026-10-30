import {
  type GuildTextBasedChannel,
  PermissionFlagsBits,
  PermissionsBitField,
  type GuildMember,
  type InteractionReplyOptions,
} from "discord.js";

import { createErrorEmbed } from "./embeds.js";

const REQUIRED_VOICE_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
] as const;

export class MissingBotPermissionsError extends Error {
  readonly permissions: string[];
  readonly scope: string;

  constructor(permissions: string[], scope: string) {
    super(`Missing bot permissions in ${scope}: ${permissions.join(", ")}`);
    this.name = "MissingBotPermissionsError";
    this.permissions = permissions;
    this.scope = scope;
  }
}

export function assertBotCanJoinVoice(member: GuildMember): void {
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return;
  }

  const botMember = member.guild.members.me;
  if (!botMember) {
    throw new MissingBotPermissionsError(["View Channel"], voiceChannel.name);
  }

  const permissions = voiceChannel.permissionsFor(botMember);
  const missing = REQUIRED_VOICE_PERMISSIONS.filter((permission) => !permissions.has(permission));

  if (missing.length === 0) {
    return;
  }

  throw new MissingBotPermissionsError(
    missing.map(formatPermission),
    voiceChannel.name,
  );
}

export function assertBotHasChannelPermissions(
  channel: GuildTextBasedChannel,
  member: GuildMember,
  permissions: bigint[],
): void {
  const botMember = member.guild.members.me;
  if (!botMember) {
    throw new MissingBotPermissionsError(["View Channel"], channel.name);
  }

  const channelPermissions = channel.permissionsFor(botMember);
  const missing = permissions.filter((permission) => !channelPermissions.has(permission));

  if (missing.length === 0) {
    return;
  }

  throw new MissingBotPermissionsError(
    missing.map(formatPermission),
    channel.name,
  );
}

function formatMissingPermissions(error: MissingBotPermissionsError): string {
  const quoted = error.permissions.map((permission) => `\`${permission}\``).join(", ");
  return `I need these permissions in **${error.scope}**: ${quoted}.`;
}

export function createMissingPermissionsReply(error: MissingBotPermissionsError): InteractionReplyOptions {
  return {
    embeds: [createErrorEmbed("Missing Bot Permissions", formatMissingPermissions(error))],
  };
}

export function createMissingPermissionsMessage(error: MissingBotPermissionsError): string {
  return formatMissingPermissions(error);
}

function formatPermission(permission: bigint): string {
  const [name] = new PermissionsBitField(permission).toArray();
  if (!name) {
    return "Unknown Permission";
  }

  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}
