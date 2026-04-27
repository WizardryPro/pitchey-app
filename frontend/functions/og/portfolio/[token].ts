/**
 * GET /og/portfolio/:token — branded 1200×630 OG image for a portfolio share.
 *
 * On any failure (API error, missing data, render throw): 302 redirect to the
 * raw avatar URL or the Pitchey logo. Better an unstyled image in the unfurl
 * than a broken one.
 */
import { renderPortfolioCard } from '../../_lib/og-image';
import { DEFAULT_BACKEND_URL, DEFAULT_FALLBACK_IMAGE } from '../../_lib/og';

interface Env {
  API_BACKEND_URL?: string;
}

interface PortfolioApi {
  success: boolean;
  data?: {
    creator: {
      name: string;
      username: string | null;
      avatar_url: string | null;
    };
    pitches: Array<{ cover_image: string | null }>;
  };
}

function fallbackRedirect(target: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': 'public, max-age=60',
    },
  });
}

// See og/pitch/[id].ts for why this is `onRequest` (not `onRequestGet`)
// and why we plumb caching explicitly with `caches.default`.
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params, waitUntil } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const token = String(params.token || '');
  if (!token) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

  const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    return request.method === 'HEAD'
      ? new Response(null, { status: cached.status, headers: cached.headers })
      : cached;
  }

  try {
    const backend = env.API_BACKEND_URL || DEFAULT_BACKEND_URL;
    const apiRes = await fetch(`${backend}/api/portfolio/s/${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true } as RequestInitCfProperties,
    });
    if (!apiRes.ok) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

    const json = await apiRes.json() as PortfolioApi;
    if (!json.success || !json.data) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

    const { creator, pitches } = json.data;
    const displayName = creator.name?.trim() || creator.username?.trim() || 'Creator';

    const rendered = await renderPortfolioCard({
      creatorName: displayName,
      username: creator.username,
      avatarUrl: creator.avatar_url,
      pitchCount: pitches.length,
    });

    waitUntil(cache.put(cacheKey, rendered.clone()));

    return request.method === 'HEAD'
      ? new Response(null, { status: rendered.status, headers: rendered.headers })
      : rendered;
  } catch {
    return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);
  }
};
