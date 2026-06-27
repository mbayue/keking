import { config } from "../config.js";

const STATUS_URL_PATTERN =
  /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com|mobile\.twitter\.com)\/([A-Za-z0-9_]{1,15})\/status\/(\d+)(?:\?[^\s]*)?/gi;
const INSTAGRAM_URL_PATTERN =
  /https?:\/\/(?:www\.)?instagram\.com\/(p|reel|reels)\/([A-Za-z0-9_-]+)(?:\/)?(?:\?[^\s]*)?/gi;
export const FACEBOOK_URL_PATTERN = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?facebook\.com\/[^\s]+|https?:\/\/fb\.watch\/[^\s]+/gi;
const REDDIT_URL_PATTERN = /https?:\/\/(?:www\.|old\.)?reddit\.com\/[^\s]+|https?:\/\/redd\.it\/[^\s]+/gi;

function normalizeUrl(username: string, statusId: string): string {
  return `https://fixupx.com/${username}/status/${statusId}`;
}

function normalizeInstagramUrl(kind: string, shortcode: string): string {
  return `https://kkinstagram.com/${kind}/${shortcode}`;
}

function normalizeFacebookUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const scraperDomain = config.facebookScraperDomain;

    if (url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com")) {
      url.hostname = scraperDomain;
      return url.toString();
    }

    if (url.hostname === "fb.watch") {
      const path = url.pathname;
      return `https://${scraperDomain}/fbwatch${path}${url.search}`;
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeRedditUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const scraperDomain = config.redditScraperDomain;

    if (
      url.hostname === "reddit.com" ||
      url.hostname === "www.reddit.com" ||
      url.hostname === "old.reddit.com" ||
      url.hostname === "redd.it"
    ) {
      url.hostname = scraperDomain;
      return url.toString();
    }

    return null;
  } catch {
    return null;
  }
}

export function extractSocialMirrorLinks(content: string): string[] {
  const links = new Map<string, string>();

  for (const match of content.matchAll(STATUS_URL_PATTERN)) {
    const username = match[1];
    const statusId = match[2];

    if (!username || !statusId) {
      continue;
    }

    links.set(`${username}/${statusId}`, normalizeUrl(username, statusId));
  }

  for (const match of content.matchAll(INSTAGRAM_URL_PATTERN)) {
    const kind = match[1];
    const shortcode = match[2];

    if (!kind || !shortcode) {
      continue;
    }

    const normalizedKind = kind.toLowerCase() === "reels" ? "reel" : kind.toLowerCase();
    links.set(`${normalizedKind}/${shortcode}`, normalizeInstagramUrl(normalizedKind, shortcode));
  }

  for (const match of content.matchAll(REDDIT_URL_PATTERN)) {
    const rawUrl = match[0];

    if (!rawUrl) {
      continue;
    }

    const normalizedUrl = normalizeRedditUrl(rawUrl);

    if (!normalizedUrl) {
      continue;
    }

    links.set(normalizedUrl, normalizedUrl);
  }

  for (const match of content.matchAll(FACEBOOK_URL_PATTERN)) {
    const rawUrl = match[0];

    if (!rawUrl) {
      continue;
    }

    const normalizedUrl = normalizeFacebookUrl(rawUrl);

    if (!normalizedUrl) {
      continue;
    }

    links.set(normalizedUrl, normalizedUrl);
  }

  return [...links.values()];
}
