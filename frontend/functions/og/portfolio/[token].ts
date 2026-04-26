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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const token = String(params.token || '');
  if (!token) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

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

    return await renderPortfolioCard({
      creatorName: displayName,
      username: creator.username,
      avatarUrl: creator.avatar_url,
      pitchCount: pitches.length,
    });
  } catch {
    return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);
  }
};
