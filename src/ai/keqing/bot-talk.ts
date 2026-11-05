/**
 * Guard rules for bot-to-bot conversation.
 *
 * Two bots replying to each other can loop forever, so every exchange is
 * bounded: a chain has a maximum depth, and exceeding it starts a cooldown
 * during which peer bots are ignored.
 */

/** Default maximum Keqing replies in one bot-to-bot chain. */
export const DEFAULT_MAX_BOT_CHAIN_DEPTH = 20;

/** Default cooldown after a chain hits its depth limit. */
export const DEFAULT_BOT_CHAIN_COOLDOWN_MS = 60 * 1000;

/** Bounds accepted for the per-server chain depth. */
export const MIN_BOT_CHAIN_DEPTH = 1;
export const MAX_ALLOWED_BOT_CHAIN_DEPTH = 100;

/** Bounds accepted for the per-server cooldown, in seconds. */
export const MIN_BOT_CHAIN_COOLDOWN_SECONDS = 10;
export const MAX_ALLOWED_BOT_CHAIN_COOLDOWN_SECONDS = 3600;

/**
 * Maximum peer-bot lines carried into the next turn of a chain.
 *
 * Scaled to the chain depth so a long exchange keeps its full thread: a
 * 20-reply chain carries both sides of the conversation.
 */
export const MAX_CHAIN_CONTEXT_MESSAGES = 100 * 2;

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

export type BotTalkLimits = {
  maxDepth: number;
  cooldownMs: number;
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

/** Clamps a requested chain depth into the accepted range. */
export function clampChainDepth(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_BOT_CHAIN_DEPTH;
  }
  return Math.min(MAX_ALLOWED_BOT_CHAIN_DEPTH, Math.max(MIN_BOT_CHAIN_DEPTH, Math.trunc(value)));
}

/** Clamps a requested cooldown, in seconds, into the accepted range. */
export function clampCooldownSeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return Math.round(DEFAULT_BOT_CHAIN_COOLDOWN_MS / 1000);
  }
  return Math.min(
    MAX_ALLOWED_BOT_CHAIN_COOLDOWN_SECONDS,
    Math.max(MIN_BOT_CHAIN_COOLDOWN_SECONDS, Math.trunc(value)),
  );
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
 * depth below the limit. An expired cooldown clears the chain so the bots can
 * resume instead of staying blocked forever.
 */
export function canReplyToPeer(
  channelId: string,
  enabled: boolean,
  now: number,
  limits: BotTalkLimits = {
    maxDepth: DEFAULT_MAX_BOT_CHAIN_DEPTH,
    cooldownMs: DEFAULT_BOT_CHAIN_COOLDOWN_MS,
  },
): boolean {
  if (!enabled) {
    return false;
  }

  const chain = getChain(channelId);
  if (chain.cooldownUntil > now) {
    return false;
  }

  // The cooldown has elapsed: the next exchange starts a fresh chain.
  if (chain.cooldownUntil > 0) {
    chain.depth = 0;
    chain.cooldownUntil = 0;
  }

  return chain.depth < limits.maxDepth;
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
export function recordKeqingReply(
  channelId: string,
  content: string,
  now: number,
  limits: BotTalkLimits = {
    maxDepth: DEFAULT_MAX_BOT_CHAIN_DEPTH,
    cooldownMs: DEFAULT_BOT_CHAIN_COOLDOWN_MS,
  },
): void {
  const chain = getChain(channelId);
  chain.depth += 1;
  chain.context.push(`Keqing: ${content}`);
  if (chain.context.length > MAX_CHAIN_CONTEXT_MESSAGES) {
    chain.context.shift();
  }
  if (chain.depth >= limits.maxDepth) {
    chain.cooldownUntil = now + limits.cooldownMs;
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
  chain.cooldownUntil = options.cooldown ? now + DEFAULT_BOT_CHAIN_COOLDOWN_MS : 0;
}

/** Clears all channel state. Used by tests. */
export function resetBotTalkState(): void {
  chains.clear();
}
