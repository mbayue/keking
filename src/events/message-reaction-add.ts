import { ContainerBuilder, Events, MessageFlags, TextDisplayBuilder, type Message, type MessageReaction, type PartialMessage, type User } from "discord.js";

import type { BotEvent } from "../structures/event.js";
import { getPreviewReply, updatePreviewReplyLinks, type StoredPreviewLink, type StoredPreviewReply } from "../db/postgres.js";
import { buildPreviewCard } from "../utils/social-cards.js";
import { getSocialDomain, isSocialDomainId, mirrorCandidates, rotatePreviewLink, type PreviewLink } from "../utils/social-preview.js";

const ROTATE_EMOJI = "🔄";
type RotationTarget = {
  reaction: MessageReaction;
  message: Message | PartialMessage;
  user: User;
  record: StoredPreviewReply;
};

async function resolveRotationTarget(args: unknown[]): Promise<RotationTarget | null> {
  const [reactionArg, userArg] = args as [MessageReaction, User];
  if (userArg.bot || reactionArg.emoji.name !== ROTATE_EMOJI) return null;

  const reaction = reactionArg.partial ? await reactionArg.fetch().catch(() => null) : reactionArg;
  if (!reaction) return null;

  const { message } = reaction;
  if (!message.inGuild() || message.author?.id !== message.client.user?.id) return null;

  const record = await getPreviewReply(message.id).catch((error) => {
    console.error("[SOCIAL PREVIEW] Failed to load rotation state:", error);
    return null;
  });
  if (!record || record.links.length === 0) return null;
  return { reaction, message, user: userArg, record };
}

function rotateAllLinks(links: StoredPreviewLink[]): PreviewLink[] | null {
  const rotated: PreviewLink[] = [];
  for (const link of links) {
    if (!isSocialDomainId(link.domainId)) return null;
    const next = rotatePreviewLink({ originalUrl: link.originalUrl, domainId: link.domainId, methodId: link.methodId });
    if (!next) return null;
    rotated.push(next);
  }
  return rotated;
}

async function buildRotatedComponents(links: PreviewLink[]): Promise<(ContainerBuilder | TextDisplayBuilder)[]> {
  const cards = await Promise.all(
    links.map(async (link) => {
      const domain = getSocialDomain(link.domainId);
      const container = await buildPreviewCard(link.originalUrl, link.text, domain?.name ?? link.domainId, mirrorCandidates(link.originalUrl)).catch(
        () => null,
      );
      return { link, container };
    }),
  );
  const components: (ContainerBuilder | TextDisplayBuilder)[] = [];
  const fallbackTexts: string[] = [];
  for (const card of cards) {
    if (card.container) {
      components.push(card.container);
    } else {
      fallbackTexts.push(card.link.text);
    }
  }
  if (fallbackTexts.length > 0) {
    components.push(new TextDisplayBuilder().setContent(fallbackTexts.join("\n").slice(0, 2000)));
  }
  return components;
}

export const event: BotEvent = {
  name: Events.MessageReactionAdd,
  async execute(...args) {
    const target = await resolveRotationTarget(args);
    if (!target) return;

    const rotated = rotateAllLinks(target.record.links);
    if (!rotated) return;

    const components = await buildRotatedComponents(rotated);
    if (components.length === 0) return;

    const { message, user, reaction } = target;
    await message.edit({ components, flags: MessageFlags.IsComponentsV2 }).catch(() => null);
    await updatePreviewReplyLinks(
      message.id,
      rotated.map((link) => ({ originalUrl: link.originalUrl, domainId: link.domainId, methodId: link.methodId })),
    ).catch((error) => console.warn("[SOCIAL PREVIEW] Failed to store rotation:", error));
    await reaction.users.remove(user.id).catch(() => null);
  },
};
