/**
 * GET /og/pitch/:id — branded 1200×630 OG image for a pitch detail page.
 *
 * Status='published' guard happens here too — querying /og/pitch/<draft_id>
 * returns the fallback redirect (so leaked draft IDs can't be used to scrape
 * a card).
 */
import { renderPitchCard } from '../../_lib/og-image';
import { DEFAULT_BACKEND_URL, DEFAULT_FALLBACK_IMAGE } from '../../_lib/og';

interface Env {
  API_BACKEND_URL?: string;
}

interface PitchApi {
  success: boolean;
  data?: {
    pitch: {
      id: number;
      title: string;
      logline: string | null;
      genre: string | null;
      title_image: string | null;
      creator_name: string | null;
      status: string;
    };
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
  const pitchId = parseInt(String(params.id || ''), 10);
  if (!pitchId || isNaN(pitchId)) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

  try {
    const backend = env.API_BACKEND_URL || DEFAULT_BACKEND_URL;
    const apiRes = await fetch(`${backend}/api/pitches/${pitchId}`, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true } as RequestInitCfProperties,
    });
    if (!apiRes.ok) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

    const json = await apiRes.json() as PitchApi;
    if (!json.success || !json.data?.pitch) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

    const pitch = json.data.pitch;
    if (pitch.status !== 'published') return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

    return await renderPitchCard({
      title: pitch.title,
      logline: pitch.logline,
      genre: pitch.genre,
      creatorName: pitch.creator_name?.trim() || 'a creator',
      coverImageUrl: pitch.title_image,
    });
  } catch {
    return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);
  }
};
