import { beforeEach, describe, expect, test } from "bun:test";

import {
  DEFAULT_BOT_CHAIN_COOLDOWN_MS,
  DEFAULT_MAX_BOT_CHAIN_DEPTH,
  MAX_ALLOWED_BOT_CHAIN_DEPTH,
  MAX_CHAIN_CONTEXT_MESSAGES,
  MIN_BOT_CHAIN_DEPTH,
  type BotTalkLimits,
  canReplyToPeer,
  clampChainDepth,
  clampCooldownSeconds,
  detectStopInstruction,
  getChainContext,
  isCoolingDown,
  recordKeqingReply,
  recordPeerMessage,
  resetBotTalkState,
  resetChain,
} from "../../src/ai/keqing/bot-talk.ts";

const CHANNEL = "channel-1";
const LIMITS: BotTalkLimits = {
  maxDepth: DEFAULT_MAX_BOT_CHAIN_DEPTH,
  cooldownMs: DEFAULT_BOT_CHAIN_COOLDOWN_MS,
};

beforeEach(() => {
  resetBotTalkState();
});

describe("bot talk guards", () => {
  test("allows a reply while the feature is enabled and the chain has room", () => {
    expect(canReplyToPeer(CHANNEL, true, Date.now(), LIMITS)).toBe(true);
  });

  test("refuses a reply when the feature is disabled", () => {
    expect(canReplyToPeer(CHANNEL, false, Date.now(), LIMITS)).toBe(false);
  });

  test("stops replying once the chain hits its depth limit", () => {
    const now = Date.now();
    for (let index = 0; index < LIMITS.maxDepth; index++) {
      recordPeerMessage(CHANNEL, "Iris", `line ${index}`);
      expect(canReplyToPeer(CHANNEL, true, now, LIMITS)).toBe(true);
      recordKeqingReply(CHANNEL, `reply ${index}`, now, LIMITS);
    }

    expect(canReplyToPeer(CHANNEL, true, now, LIMITS)).toBe(false);
  });

  test("starts a cooldown once the chain hits its depth limit", () => {
    const now = Date.now();
    for (let index = 0; index < LIMITS.maxDepth; index++) {
      recordKeqingReply(CHANNEL, `reply ${index}`, now, LIMITS);
    }

    expect(isCoolingDown(CHANNEL, now)).toBe(true);
    expect(isCoolingDown(CHANNEL, now + LIMITS.cooldownMs + 1)).toBe(false);
  });

  test("resumes after the cooldown expires instead of staying blocked", () => {
    const now = Date.now();
    for (let index = 0; index < LIMITS.maxDepth; index++) {
      recordKeqingReply(CHANNEL, `reply ${index}`, now, LIMITS);
    }
    expect(canReplyToPeer(CHANNEL, true, now, LIMITS)).toBe(false);

    const afterCooldown = now + LIMITS.cooldownMs + 1;
    expect(canReplyToPeer(CHANNEL, true, afterCooldown, LIMITS)).toBe(true);
  });

  test("honours a per-server depth limit", () => {
    const now = Date.now();
    const limits: BotTalkLimits = { maxDepth: 2, cooldownMs: 60_000 };
    recordKeqingReply(CHANNEL, "one", now, limits);
    recordKeqingReply(CHANNEL, "two", now, limits);

    expect(canReplyToPeer(CHANNEL, true, now, limits)).toBe(false);
  });

  test("honours a per-server cooldown length", () => {
    const now = Date.now();
    const limits: BotTalkLimits = { maxDepth: 1, cooldownMs: 5_000 };
    recordKeqingReply(CHANNEL, "one", now, limits);

    expect(isCoolingDown(CHANNEL, now)).toBe(true);
    expect(isCoolingDown(CHANNEL, now + 5_001)).toBe(false);
  });

  test("clears the chain when a human speaks", () => {
    const now = Date.now();
    recordPeerMessage(CHANNEL, "Iris", "peer line");
    recordKeqingReply(CHANNEL, "reply", now, LIMITS);
    expect(getChainContext(CHANNEL).length).toBe(2);

    resetChain(CHANNEL, now);

    expect(getChainContext(CHANNEL)).toEqual([]);
    expect(canReplyToPeer(CHANNEL, true, now, LIMITS)).toBe(true);
  });

  test("a stop instruction clears the chain and starts the cooldown", () => {
    const now = Date.now();
    recordKeqingReply(CHANNEL, "reply", now, LIMITS);

    resetChain(CHANNEL, now, { cooldown: true });

    expect(canReplyToPeer(CHANNEL, true, now, LIMITS)).toBe(false);
    expect(isCoolingDown(CHANNEL, now)).toBe(true);
  });

  test("keeps the chain context in order and bounded", () => {
    const overflow = MAX_CHAIN_CONTEXT_MESSAGES + 12;
    for (let index = 0; index < overflow; index++) {
      recordPeerMessage(CHANNEL, "Iris", `peer ${index}`);
    }

    const context = getChainContext(CHANNEL);

    expect(context.length).toBe(MAX_CHAIN_CONTEXT_MESSAGES);
    expect(context[context.length - 1]).toBe(`Iris: peer ${overflow - 1}`);
  });

  test("bounds the chain context when Keqing replies", () => {
    const now = Date.now();
    const overflow = MAX_CHAIN_CONTEXT_MESSAGES + 12;
    for (let index = 0; index < overflow; index++) {
      recordKeqingReply(CHANNEL, `reply ${index}`, now, LIMITS);
    }

    const context = getChainContext(CHANNEL);

    expect(context.length).toBe(MAX_CHAIN_CONTEXT_MESSAGES);
    expect(context[context.length - 1]).toBe(`Keqing: reply ${overflow - 1}`);
  });

  test("detects a stop instruction only when a talk word is present", () => {
    expect(detectStopInstruction("stop")).toBe(false);
    expect(detectStopInstruction("berhenti")).toBe(false);
    expect(detectStopInstruction("aku berhenti")).toBe(false);
    expect(detectStopInstruction("hello there")).toBe(false);

    expect(detectStopInstruction("stop bot ngomong")).toBe(true);
    expect(detectStopInstruction("berhenti chat")).toBe(true);
    expect(detectStopInstruction("cukup diskusinya")).toBe(true);
    expect(detectStopInstruction("stop talking to each other")).toBe(true);
  });

  test("keeps channel state independent", () => {
    const now = Date.now();
    recordKeqingReply(CHANNEL, "reply", now, LIMITS);

    expect(canReplyToPeer("channel-2", true, now, LIMITS)).toBe(true);
  });

  test("uses the default limits when none are supplied", () => {
    const now = Date.now();
    expect(canReplyToPeer(CHANNEL, true, now)).toBe(true);

    for (let index = 0; index < DEFAULT_MAX_BOT_CHAIN_DEPTH; index++) {
      recordKeqingReply(CHANNEL, `reply ${index}`, now);
    }

    expect(canReplyToPeer(CHANNEL, true, now)).toBe(false);
    expect(isCoolingDown(CHANNEL, now)).toBe(true);
  });

  test("bounds the chain context when Keqing replies past the limit", () => {
    const now = Date.now();
    const overflow = MAX_CHAIN_CONTEXT_MESSAGES + 5;
    for (let index = 0; index < overflow; index++) {
      recordKeqingReply(CHANNEL, `reply ${index}`, now, LIMITS);
    }

    expect(getChainContext(CHANNEL).length).toBe(MAX_CHAIN_CONTEXT_MESSAGES);
  });

  test("clamps requested limits into the accepted range", () => {
    expect(clampChainDepth(0)).toBe(MIN_BOT_CHAIN_DEPTH);
    expect(clampChainDepth(9999)).toBe(MAX_ALLOWED_BOT_CHAIN_DEPTH);
    expect(clampChainDepth(12)).toBe(12);
    expect(clampChainDepth(Number.NaN)).toBe(DEFAULT_MAX_BOT_CHAIN_DEPTH);

    expect(clampCooldownSeconds(0)).toBe(10);
    expect(clampCooldownSeconds(99999)).toBe(3600);
    expect(clampCooldownSeconds(30)).toBe(30);
    expect(clampCooldownSeconds(Number.NaN)).toBe(60);
  });
});
