import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
} from "discord.js";

/**
 * Bot-authored preview cards, modeled on kenhendricks00/FixEmbed:
 * post metadata comes from the public fixembed.app API and is rendered
 * as Components V2 containers (Media Gallery plays video inline —
 * legacy embeds cannot). Falls back to plain mirror links on any failure.
 */
const FIXEMBED_API = "https://fixembed.app/api/embed";
const FETCH_TIMEOUT_MS = 12000;
const RETRY_DELAY_MS = 1500;
const MAX_DESCRIPTION = 1500;
const MAX_MEDIA_ITEMS = 10;

interface FixEmbedPayload {
  title?: unknown;
  description?: unknown;
  caption?: unknown;
  url?: unknown;
  siteName?: unknown;
  authorName?: unknown;
  authorHandle?: unknown;
  authorUrl?: unknown;
  authorAvatar?: unknown;
  color?: unknown;
  timestamp?: unknown;
  stats?: unknown;
  images?: unknown;
  image?: unknown;
  video?: unknown;
  sections?: unknown;
  platform?: unknown;
  sensitive?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function isTombstone(payload: FixEmbedPayload): boolean {
  return (
    Array.isArray(payload.sections) &&
    payload.sections.some(
      (section) =>
        typeof section === "object" &&
        section !== null &&
        "kind" in section &&
        (section as { kind?: unknown }).kind === "tombstone",
    )
  );
}

function parseColor(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const hex = value.startsWith("#") ? value.slice(1) : value;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return Number.parseInt(hex, 16);
}

function videoUrl(payload: FixEmbedPayload): string | null {
  if (typeof payload.video !== "object" || payload.video === null) return null;
  if (!("url" in payload.video) || typeof payload.video.url !== "string") return null;
  return payload.video.url.length > 0 ? payload.video.url : null;
}


/** "💬 236 🔁 505" -> "💬 236 • 🔁 505" so stats breathe. Falls back to raw. */
function spreadStats(stats: string | null): string | null {
  if (!stats) return null;
  const tokens = stats.split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length < 2 || tokens.length % 2 !== 0) return stats;
  const pairs: string[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    pairs.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return pairs.length > 0 ? pairs.join(" • ") : stats;
}

/** "r/s • u/a • 8184 upvotes • 445 comments" -> "⬆ 8184 • 💬 445". Needs both counts. */
function extractCountBefore(desc: string, keyword: string): string | null {
  const idx = desc.indexOf(keyword);
  if (idx < 0) return null;
  const token = desc.slice(0, idx).trimEnd().split(/\s+/).pop();
  if (!token || !/\d/.test(token) || /[^0-9.,kKmM]/.test(token)) return null;
  return token;
}

function parseMirrorStats(desc: string | null): string | null {
  if (!desc) return null;
  const upvotes = extractCountBefore(desc, "upvote");
  const comments = extractCountBefore(desc, "comment");
  if (!upvotes || !comments) return null;
  return `⬆ ${upvotes} • 💬 ${comments}`;
}

const MIRROR_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

interface QuotedPost {
  author: string;
  handle: string;
  text: string;
  stats: string | null;
  media: string[];
}

/** Images keep fullsize; videos contribute their thumbnail (playlists are m3u8). */
function blueskyEmbedMedia(embed: Record<string, unknown> | null): string[] {
  if (!embed) return [];
  const type = embed["$type"];
  if (type === "app.bsky.embed.images#view") {
    const images = Array.isArray(embed.images) ? embed.images : [];
    return images.flatMap((image) => {
      const record = asRecord(image);
      const fullsize = record?.fullsize;
      const thumb = record?.thumb;
      if (typeof fullsize === "string" && fullsize.length > 0) return [fullsize];
      if (typeof thumb === "string" && thumb.length > 0) return [thumb];
      return [];
    });
  }
  if (type === "app.bsky.embed.video#view") {
    return typeof embed.thumbnail === "string" && embed.thumbnail.length > 0 ? [embed.thumbnail] : [];
  }
  if (type === "app.bsky.embed.recordWithMedia#view") {
    return blueskyEmbedMedia(asRecord(embed.media));
  }
  return [];
}

const TWITTER_HOSTS = new Set(["twitter.com", "x.com", "mobile.twitter.com"]);

function isTwitterUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return TWITTER_HOSTS.has(host);
  } catch {
    return false;
  }
}

const BLUESKY_HOSTS = new Set(["bsky.app", "bskyx.app", "fxbsky.app", "bskx.app"]);

function isBlueskyUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return BLUESKY_HOSTS.has(host);
  } catch {
    return false;
  }
}

function formatCompact(count: unknown): string | null {
  if (typeof count !== "number" || !Number.isFinite(count)) return null;
  return new Intl.NumberFormat("en", { notation: "compact" }).format(count);
}

/** Quoted post via the public Bluesky API (no auth) — the metadata API drops quotes. */
async function fetchBlueskyQuote(mirrorUrl: string): Promise<QuotedPost | null> {
  const match = /\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(mirrorUrl);
  const handle = match?.[1];
  const rkey = match?.[2];
  if (!handle || !rkey) return null;
  try {
    const did = await resolveBlueskyDid(handle);
    if (!did) return null;
    const atUri = `at://${did}/app.bsky.feed.post/${rkey}`;
    const threadRes = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!threadRes.ok) return null;
    return buildBlueskyQuote(asRecord(asRecord(await threadRes.json())?.thread)?.post);
  } catch {
    return null;
  }
}

async function resolveBlueskyDid(handle: string): Promise<string | null> {
  if (handle.startsWith("did:")) return handle;
  const resolveRes = await fetch(
    `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  );
  if (!resolveRes.ok) return null;
  const resolved: unknown = await resolveRes.json();
  const did = asRecord(resolved)?.did;
  return typeof did === "string" ? did : null;
}

function buildBlueskyQuote(post: unknown): QuotedPost | null {
  const embed = asRecord(asRecord(post)?.embed);
  if (embed?.["$type"] !== "app.bsky.embed.record#view") return null;
  const quoted = asRecord(embed.record);
  if (quoted?.["$type"] !== "app.bsky.embed.record#viewRecord") return null;
  const author = asRecord(quoted.author);
  const value = asRecord(quoted.value);
  const quotedHandle = author?.handle;
  const text = value?.text;
  if (typeof quotedHandle !== "string" || typeof text !== "string" || text.length === 0) return null;
  const displayName = typeof author?.displayName === "string" && author.displayName.length > 0
    ? author.displayName
    : quotedHandle;
  const stats: string[] = [];
  const reposts = formatCompact(quoted.repostCount);
  const likes = formatCompact(quoted.likeCount);
  const replies = formatCompact(quoted.replyCount);
  if (replies) stats.push(`💬 ${replies}`);
  if (reposts) stats.push(`🔁 ${reposts}`);
  if (likes) stats.push(`❤️ ${likes}`);
  const embeds = Array.isArray(quoted.embeds) ? quoted.embeds : [];
  const media = [...new Set(embeds.flatMap((item) => blueskyEmbedMedia(asRecord(item))))].slice(0, MAX_MEDIA_ITEMS);
  return {
    author: displayName,
    handle: quotedHandle,
    text: text.slice(0, 500),
    stats: stats.length > 0 ? stats.join(" • ") : null,
    media,
  };
}
/** FxTwitter's public API (no auth) exposes every photo plus the quoted post. */
function twitterItemMedia(item: unknown): string[] {
  const record = asRecord(item);
  const url = typeof record?.url === "string" && record.url.length > 0 ? record.url : null;
  const thumb = [record?.thumb, record?.thumbnail_url]
    .find((value): value is string => typeof value === "string" && value.length > 0) ?? null;
  if (record?.type === "photo") return url ? [url] : [];
  if (record?.type === "video" || record?.type === "gif") return [url, thumb].filter((value): value is string => value !== null).slice(0, 1);
  return [];
}

async function fetchTwitterEnrichment(originalUrl: string): Promise<{ photos: string[]; quote: QuotedPost | null }> {
  const empty = { photos: [], quote: null };
  const match = /\/(?:i\/web\/status\/|(\w{1,15})\/status\/)(\d+)/.exec(originalUrl);
  const user = match?.[1];
  const id = match?.[2];
  if (!id) return empty;
  try {
    const endpoint = user ? `https://api.fxtwitter.com/${user}/status/${id}` : `https://api.fxtwitter.com/status/${id}`;
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": MIRROR_UA },
    });
    if (!res.ok) return empty;
    const tweet = asRecord(asRecord(await res.json())?.tweet);
    if (!tweet) return empty;
    const items = Array.isArray(asRecord(tweet.media)?.all) ? (asRecord(tweet.media)?.all as unknown[]) : [];
    const photos = [...new Set(items.flatMap((item) => {
      const record = asRecord(item);
      return record?.type === "photo" ? twitterItemMedia(item) : [];
    }))].slice(0, MAX_MEDIA_ITEMS);
    return { photos, quote: buildTwitterQuote(tweet.quote) };
  } catch {
    return empty;
  }
}

function buildTwitterQuote(value: unknown): QuotedPost | null {
  const quoted = asRecord(value);
  const author = asRecord(quoted?.author);
  const handle = author?.screen_name;
  const text = quoted?.text;
  if (typeof handle !== "string" || typeof text !== "string" || text.length === 0) return null;
  const displayName = typeof author?.name === "string" && author.name.length > 0 ? author.name : handle;
  const stats: string[] = [];
  const replies = formatCompact(quoted?.replies);
  const reposts = formatCompact(quoted?.retweets);
  const likes = formatCompact(quoted?.likes);
  if (replies) stats.push(`💬 ${replies}`);
  if (reposts) stats.push(`🔁 ${reposts}`);
  if (likes) stats.push(`❤️ ${likes}`);
  const items = Array.isArray(asRecord(quoted?.media)?.all)
    ? (asRecord(quoted?.media)?.all as unknown[])
    : [];
  const media = [...new Set(items.flatMap((item) => twitterItemMedia(item)))].slice(0, MAX_MEDIA_ITEMS);
  return {
    author: displayName,
    handle,
    text: text.slice(0, 500),
    stats: stats.length > 0 ? stats.join(" • ") : null,
    media,
  };
}


interface MirrorMeta {
  video: string | null;
  image: string | null;
  description: string | null;
}

/** Scrape og:video/og:image/og:description from a mirror page (e.g. xrd embeds direct mp4 links). */
async function fetchMirrorMeta(mirrorUrl: string): Promise<MirrorMeta> {
  const none: MirrorMeta = { video: null, image: null, description: null };
  try {
    const res = await fetch(mirrorUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": MIRROR_UA },
    });
    if (!res.ok) return none;
    const html = await res.text();
    if (html.length > 300_000) return none;
    const tag = (property: string): string | null => {
      const pattern = new RegExp(
        `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']|<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`,
        "i",
      );
      const match = pattern.exec(html);
      const value = match?.[1] ?? match?.[2] ?? null;
      return value ? decodeEntities(value) : null;
    };
    return {
      video: tag("og:video:secure_url") ?? tag("og:video"),
      image: tag("og:image"),
      description: tag("og:description"),
    };
  } catch {
    return none;
  }
}

async function readApiPayload(res: Response): Promise<FixEmbedPayload | null> {
  if (!res.ok) return null;
  const data: unknown = await res.json();
  if (typeof data !== "object" || data === null) return null;
  if (!("success" in data) || data.success !== true) return null;
  if (!("data" in data) || typeof data.data !== "object" || data.data === null) return null;
  const payload = data.data as FixEmbedPayload;
  if (isTombstone(payload)) return null;
  return payload;
}

/**
 * The metadata API only understands canonical video URLs — strip locale
 * prefixes and tracker params (e.g. bilibili `/en/` + `trackid`).
 */
function canonicalApiUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "bilibili.com") {
      const match = /\/(?:[a-z]{2}\/)?video\/(av\d+|BV\w+)/i.exec(url.pathname);
      if (match?.[1]) return `https://www.bilibili.com/video/${match[1]}`;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

async function attemptPostCardFetch(originalUrl: string): Promise<{ payload: FixEmbedPayload | null; retry: boolean }> {
  try {
    const res = await fetch(`${FIXEMBED_API}?url=${encodeURIComponent(canonicalApiUrl(originalUrl))}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    // Rate-limited or upstream hiccup — caller waits once, then retries.
    if (res.status === 429 || res.status >= 500) return { payload: null, retry: true };
    return { payload: await readApiPayload(res), retry: false };
  } catch {
    return { payload: null, retry: true };
  }
}

export async function fetchPostCard(originalUrl: string): Promise<FixEmbedPayload | null> {
  const first = await attemptPostCardFetch(originalUrl);
  if (!first.retry) return first.payload;
  await Bun.sleep(RETRY_DELAY_MS);
  const second = await attemptPostCardFetch(originalUrl);
  return second.payload;
}

function formatQuoteBlock(quote: QuotedPost): string {
  const lines = quote.text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  const stats = quote.stats ? `\n> ${quote.stats}` : "";
  return `\n\n> **${quote.author} (@${quote.handle})**\n${lines}${stats}`;
}

export async function buildCardContainer(
  payload: FixEmbedPayload,
  mirrorUrl: string,
  platformLabel: string,
  extraMirrors: string[] = [],
  quote: QuotedPost | null = null,
  extraMedia: string[] = [],
): Promise<ContainerBuilder | null> {
  const mirrorMeta = await fetchMirrorForCard(payload, mirrorUrl, extraMirrors);
  const body = resolveCardBody(payload, mirrorMeta?.description?.trim() ?? null);
  if (!body) return null;

  const rawHandle = asString(payload.authorHandle) ?? asString(payload.authorName) ?? platformLabel;
  const handle = decodeEntities(rawHandle);
  const header = handle.length > 0 ? `### [${handle}](${asString(payload.authorUrl) ?? mirrorUrl}) • ${platformLabel}` : `### ${platformLabel}`;
  const quoteBlock = quote ? formatQuoteBlock(quote) : "";

  const container = new ContainerBuilder();
  const color = parseColor(payload.color);
  if (color !== null) container.setAccentColor(color);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${header}\n${body}${quoteBlock}`),
  );

  const mediaUrls = [...new Set([...assembleCardMedia(payload, mirrorMeta, extraMedia), ...(quote?.media ?? [])])].slice(0, MAX_MEDIA_ITEMS);
  // First photo large on its own, the rest in a row — mirrors native unfurl layout.
  for (const chunk of mediaUrls.length > 1 ? [mediaUrls.slice(0, 1), mediaUrls.slice(1)] : [mediaUrls]) {
    if (chunk.length === 0) continue;
    const gallery = new MediaGalleryBuilder();
    for (const url of chunk) {
      gallery.addItems(new MediaGalleryItemBuilder().setURL(url));
    }
    container.addMediaGalleryComponents(gallery);
  }

  const mirrorDesc = mirrorMeta?.description?.trim() ?? null;
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(assembleCardFooter(payload, mirrorUrl, mirrorDesc).join(" • ").slice(0, 500)),
  );

  return container;
}

async function fetchMirrorForCard(
  payload: FixEmbedPayload,
  mirrorUrl: string,
  extraMirrors: string[],
): Promise<MirrorMeta | null> {
  // Skip mirror fetch when the API already gave us media.
  const video = videoUrl(payload);
  const images = asStringArray(payload.images);
  if (video || images.length > 0 || asString(payload.image)) return null;
  // The selected mirror may block scrapers while a sibling works (e.g. vxReddit
  // challenges datacenter IPs but xrd answers) — try all in parallel, keep the
  // first with media.
  const urls = [mirrorUrl, ...extraMirrors.filter((url) => url !== mirrorUrl)];
  const metas = await Promise.all(urls.map((url) => fetchMirrorMeta(url)));
  let first: MirrorMeta | null = null;
  for (const meta of metas) {
    if (!meta.image && !meta.video && !meta.description) continue;
    first ??= meta;
    if (meta.image || meta.video) return meta;
  }
  return first;
}


function resolveCardBody(payload: FixEmbedPayload, mirrorDesc: string | null): string | null {
  const description = asString(payload.description);
  const caption = asString(payload.caption);
  const title = asString(payload.title);
  let body = decodeEntities(description ?? caption ?? title ?? "").slice(0, MAX_DESCRIPTION);
  // Text posts often expose a truncated headline via the API; the mirror's
  // og:description usually carries the opening of the real body text.
  if (!description && !caption && mirrorDesc && mirrorDesc !== body && !mirrorDesc.startsWith("r/")) {
    body = `${body}\n\n${mirrorDesc}`.slice(0, MAX_DESCRIPTION);
  }
  if (!body) return null;
  return body;
}

function assembleCardMedia(
  payload: FixEmbedPayload,
  mirrorMeta: MirrorMeta | null,
  extraMedia: string[] = [],
): string[] {
  const video = videoUrl(payload);
  const images = asStringArray(payload.images);
  // A complete photo set beats the single-image fallbacks (same first photo twice).
  const fallbackImage = !video && images.length === 0 && extraMedia.length === 0 ? asString(payload.image) : null;
  const mainVideo = video ?? mirrorMeta?.video;
  const mirrorImage = !mainVideo && extraMedia.length === 0 && mirrorMeta?.image && !/profile_images|\bavatar\b|default_avatar/i.test(mirrorMeta.image) ? mirrorMeta.image : null;
  return [
    ...images,
    ...(fallbackImage ? [fallbackImage] : []),
    ...extraMedia,
    // The player shows its own first frame; don't repeat the poster thumbnail.
    ...(!mainVideo && mirrorImage && !fallbackImage ? [mirrorImage] : []),
    ...(mainVideo ? [mainVideo] : []),
  ].slice(0, MAX_MEDIA_ITEMS);
}

function assembleCardFooter(payload: FixEmbedPayload, mirrorUrl: string, mirrorDesc: string | null): string[] {
  const statsLine = spreadStats(asString(payload.stats)) ?? parseMirrorStats(mirrorDesc);
  const parts: string[] = [];
  if (statsLine) parts.push(statsLine);
  try {
    parts.push(`via ${new URL(mirrorUrl).hostname}`);
  } catch {
    parts.push("via mirror");
  }
  if (typeof payload.timestamp === "string") {
    const time = Math.floor(new Date(payload.timestamp).getTime() / 1000);
    if (!Number.isNaN(time)) parts.push(`<t:${time}:R>`);
  }
  return parts;
}

/** Null = fetch/parse failed or post is sensitive (caller falls back to the plain mirror link). */
export async function buildPreviewCard(
  originalUrl: string,
  mirrorUrl: string,
  platformLabel: string,
  extraMirrors: string[] = [],
): Promise<ContainerBuilder | null> {
  const payload = await fetchPostCard(originalUrl);
  if (!payload) return null;
  if (payload.sensitive === true) return null;
  // Quotes don't survive the metadata API — enrich from the public APIs.
  const quote = isBlueskyUrl(mirrorUrl) ? await fetchBlueskyQuote(mirrorUrl) : null;
  const enrichment = isTwitterUrl(originalUrl) ? await fetchTwitterEnrichment(originalUrl) : null;
  // The metadata API and mirrors expose at most one photo — pull the full set
  // from FxTwitter's public API when the payload has no media of its own.
  const needsPhotos =
    asStringArray(payload.images).length === 0 && !videoUrl(payload) && !asString(payload.image);
  const extraMedia = needsPhotos ? (enrichment?.photos ?? []) : [];
  return buildCardContainer(payload, mirrorUrl, platformLabel, extraMirrors, quote ?? enrichment?.quote ?? null, extraMedia);
}
