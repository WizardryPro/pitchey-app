/**
 * GET /portfolio/s/:token — branded social-unfurl HTML.
 *
 * Fetches the public portfolio data server-side, rewrites the static OG/Twitter
 * meta tags in index.html, returns the rewritten HTML. Humans hydrate the SPA
 * normally (SharedPortfolio.tsx); bots see the creator's branded card.
 *
 * Failure mode: any error → return the unmodified index.html. Never break the
 * user-facing page just because OG generation failed.
 */
import {
  applyOgMeta,
  clampDescription,
  clampTitle,
  canonicalUrl,
  DEFAULT_BACKEND_URL,
  type OgMeta,
} from '../../_lib/og';

interface Env {
  API_BACKEND_URL?: string;
}

interface PortfolioApi {
  success: boolean;
  data?: {
    creator: {
      id: number;
      name: string;
      username: string | null;
      bio: string | null;
      avatar_url: string | null;
      is_verified: boolean;
    };
    pitches: Array<{
      id: number;
      title: string;
      logline: string | null;
      cover_image: string | null;
    }>;
    og_version?: number;
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const token = String(params.token || '');

  // Fetch the SPA index.html via same-origin HTTP. We can't use
  // `env.ASSETS.fetch('/index.html')` because the `_redirects` rule
  // `/* /index.html 200!` causes that path to bounce back as a 308 → /.
  // We can't use `context.next()` either — that loops back through this
  // function via the middleware passthrough. Plain HTTP fetch is the only
  // path that cleanly resolves to the static index.html.
  const origin = new URL(request.url).origin;
  const indexResponse = await fetch(`${origin}/index.html`, {
    headers: { Accept: 'text/html' },
  });

  if (!token) return indexResponse;

  try {
    const backend = env.API_BACKEND_URL || DEFAULT_BACKEND_URL;
    const apiRes = await fetch(`${backend}/api/portfolio/s/${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json' },
    });

    if (!apiRes.ok) return indexResponse;
    const json = await apiRes.json() as PortfolioApi;
    if (!json.success || !json.data) return indexResponse;

    const { creator, pitches, og_version } = json.data;
    const displayName = creator.name?.trim() || creator.username?.trim() || 'Creator';
    const pitchCount = pitches.length;
    const pitchWord = pitchCount === 1 ? 'pitch' : 'pitches';

    // Branded composite. `?v=<og_version>` cache-busts the OG image whenever
    // the creator profile or any of their pitches changes (CDN cache key
    // changes immediately on edit, no manual invalidation).
    const versionParam = og_version ? `?v=${og_version}` : '';
    const ogImage = canonicalUrl(request, `/og/portfolio/${encodeURIComponent(token)}${versionParam}`);

    // Description preference: creator bio → "X pitches available on Pitchey"
    const description = creator.bio?.trim()
      ? clampDescription(creator.bio)
      : `${displayName} has ${pitchCount} ${pitchWord} on Pitchey. Browse their portfolio.`;

    const meta: OgMeta = {
      title: clampTitle(`${displayName} on Pitchey`),
      description,
      url: canonicalUrl(request, `/portfolio/s/${token}`),
      image: ogImage,
      type: 'profile',
      twitterCard: 'summary_large_image',
      username: creator.username || undefined,
      firstName: displayName.split(/\s+/)[0],
    };

    return applyOgMeta(indexResponse, meta);
  } catch {
    return indexResponse;
  }
};
