import { ContainerBuilder, Events, MessageFlags, PermissionFlagsBits, TextDisplayBuilder, type Message } from "discord.js";

import type { BotEvent } from "../structures/event.js";
import { extractSocialMirrorLinks, getSocialDomain, mirrorCandidates } from "../utils/social-preview.js";
import type { PreviewLink } from "../utils/social-preview.js";
import { buildPreviewCard } from "../utils/social-cards.js";
import {
  MissingBotPermissionsError,
  assertBotHasChannelPermissions,
  createMissingPermissionsMessage,
} from "../utils/permissions.js";
import { isSocialPreviewAllowed, savePreviewReply } from "../db/postgres.js";
import { config } from "../config.js";

const mentionReplies = [
  "iya beb",
  "iya sayang",
  "apa beb",
  "apa sayang",
];

async function handleMentionReply(message: Message): Promise<boolean> {
  if (!message.inGuild() || message.author.bot) {
    return false;
  }

  const botId = message.client.user?.id;
  const authorId = message.author.id;

  if (!botId || authorId !== config.botOwnerId) {
    return false;
  }

  if (!message.mentions.has(botId, { ignoreEveryone: true })) {
    return false;
  }

  const index = Math.floor(Math.random() * mentionReplies.length);
  const reply = mentionReplies[index] ?? "iya beb";

  await message.reply({
    content: reply,
    allowedMentions: {
      repliedUser: false,
    },
  });

  return true;
}

async function filterAllowedLinks(guildId: string, channelId: string, links: PreviewLink[]): Promise<PreviewLink[]> {
  // Fail-secure: if the database query fails, default to disabled (no previews).
  try {
    const checks = await Promise.all(
      links.map(async (link) => (await isSocialPreviewAllowed(guildId, channelId, link.domainId)) ? link : null),
    );
    return checks.filter((link) => link !== null);
  } catch (error) {
    console.error("[SOCIAL PREVIEW] Failed to check database setting (failing secure):", error);
    return [];
  }
}

async function assemblePreviewMessage(allowed: PreviewLink[]): Promise<{
  containers: ContainerBuilder[];
  fallbackLinks: string[];
}> {
  const cards = await Promise.all(
    allowed.map(async (link) => {
      const domain = getSocialDomain(link.domainId);
      const container = await buildPreviewCard(link.originalUrl, link.text, domain?.name ?? link.domainId, mirrorCandidates(link.originalUrl)).catch(
        () => null,
      );
      return { link, container };
    }),
  );
  const containers: ContainerBuilder[] = [];
  const fallbackLinks: string[] = [];
  for (const card of cards) {
    if (card.container) {
      containers.push(card.container);
    } else {
      fallbackLinks.push(card.link.text);
    }
  }
  return { containers, fallbackLinks };
}

async function trySuppressOriginalEmbeds(message: Message<true>): Promise<void> {
  try {
    const me = message.guild.members.me;
    if (me) {
      assertBotHasChannelPermissions(
        message.channel,
        me,
        [PermissionFlagsBits.ManageMessages],
      );
      await message.suppressEmbeds(true);
    }
  } catch (permsError) {
    console.warn("[SOCIAL PREVIEW] Could not suppress embeds:", permsError);
  }
}

async function previewSocialLinks(message: Message): Promise<void> {
  if (!message.inGuild() || message.author.bot) {
    return;
  }

  // Threads need their own checks: archived/locked threads reject replies,
  // and threads use SendMessagesInThreads instead of SendMessages.
  const channel = message.channel;
  if (channel.isThread()) {
    if (channel.archived || channel.locked) {
      return;
    }
  }

  // Same gate as purduehackers/wack-hacker embed-preview: threads need
  // SendMessagesInThreads, and the reply needs Embed Links to unfurl.
  const me = message.guild.members.me;
  if (me) {
    const sendPermission = channel.isThread()
      ? PermissionFlagsBits.SendMessagesInThreads
      : PermissionFlagsBits.SendMessages;
    const permissions = channel.permissionsFor(me);
    if (!permissions?.has([
      PermissionFlagsBits.ViewChannel,
      sendPermission,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ReadMessageHistory,
    ])) {
      return;
    }
  }

  // Fail-secure: If database query fails, we default to disabled (no previews)
  const links = extractSocialMirrorLinks(message.content);
  if (links.length === 0) {
    return;
  }

  const allowed = await filterAllowedLinks(message.guild.id, message.channel.id, links);
  if (allowed.length === 0) {
    return;
  }

  const { containers, fallbackLinks } = await assemblePreviewMessage(allowed);
  // No bot-authored cards: send a plain-text reply so Discord natively unfurls
  // the mirror links (ComponentsV2 messages don't get link embeds).
  const reply = containers.length > 0
    ? await message.reply({
      components: [
        ...containers,
        ...(fallbackLinks.length > 0
          ? [new TextDisplayBuilder().setContent(fallbackLinks.join("\n").slice(0, 2000))]
          : []),
      ],
      allowedMentions: {
        repliedUser: false,
      },
      flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
    })
    : await message.reply({
      content: fallbackLinks.join("\n"),
      allowedMentions: {
        repliedUser: false,
      },
      flags: MessageFlags.SuppressNotifications,
    });

  await savePreviewReply(
    reply.id,
    message.guild.id,
    message.channel.id,
    allowed.map((link) => ({ originalUrl: link.originalUrl, domainId: link.domainId, methodId: link.methodId })),
  ).catch((error) => console.warn("[SOCIAL PREVIEW] Failed to store rotation state:", error));
  await reply.react("🔄").catch(() => null);

  await trySuppressOriginalEmbeds(message);
}

export const event: BotEvent = {
  name: Events.MessageCreate,
  async execute(message) {
    const msg = message as Message;
    // return handleMentionReply(msg)
    //   .then((handled) => {
    // if (!handled) {
    try {
      return await previewSocialLinks(msg);
    } catch (error) {
      console.error("MessageCreate handler failed:", error);

      if (error instanceof MissingBotPermissionsError && msg.inGuild()) {
        await msg.reply({
          content: createMissingPermissionsMessage(error),
          allowedMentions: {
            repliedUser: false,
          },
          flags: MessageFlags.SuppressNotifications,
        }).catch(() => null);
        return;
      }

      throw error;
    }
  },
};