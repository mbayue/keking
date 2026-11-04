import { describe, expect, test } from "bun:test";

import {
  applyFix,
  getDefaultFixMethod,
  getFixMethod,
  getNextFixMethod,
  getSocialDomain,
  isSocialDomainId,
  mirrorCandidates,
  resolveFix,
  type FixMethod,
  type SocialDomain,
} from "../../src/social/domains.ts";

const testDomain: SocialDomain = {
  id: "twitter",
  name: "Test",
  patterns: [],
  fixMethods: [],
};

const noFixMethod: FixMethod = { id: 1, name: "Direct", fixes: [] };

describe("social domain helpers", () => {
  test("looks up domains and fix methods", () => {
    expect(getSocialDomain("twitter")?.name).toBe("Twitter/X");
    expect(getSocialDomain("missing" as never)).toBeNull();
    expect(getFixMethod("twitter", 2)?.name).toBe("BetterTwitFix");
    expect(getFixMethod("twitter", 999)).toBeNull();
  });

  test("falls back to the first fix method", () => {
    expect(getDefaultFixMethod({ ...testDomain, fixMethods: [noFixMethod] })).toEqual(noFixMethod);
    expect(getDefaultFixMethod(testDomain)).toBeNull();
  });

  test("wraps and resolves next fix methods", () => {
    expect(getNextFixMethod("twitter", 3)?.id).toBe(1);
    expect(getNextFixMethod("twitter", 999)?.id).toBe(1);
    expect(getNextFixMethod("missing" as never, 1)).toBeNull();
  });

  test("applies no-op, append, replace, normalize, and prefix fixes", () => {
    expect(applyFix("https://x.com/a/status/1", noFixMethod, testDomain)).toBe(
      "https://x.com/a/status/1",
    );

    expect(applyFix("https://x.com/a", {
      id: 1,
      name: "Append",
      fixes: [{ kind: "append", base: "https://embed.test" }],
    }, testDomain)).toBe("https://embed.test/https://x.com/a");

    expect(applyFix("https://www.x.com/a", {
      id: 1,
      name: "Replace",
      fixes: [{ kind: "replace", oldDomain: "x.com", newDomain: "fix.test" }],
    }, testDomain)).toBe("https://fix.test/a");

    const instagram = getSocialDomain("instagram")!;
    const instagramMethod = getFixMethod("instagram", 1)!;
    expect(applyFix("https://instagram.com/reels/ABC/", instagramMethod, instagram)).toBe(
      "https://kkinstagram.com/reel/ABC/",
    );

    const facebook = getSocialDomain("facebook")!;
    const facebookMethod = getFixMethod("facebook", 1)!;
    expect(applyFix("https://fb.watch/abc/", facebookMethod, facebook)).toBe(
      "https://facebed.com/fbwatch/abc/",
    );
  });

  test("returns null for invalid or non-matching URLs", () => {
    expect(applyFix("not a url", {
      id: 1,
      name: "Replace",
      fixes: [{ kind: "replace", oldDomain: "x.com", newDomain: "fix.test" }],
    }, testDomain)).toBeNull();

    expect(applyFix("https://example.com/a", {
      id: 1,
      name: "Replace",
      fixes: [{ kind: "replace", oldDomain: "x.com", newDomain: "fix.test" }],
    }, testDomain)).toBeNull();
  });

  test("resolves domains and handles domains without methods", () => {
    expect(resolveFix("https://x.com/a/status/1")?.domain.id).toBe("twitter");
    expect(resolveFix("https://example.com", [])).toBeNull();
    expect(resolveFix("https://x.com/a", [{
      ...testDomain,
      patterns: [/x\.com/],
      fixMethods: [],
    }])).toBeNull();
  });

  test("builds deduplicated mirror candidates", () => {
    expect(mirrorCandidates("https://example.com")).toEqual([]);
    const candidates = mirrorCandidates("https://x.com/alice/status/1");
    expect(candidates[0]).toBe("https://fixupx.com/alice/status/1");
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  test("validates domain ids", () => {
    expect(isSocialDomainId("twitter")).toBe(true);
    expect(isSocialDomainId("missing")).toBe(false);
    expect(isSocialDomainId(42)).toBe(false);
  });
});
