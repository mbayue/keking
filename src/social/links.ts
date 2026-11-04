import {
  SOCIAL_DOMAINS,
  applyFix,
  getDefaultFixMethod,
  getNextFixMethod,
  getSocialDomain,
  type SocialDomain,
  type SocialDomainId,
} from "./domains.js";

export interface PreviewLink {
  text: string;
  originalUrl: string;
  domainId: SocialDomainId;
  methodId: number;
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
