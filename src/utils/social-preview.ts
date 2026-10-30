export type SocialDomainId =
  | "twitter"
  | "instagram"
  | "facebook"
  | "reddit"
  | "threads"
  | "tiktok"
  | "pixiv"
  | "bluesky"
  | "bilibili"
  | "pinterest"
  | "tumblr"
  | "twitch"
  | "deviantart";

export interface ReplaceFix {
  kind: "replace";
  oldDomain: string;
  newDomain: string;
  /** Prepended to the path for hosts with special routes (e.g. fb.watch). */
  pathPrefix?: string;
}

export interface AppendFix {
  kind: "append";
  /** Original URL is appended as `base + "/" + rawUrl`. */
  base: string;
}

export type DomainFix = ReplaceFix | AppendFix;

export interface FixMethod {
  id: number;
  name: string;
  fixes: DomainFix[];
  repoUrl?: string;
  default?: boolean;
}

export interface SocialDomain {
  id: SocialDomainId;
  name: string;
  patterns: RegExp[];
  fixMethods: FixMethod[];
  /** Rewrite the path before the host swap (e.g. /reels/ -> /reel/). */
  normalizePath?: (path: string) => string;
}

export interface PreviewLink {
  text: string;
  originalUrl: string;
  domainId: SocialDomainId;
  methodId: number;
}


const STATUS_URL_PATTERN =
  /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com|mobile\.twitter\.com)\/\w{1,15}\/status\/\d+(?:\?[^\s]*)?/gi;
const INSTAGRAM_URL_PATTERN =
  /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|reels)\/[\w-]+(?:\/)?(?:\?[^\s]*)?/gi;
const FACEBOOK_URL_PATTERN =
  /https?:\/\/(?:[\w-]+\.)?facebook\.com\/[^\s]+|https?:\/\/fb\.watch\/[^\s]+/gi;
const REDDIT_URL_PATTERN =
  /https?:\/\/(?:www\.|old\.)?reddit\.com\/[^\s]+|https?:\/\/redd\.it\/[^\s]+/gi;
const THREADS_URL_PATTERN = /https?:\/\/(?:www\.)?threads\.(?:com|net)\/[^\s]+/gi;
const TIKTOK_URL_PATTERN =
  /https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/@[\w.-]+\/video\/\d+(?:\?[^\s]*)?/gi;
const TIKTOK_SHORT_URL_PATTERN = /https?:\/\/v[mt]\.tiktok\.com\/\w+\/?(?:\?[^\s]*)?/gi;
const PIXIV_URL_PATTERN = /https?:\/\/(?:www\.)?pixiv\.net\/(?:en\/)?artworks\/\d+(?:\?[^\s]*)?/gi;
const BLUESKY_URL_PATTERN =
  /https?:\/\/bsky(?:x)?\.app\/profile\/[\w.:-]+\/post\/\w+(?:\?[^\s]*)?/gi;
const BILIBILI_URL_PATTERN = /https?:\/\/(?:www\.)?bilibili\.com\/(?:[a-z]{2}\/)?video\/(?:av\d+|BV\w+)(?:\?[^\s]*)?/gi;
const BILIBILI_SHORT_URL_PATTERN = /https?:\/\/b23\.tv\/\w+(?:\?[^\s]*)?/gi;
const PINTEREST_URL_PATTERN = /https?:\/\/(?:[a-z-]+\.)?pinterest\.com\/pin\/\d+(?:\?[^\s]*)?/gi;
const PINTEREST_SHORT_URL_PATTERN = /https?:\/\/pin\.it\/[\w-]+(?:\?[^\s]*)?/gi;
const TUMBLR_URL_PATTERN = /https?:\/\/[\w-]+\.tumblr\.com\/post\/\d+(?:\/[^\s]*)?/gi;
const TUMBLR_DASHBOARD_URL_PATTERN = /https?:\/\/(?:www\.)?tumblr\.com\/[\w-]+\/\d+(?:\/[^\s]*)?/gi;
const TWITCH_URL_PATTERN =
  /https?:\/\/clips\.twitch\.tv\/[\w-]+|https?:\/\/(?:www\.)?twitch\.tv\/\w+\/clip\/[\w-]+/gi;
const DEVIANTART_URL_PATTERN =
  /https?:\/\/(?:www\.)?deviantart\.com\/[\w-]+\/art\/[\w-]+-\d+|https?:\/\/sta\.sh\/\w+/gi;

// Mirror hosts below were verified live before wiring; rotate with 🔄 if one dies.
export const SOCIAL_DOMAINS: SocialDomain[] = [
  {
    id: "twitter",
    name: "Twitter/X",
    patterns: [STATUS_URL_PATTERN],
    fixMethods: [
      {
        id: 1,
        name: "FixUpX",
        default: true,
        fixes: [
          { kind: "replace", oldDomain: "twitter.com", newDomain: "fixupx.com" },
          { kind: "replace", oldDomain: "x.com", newDomain: "fixupx.com" },
        ],
        repoUrl: "https://github.com/FxEmbed/FxEmbed",
      },
      {
        id: 2,
        name: "BetterTwitFix",
        fixes: [
          { kind: "replace", oldDomain: "twitter.com", newDomain: "vxtwitter.com" },
          { kind: "replace", oldDomain: "x.com", newDomain: "fixvx.com" },
        ],
        repoUrl: "https://github.com/dylanpdx/BetterTwitFix",
      },
      {
        id: 3,
        name: "EmbedEZ",
        fixes: [
          { kind: "replace", oldDomain: "twitter.com", newDomain: "xeezz.com" },
          { kind: "replace", oldDomain: "x.com", newDomain: "xeezz.com" },
        ],
        repoUrl: "https://embedez.com",
      },
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    patterns: [INSTAGRAM_URL_PATTERN],
    normalizePath: (path) => path.replace(/^\/reels\//, "/reel/"),
    fixMethods: [
      {
        id: 1,
        name: "KKInstagram",
        default: true,
        fixes: [{ kind: "replace", oldDomain: "instagram.com", newDomain: "kkinstagram.com" }],
        repoUrl: "https://kkscript.com/",
      },
      {
        id: 2,
        name: "GGInsta",
        fixes: [{ kind: "replace", oldDomain: "instagram.com", newDomain: "gginsta.com" }],
      },
      {
        id: 3,
        name: "InstaFix",
        fixes: [{ kind: "replace", oldDomain: "instagram.com", newDomain: "eeinstagram.com" }],
        repoUrl: "https://github.com/Wikidepia/InstaFix",
      },
      {
        id: 4,
        name: "EmbedEZ",
        fixes: [{ kind: "replace", oldDomain: "instagram.com", newDomain: "g.embedez.com" }],
        repoUrl: "https://embedez.com",
      },
      {
        id: 5,
        name: "vxinstagram",
        fixes: [{ kind: "replace", oldDomain: "instagram.com", newDomain: "fxig.seria.moe" }],
        repoUrl: "https://github.com/Lainmode/InstagramEmbed-vxinstagram",
      },
      {
        id: 6,
        name: "InstaEmbedRouter",
        fixes: [{ kind: "replace", oldDomain: "instagram.com", newDomain: "zzinstagram.com" }],
        repoUrl: "https://github.com/Knoppiix/InstaEmbedRouter",
      },
      {
        id: 7,
        name: "OGInstagram",
        fixes: [{ kind: "replace", oldDomain: "instagram.com", newDomain: "oginstagram.com" }],
        repoUrl: "https://github.com/LilasKR/OGInstagram",
      },
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    patterns: [FACEBOOK_URL_PATTERN],
    fixMethods: [
      {
        id: 1,
        name: "Facebed",
        default: true,
        fixes: [
          { kind: "replace", oldDomain: "facebook.com", newDomain: "facebed.com" },
          { kind: "replace", oldDomain: "fb.watch", newDomain: "facebed.com", pathPrefix: "/fbwatch" },
        ],
        repoUrl: "https://github.com/4pii4/facebed",
      },
      {
        id: 2,
        name: "EmbedEZ",
        fixes: [
          { kind: "replace", oldDomain: "facebook.com", newDomain: "facebookez.com" },
          { kind: "replace", oldDomain: "fb.watch", newDomain: "facebookez.com" },
        ],
        repoUrl: "https://embedez.com",
      },
      {
        id: 3,
        name: "xfa",
        fixes: [
          { kind: "replace", oldDomain: "facebook.com", newDomain: "xfa.gsdm.site" },
          { kind: "replace", oldDomain: "fb.watch", newDomain: "xfa.gsdm.site", pathPrefix: "/fbwatch" },
        ],
      },
    ],
  },
  {
    id: "reddit",
    name: "Reddit",
    patterns: [REDDIT_URL_PATTERN],
    fixMethods: [
      {
        id: 1,
        name: "vxReddit",
        default: true,
        fixes: [
          { kind: "replace", oldDomain: "reddit.com", newDomain: "vxreddit.com" },
          { kind: "replace", oldDomain: "redd.it", newDomain: "vxreddit.com" },
        ],
        repoUrl: "https://github.com/dylanpdx/vxReddit",
      },
      {
        id: 2,
        name: "EmbedEZ",
        fixes: [
          { kind: "replace", oldDomain: "reddit.com", newDomain: "redditez.com" },
          { kind: "replace", oldDomain: "redd.it", newDomain: "redditez.com" },
        ],
        repoUrl: "https://embedez.com",
      },
      {
        id: 3,
        name: "xrd",
        fixes: [
          { kind: "replace", oldDomain: "reddit.com", newDomain: "xrd.gsdm.site" },
          { kind: "replace", oldDomain: "redd.it", newDomain: "xrd.gsdm.site" },
        ],
      },
    ],
  },
  {
    id: "threads",
    name: "Threads",
    patterns: [THREADS_URL_PATTERN],
    fixMethods: [
      {
        id: 1,
        name: "FixThreads",
        default: true,
        fixes: [
          { kind: "replace", oldDomain: "threads.com", newDomain: "fixthreads.seria.moe" },
          { kind: "replace", oldDomain: "threads.net", newDomain: "fixthreads.seria.moe" },
        ],
        repoUrl: "https://github.com/seriaati/fixthreads",
      },
      {
        id: 2,
        name: "FixEmbed",
        fixes: [{ kind: "append", base: "https://fixembed.app/embed" }],
        repoUrl: "https://fixembed.app",
      },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    patterns: [TIKTOK_URL_PATTERN, TIKTOK_SHORT_URL_PATTERN],
    fixMethods: [
      {
        id: 1,
        name: "FxTikTok",
        default: true,
        fixes: [
          { kind: "replace", oldDomain: "tiktok.com", newDomain: "fxtiktok.com" },
        ],
        repoUrl: "https://github.com/okdargy/fxTikTok",
      },
      {
        id: 2,
        name: "EmbedEZ",
        fixes: [
          { kind: "replace", oldDomain: "tiktok.com", newDomain: "tiktokez.com" },
        ],
        repoUrl: "https://embedez.com",
      },
      {
        id: 3,
        name: "KKTikTok",
        fixes: [
          { kind: "replace", oldDomain: "tiktok.com", newDomain: "kktiktok.com" },
        ],
        repoUrl: "https://kkscript.com/",
      },
    ],
  },
  {
    id: "pixiv",
    name: "Pixiv",
    patterns: [PIXIV_URL_PATTERN],
    fixMethods: [
      {
        id: 1,
        name: "Phixiv",
        default: true,
        fixes: [{ kind: "replace", oldDomain: "pixiv.net", newDomain: "phixiv.net" }],
        repoUrl: "https://github.com/thelaao/phixiv",
      },
    ],
  },
  {
    id: "bluesky",
    name: "Bluesky",
    patterns: [BLUESKY_URL_PATTERN],
    fixMethods: [
      {
        id: 1,
        name: "BskyX",
        default: true,
        fixes: [
          { kind: "replace", oldDomain: "bsky.app", newDomain: "bskyx.app" },
          { kind: "replace", oldDomain: "bskyx.app", newDomain: "bskyx.app" },
        ],
      },
      {
        id: 2,
        name: "VixBluesky",
        fixes: [
          { kind: "replace", oldDomain: "bsky.app", newDomain: "bskx.app" },
        ],
        repoUrl: "https://github.com/Lexedia/VixBluesky",
      },
      {
        id: 3,
        name: "FxEmbed",
        fixes: [
          { kind: "replace", oldDomain: "bsky.app", newDomain: "fxbsky.app" },
        ],
        repoUrl: "https://github.com/FxEmbed/FxEmbed",
      },
    ],
  },
  {
    id: "bilibili",
    name: "Bilibili",
    patterns: [BILIBILI_URL_PATTERN, BILIBILI_SHORT_URL_PATTERN],
    fixMethods: [
      {
        id: 1,
        name: "BiliFix",
        default: true,
        fixes: [
          { kind: "replace", oldDomain: "bilibili.com", newDomain: "vxbilibili.com" },
          { kind: "replace", oldDomain: "b23.tv", newDomain: "vxbilibili.com" },
        ],
        repoUrl: "https://vxbilibili.com",
      },
      {
        id: 2,
        name: "FxBilibili",
        fixes: [
          { kind: "replace", oldDomain: "bilibili.com", newDomain: "fxbilibili.seria.moe" },
          { kind: "replace", oldDomain: "b23.tv", newDomain: "fxbilibili.seria.moe" },
        ],
        repoUrl: "https://github.com/seriaati/fxbilibili",
      },
      {
        id: 3,
        name: "EmbedEZ",
        fixes: [
          { kind: "replace", oldDomain: "bilibili.com", newDomain: "bilibiliez.com" },
          { kind: "replace", oldDomain: "b23.tv", newDomain: "bilibiliez.com" },
        ],
        repoUrl: "https://embedez.com",
      },
    ],
  },
  {
    id: "pinterest",
    name: "Pinterest",
    patterns: [PINTEREST_URL_PATTERN, PINTEREST_SHORT_URL_PATTERN],
    fixMethods: [
      {
        id: 1,
        name: "PinterestEZ",
        default: true,
        fixes: [
          { kind: "replace", oldDomain: "pinterest.com", newDomain: "pinterestez.com" },
          { kind: "replace", oldDomain: "pin.it", newDomain: "pinterestez.com" },
        ],
        repoUrl: "https://embedez.com",
      },
    ],
  },
  {
    id: "tumblr",
    name: "Tumblr",
    patterns: [TUMBLR_URL_PATTERN, TUMBLR_DASHBOARD_URL_PATTERN],
    fixMethods: [
      { id: 1, name: "Direct", default: true, fixes: [] },
      {
        id: 2,
        name: "fxtumblr",
        fixes: [{ kind: "replace", oldDomain: "tumblr.com", newDomain: "tpmblr.com" }],
        repoUrl: "https://github.com/knuxify/fxtumblr",
      },
    ],
  },
  {
    id: "twitch",
    name: "Twitch",
    patterns: [TWITCH_URL_PATTERN],
    fixMethods: [
      {
        id: 1,
        name: "FxTwitch",
        default: true,
        fixes: [
          { kind: "replace", oldDomain: "twitch.tv", newDomain: "fxtwitch.seria.moe" },
          { kind: "replace", oldDomain: "clips.twitch.tv", newDomain: "fxtwitch.seria.moe" },
        ],
        repoUrl: "https://github.com/seriaati/fxtwitch",
      },
    ],
  },
  {
    id: "deviantart",
    name: "DeviantArt",
    patterns: [DEVIANTART_URL_PATTERN],
    fixMethods: [
      { id: 1, name: "Direct", default: true, fixes: [] },
      {
        id: 2,
        name: "fxdeviantart",
        fixes: [{ kind: "replace", oldDomain: "deviantart.com", newDomain: "fixdeviantart.com" }],
        repoUrl: "https://github.com/Tschrock/fixdeviantart",
      },
    ],
  },
];

export function getSocialDomain(domainId: SocialDomainId): SocialDomain | null {
  return SOCIAL_DOMAINS.find((domain) => domain.id === domainId) ?? null;
}

export function getDefaultFixMethod(domain: SocialDomain): FixMethod | null {
  return domain.fixMethods.find((method) => method.default) ?? domain.fixMethods[0] ?? null;
}

export function getFixMethod(domainId: SocialDomainId, methodId: number): FixMethod | null {
  const domain = getSocialDomain(domainId);
  return domain?.fixMethods.find((method) => method.id === methodId) ?? null;
}

export function getNextFixMethod(domainId: SocialDomainId, currentMethodId: number): FixMethod | null {
  const domain = getSocialDomain(domainId);
  if (!domain || domain.fixMethods.length === 0) return null;
  const index = domain.fixMethods.findIndex((method) => method.id === currentMethodId);
  const next = domain.fixMethods[(index + 1) % domain.fixMethods.length];
  return next ?? null;
}

export function applyFix(rawUrl: string, method: FixMethod, domain: SocialDomain): string | null {
  // No fixes: API-only domain (e.g. Tumblr) — the card is the preview, original URL is the fallback.
  if (method.fixes.length === 0) return rawUrl;
  for (const fix of method.fixes) {
    if (fix.kind === "append") {
      return `${fix.base}/${rawUrl}`;
    }

    try {
      const url = new URL(rawUrl);
      const lowered = url.hostname.toLowerCase();
      const host = lowered.startsWith("www.") ? lowered.slice(4) : lowered;
      const old = fix.oldDomain.toLowerCase();
      if (host !== old && !host.endsWith(`.${old}`)) {
        continue;
      }
      url.hostname = fix.newDomain;
      if (domain.normalizePath) {
        url.pathname = domain.normalizePath(url.pathname);
      }
      const prefix = fix.pathPrefix ?? "";
      return prefix ? `https://${fix.newDomain}${prefix}${url.pathname}${url.search}` : url.toString();
    } catch {
      return null;
    }
  }
  return null;
}

export function resolveFix(rawUrl: string): { domain: SocialDomain; method: FixMethod } | null {
  for (const domain of SOCIAL_DOMAINS) {
    if (!domain.patterns.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(rawUrl);
    })) {
      continue;
    }
    const method = getDefaultFixMethod(domain);
    if (!method) continue;
    return { domain, method };
  }
  return null;
}

/** Every method's mirror URL for a raw link, default method first, deduped. */
export function mirrorCandidates(rawUrl: string): string[] {
  const resolved = resolveFix(rawUrl);
  if (!resolved) return [];
  const ordered = [
    resolved.method,
    ...resolved.domain.fixMethods.filter((method) => method.id !== resolved.method.id),
  ];
  const urls: string[] = [];
  for (const method of ordered) {
    const text = applyFix(rawUrl, method, resolved.domain);
    if (text && !urls.includes(text)) urls.push(text);
  }
  return urls;
}

function stripOptedOutUrls(content: string): string {
  // <https://...> suppresses embeds client-side; $ prefix is the explicit opt-out.
  return content
    .replace(/<(https?:\/\/[^>\s]+)>/g, "")
    .replace(/\$https?:\/\/\S+/g, "");
}
export function extractSocialMirrorLinks(content: string): PreviewLink[] {
  const visible = stripOptedOutUrls(content);
  const links = new Map<string, PreviewLink>();

  for (const domain of SOCIAL_DOMAINS) {
    for (const pattern of domain.patterns) {
      collectPatternLinks(visible, domain, pattern, links);
    }
  }

  return [...links.values()];
}

function collectPatternLinks(
  visible: string,
  domain: SocialDomain,
  pattern: RegExp,
  links: Map<string, PreviewLink>,
): void {
  pattern.lastIndex = 0;
  for (const match of visible.matchAll(pattern)) {
    const rawUrl = match[0];
    if (!rawUrl) continue;

    const method = getDefaultFixMethod(domain);
    if (!method) continue;

    const text = applyFix(rawUrl, method, domain);
    if (!text) continue;

    links.set(text, { text, originalUrl: rawUrl, domainId: domain.id, methodId: method.id });
  }
}

export function isSocialDomainId(value: unknown): value is SocialDomainId {
  return typeof value === "string" && SOCIAL_DOMAINS.some((domain) => domain.id === value);
}

export function rotatePreviewLink(link: {
  originalUrl: string;
  domainId: SocialDomainId;
  methodId: number;
}): PreviewLink | null {
  const next = getNextFixMethod(link.domainId, link.methodId);
  const domain = getSocialDomain(link.domainId);
  if (!next || !domain) return null;
  const text = applyFix(link.originalUrl, next, domain);
  if (!text) return null;
  return { ...link, text, methodId: next.id };
}
