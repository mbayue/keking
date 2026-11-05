/**
 * Guard rules for bot-to-bot conversation.
 *
 * Two bots replying to each other can loop forever, so every exchange is
 * bounded: a chain has a maximum depth, and exceeding it starts a cooldown
 * during which peer bots are ignored.
 */

/** Maximum Keqing replies in one bot-to-bot chain. */
export const MAX_BOT_CHAIN_DEPTH = 3;

/** How long a channel is ignored after a chain hits its depth limit. */
export const BOT_CHAIN_COOLDOWN_MS = 5 * 60 * 1000;

/** Maximum peer-bot lines carried into the next turn of a chain. */
export const MAX_CHAIN_CONTEXT_MESSAGES = 8;

const STOP_PATTERN = /\b(stop|berhenti|diam|diem|cukup)\b/i;
// No trailing word boundary: Indonesian attaches suffixes directly
// ("diskusinya", "ngomongin", "botnya") and must still match.
const TALK_PATTERN = /\b(talk|talking|ngomong|bicara|chat|diskusi|bot|bots|each other)/i;

export type BotChain = {
  /** Keqing replies sent in the current chain. */
  depth: number;
  /** Timestamp until which peer bots are ignored in this channel. */
  cooldownUntil: number;
  /** Recent peer and Keqing lines, newest last. */
  context: string[];
};

const chains = new Map<string, BotChain>();

function getChain(channelId: string): BotChain {
  const existing = chains.get(channelId);
  if (existing) {
    return existing;
  }

  const created: BotChain = { depth: 0, cooldownUntil: 0, context: [] };
  chains.set(channelId, created);
  return created;
}

/** True when the message reads like a user telling the bots to stop. */
export function detectStopInstruction(content: string): boolean {
  return STOP_PATTERN.test(content) && TALK_PATTERN.test(content);
}

/** True when the channel is in the post-chain cooldown. */
export function isCoolingDown(channelId: string, now: number): boolean {
  return getChain(channelId).cooldownUntil > now;
}

/**
 * True when Keqing may reply to a peer bot right now.
 *
 * Requires the per-guild feature flag to be on, no active cooldown, and chain
 * depth below the limit.
 */
export function canReplyToPeer(channelId: string, enabled: boolean, now: number): boolean {
  if (!enabled) {
    return false;
  }
  if (isCoolingDown(channelId, now)) {
    return false;
  }
  return getChain(channelId).depth < MAX_BOT_CHAIN_DEPTH;
}

/** Records a peer bot's line as part of the current chain. */
export function recordPeerMessage(channelId: string, authorName: string, content: string): void {
  const chain = getChain(channelId);
  chain.context.push(`${authorName}: ${content}`);
  if (chain.context.length > MAX_CHAIN_CONTEXT_MESSAGES) {
    chain.context.shift();
  }
}

/** Records Keqing's reply, deepening the chain and starting the cooldown at the limit. */
export function recordKeqingReply(channelId: string, content: string, now: number): void {
  const chain = getChain(channelId);
  chain.depth += 1;
  chain.context.push(`Keqing: ${content}`);
  if (chain.context.length > MAX_CHAIN_CONTEXT_MESSAGES) {
    chain.context.shift();
  }
  if (chain.depth >= MAX_BOT_CHAIN_DEPTH) {
    chain.cooldownUntil = now + BOT_CHAIN_COOLDOWN_MS;
  }
}

/** The peer and Keqing lines recorded so far in this chain. */
export function getChainContext(channelId: string): string[] {
  return [...getChain(channelId).context];
}

/**
 * Resets the chain. A human speaking breaks the chain, and a stop instruction
 * also starts the cooldown so the bots do not immediately resume.
 */
export function resetChain(channelId: string, now: number, options: { cooldown?: boolean } = {}): void {
  const chain = getChain(channelId);
  chain.depth = 0;
  chain.context = [];
  chain.cooldownUntil = options.cooldown ? now + BOT_CHAIN_COOLDOWN_MS : 0;
}

/** Clears all channel state. Used by tests. */
export function resetBotTalkState(): void {
  chains.clear();
}
