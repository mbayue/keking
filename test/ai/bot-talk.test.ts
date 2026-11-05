import { beforeEach, describe, expect, test } from "bun:test";

import {
  BOT_CHAIN_COOLDOWN_MS,
  MAX_BOT_CHAIN_DEPTH,
  canReplyToPeer,
  detectStopInstruction,
  getChainContext,
  isCoolingDown,
  recordKeqingReply,
  recordPeerMessage,
  resetBotTalkState,
  resetChain,
} from "../../src/ai/keqing/bot-talk.ts";

const CHANNEL = "channel-1";

beforeEach(() => {
  resetBotTalkState();
});

describe("bot talk guards", () => {
  test("allows a reply while the feature is enabled and the chain has room", () => {
    expect(canReplyToPeer(CHANNEL, true, Date.now())).toBe(true);
  });

  test("refuses a reply when the feature is disabled", () => {
    expect(canReplyToPeer(CHANNEL, false, Date.now())).toBe(false);
  });

  test("stops replying once the chain hits its depth limit", () => {
    const now = Date.now();
    for (let index = 0; index < MAX_BOT_CHAIN_DEPTH; index++) {
      recordPeerMessage(CHANNEL, "Iris", `line ${index}`);
      expect(canReplyToPeer(CHANNEL, true, now)).toBe(true);
      recordKeqingReply(CHANNEL, `reply ${index}`, now);
    }

    expect(canReplyToPeer(CHANNEL, true, now)).toBe(false);
  });

  test("starts a cooldown once the chain hits its depth limit", () => {
    const now = Date.now();
    for (let index = 0; index < MAX_BOT_CHAIN_DEPTH; index++) {
      recordKeqingReply(CHANNEL, `reply ${index}`, now);
    }

    expect(isCoolingDown(CHANNEL, now)).toBe(true);
    expect(isCoolingDown(CHANNEL, now + BOT_CHAIN_COOLDOWN_MS + 1)).toBe(false);
  });

  test("clears the chain when a human speaks", () => {
    const now = Date.now();
    recordPeerMessage(CHANNEL, "Iris", "peer line");
    recordKeqingReply(CHANNEL, "reply", now);
    expect(getChainContext(CHANNEL).length).toBe(2);

    resetChain(CHANNEL, now);

    expect(getChainContext(CHANNEL)).toEqual([]);
    expect(canReplyToPeer(CHANNEL, true, now)).toBe(true);
  });

  test("a stop instruction clears the chain and starts the cooldown", () => {
    const now = Date.now();
    recordKeqingReply(CHANNEL, "reply", now);

    resetChain(CHANNEL, now, { cooldown: true });

    expect(canReplyToPeer(CHANNEL, true, now)).toBe(false);
    expect(isCoolingDown(CHANNEL, now)).toBe(true);
  });

  test("keeps the chain context in order and bounded", () => {
    for (let index = 0; index < 20; index++) {
      recordPeerMessage(CHANNEL, "Iris", `peer ${index}`);
    }

    const context = getChainContext(CHANNEL);

    expect(context.length).toBeLessThanOrEqual(8);
    expect(context[context.length - 1]).toBe("Iris: peer 19");
  });

  test("bounds the chain context when Keqing replies", () => {
    const now = Date.now();
    for (let index = 0; index < 20; index++) {
      recordKeqingReply(CHANNEL, `reply ${index}`, now);
    }

    const context = getChainContext(CHANNEL);

    expect(context.length).toBeLessThanOrEqual(8);
    expect(context[context.length - 1]).toBe("Keqing: reply 19");
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
    recordKeqingReply(CHANNEL, "reply", now);

    expect(canReplyToPeer("channel-2", true, now)).toBe(true);
  });
});
