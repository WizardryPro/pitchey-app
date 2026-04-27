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

// All OG images are 1200×630 PNGs out of `workers-og`. Hard-coded so the
// dimension/type meta tags are always populated — WhatsApp, in particular,
// falls back to a square crop or no image when these aren't set.
const OG_IMAGE_WIDTH = '1200';
const OG_IMAGE_HEIGHT = '630';
const OG_IMAGE_TYPE = 'image/png';

/**
 * Apply OG meta to an HTML response (typically index.html from ASSETS).
 *
 * Replaces the static og:* / twitter:* meta values, the <title>, the
 * <meta name="description">, the <link rel="canonical">. Appends profile-only
 * tags (og:profile:username etc.) since they don't exist in the static index.
 *
 * Also appends `og:image:width`, `og:image:height`, `og:image:type`,
 * `og:image:secure_url`, `twitter:image:alt` because these aren't in the
 * static template. WhatsApp's renderer is the strictest about these — without
 * width/height it sometimes shows a square crop, no image, or just the favicon.
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

  // Image-dimension meta (recommended by Meta/Facebook docs, required-ish by
  // WhatsApp). All our cards are 1200×630 PNGs from workers-og.
  const headExtras: string[] = [
    `<meta property="og:image:secure_url" content="${escapeAttr(meta.image)}" />`,
    `<meta property="og:image:type" content="${OG_IMAGE_TYPE}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />`,
    `<meta property="og:image:alt" content="${escapeAttr(meta.title)}" />`,
    `<meta name="twitter:image:alt" content="${escapeAttr(meta.title)}" />`,
  ];

  if (meta.type === 'profile') {
    if (meta.username) {
      headExtras.push(
        `<meta property="og:profile:username" content="${escapeAttr(meta.username)}" />`
      );
    }
    if (meta.firstName) {
      headExtras.push(
        `<meta property="og:profile:first_name" content="${escapeAttr(meta.firstName)}" />`
      );
    }
  }

  return new HTMLRewriter()
    .on('title', new TitleRewriter(meta.title))
    .on('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]', new MetaRewriter(map))
    .on('link[rel="canonical"]', new CanonicalRewriter(meta.url))
    .on('head', new HeadAppender(headExtras.join('\n')))
    .transform(html);
}

/**
 * Truncate to a budget. We aim for 160 chars: LinkedIn truncates around 115,
 * Facebook around 155, X around 200. 160 keeps us inside FB's window and
 * leaves a tail for X without being cut by either. Earlier 200 was getting
 * trimmed mid-sentence on LinkedIn previews.
 */
export function clampDescription(s: string | null | undefined, max = 160): string {
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

