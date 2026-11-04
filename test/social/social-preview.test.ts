import { describe, expect, test } from "bun:test";

import { mirrorCandidates } from "../../src/social/domains.ts";
import { extractSocialMirrorLinks, rotatePreviewLink } from "../../src/social/links.ts";

describe("social preview rewriting", () => {
  test("rewrites an X status to FixUpX", () => {
    const links = extractSocialMirrorLinks("look https://x.com/alice/status/12345");
    expect(links).toHaveLength(1);
    expect(links[0]?.domainId).toBe("twitter");
    expect(links[0]?.text).toBe("https://fixupx.com/alice/status/12345");
  });

  test("ignores opted-out links", () => {
    expect(
      extractSocialMirrorLinks(
        "$https://x.com/a/status/1 <https://x.com/b/status/2> https://x.com/c/status/3",
      ),
    ).toHaveLength(1);
  });

  test("normalizes Instagram reels paths", () => {
    const links = extractSocialMirrorLinks("https://www.instagram.com/reels/ABC123/");
    expect(links).toHaveLength(1);
    expect(links[0]?.text).toBe("https://kkinstagram.com/reel/ABC123/");
  });

  test("lists mirror fallbacks in default-first order", () => {
    const candidates = mirrorCandidates("https://x.com/alice/status/12345");
    expect(candidates).toContain("https://fixupx.com/alice/status/12345");
    expect(candidates).toContain("https://fixvx.com/alice/status/12345");
    expect(candidates).toContain("https://xeezz.com/alice/status/12345");
  });

  test("rotates a preview to the next fix method", () => {
    const [link] = extractSocialMirrorLinks("https://x.com/alice/status/12345");
    expect(link).toBeDefined();
    const rotated = rotatePreviewLink({
      originalUrl: link!.originalUrl,
      domainId: link!.domainId,
      methodId: link!.methodId,
    });
    expect(rotated?.methodId).toBe(2);
    expect(rotated?.text).toBe("https://fixvx.com/alice/status/12345");
  });

  test("Threads FixEmbed uses an append rewrite", () => {
    const candidates = mirrorCandidates("https://www.threads.net/@alice/post/xyz");
    expect(candidates.some((url) => url.startsWith("https://fixembed.app/embed/"))).toBe(true);
  });
});
