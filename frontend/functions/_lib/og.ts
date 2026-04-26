/**
 * Shared HTMLRewriter helpers for social-unfurl Pages Functions.
 *
 * Bots (facebookexternalhit, Twitterbot, LinkedInBot, Slackbot, Discordbot,
 * WhatsApp, Telegram) scrape the static HTML response and never execute the
 * SPA. We rewrite the OG/Twitter meta tags in `index.html` so the unfurl shows
 * the creator/slate's branded card. Humans get the same HTML; the JS bundle
 * loads and React Router takes over.
 */

export interface OgMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  type: 'profile' | 'website';
  twitterCard: 'summary' | 'summary_large_image';
  // Optional profile-only fields
  username?: string;
  firstName?: string;
}

export const DEFAULT_FALLBACK_IMAGE = 'https://pitchey.com/pitcheylogo.png';

// Field names avoid clashing with HTMLRewriter handler methods
// (`text`, `element`, `comments`, `doctype`, `end`).
class TitleRewriter {
  constructor(public titleText: string) {}
  element(el: Element) {
    el.setInnerContent(this.titleText);
  }
}

class MetaRewriter {
  constructor(public map: Record<string, string>) {}
  element(el: Element) {
    const property = el.getAttribute('property') || el.getAttribute('name');
    if (!property) return;
    const v = this.map[property];
    if (v !== undefined) el.setAttribute('content', v);
  }
}

class CanonicalRewriter {
  constructor(public href: string) {}
  element(el: Element) {
    el.setAttribute('href', this.href);
  }
}

class HeadAppender {
  constructor(public extraHtml: string) {}
  element(el: Element) {
    el.append(this.extraHtml, { html: true });
  }
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}

/**
 * Apply OG meta to an HTML response (typically index.html from ASSETS).
 *
 * Replaces the static og:* / twitter:* meta values, the <title>, the
 * <meta name="description">, the <link rel="canonical">. Appends profile-only
 * tags (og:profile:username etc.) since they don't exist in the static index.
 */
export function applyOgMeta(html: Response, meta: OgMeta): Response {
  const map: Record<string, string> = {
    description: meta.description,
    'og:type': meta.type,
    'og:url': meta.url,
    'og:title': meta.title,
    'og:description': meta.description,
    'og:image': meta.image,
    'og:site_name': 'Pitchey',
    'twitter:card': meta.twitterCard,
    'twitter:title': meta.title,
    'twitter:description': meta.description,
    'twitter:image': meta.image,
  };

  const profileExtras: string[] = [];
  if (meta.type === 'profile') {
    if (meta.username) {
      profileExtras.push(
        `<meta property="og:profile:username" content="${escapeAttr(meta.username)}" />`
      );
    }
    if (meta.firstName) {
      profileExtras.push(
        `<meta property="og:profile:first_name" content="${escapeAttr(meta.firstName)}" />`
      );
    }
  }

  let rw = new HTMLRewriter()
    .on('title', new TitleRewriter(meta.title))
    .on('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]', new MetaRewriter(map))
    .on('link[rel="canonical"]', new CanonicalRewriter(meta.url));

  if (profileExtras.length > 0) {
    rw = rw.on('head', new HeadAppender(profileExtras.join('\n')));
  }

  return rw.transform(html);
}

/**
 * Truncate to a budget; OG description sweet spot is ~155-200 chars (LinkedIn
 * cuts at 200, Twitter at 200, Facebook at 300). We aim for 200 to stay safe.
 */
export function clampDescription(s: string | null | undefined, max = 200): string {
  const v = (s || '').trim().replace(/\s+/g, ' ');
  if (!v) return '';
  if (v.length <= max) return v;
  return v.slice(0, max - 1).trimEnd() + '…';
}

/** Strip newlines and clamp; titles too long get truncated by every platform. */
export function clampTitle(s: string, max = 70): string {
  const v = s.trim().replace(/\s+/g, ' ');
  if (v.length <= max) return v;
  return v.slice(0, max - 1).trimEnd() + '…';
}

/** Resolve canonical URL, preferring request origin (same domain the user shared). */
export function canonicalUrl(request: Request, pathname: string): string {
  return new URL(pathname, new URL(request.url).origin).toString();
}

export const DEFAULT_BACKEND_URL = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
