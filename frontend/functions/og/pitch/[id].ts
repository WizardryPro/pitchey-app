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

// `onRequest` handles GET and HEAD with the same code path. Without this,
// HEAD requests fall through to the SPA middleware and return text/html —
// which makes Meta crawlers (WhatsApp/Instagram) that HEAD-before-GET reject
// the URL as "not an image".
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params, waitUntil } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const pitchId = parseInt(String(params.id || ''), 10);
  if (!pitchId || isNaN(pitchId)) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

  // Explicit Cache API. CF Pages Functions don't auto-cache responses based
  // on Cache-Control alone; we have to plumb it ourselves. The cache key is
  // the full URL (including ?v=<og_version>), so an entity edit invalidates
  // automatically. After the first cold ~2s render, subsequent fetches are
  // <50ms — critical for WhatsApp's ~3s crawler timeout.
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
    const apiRes = await fetch(`${backend}/api/pitches/${pitchId}`, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true } as RequestInitCfProperties,
    });
    if (!apiRes.ok) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

    const json = await apiRes.json() as PitchApi;
    if (!json.success || !json.data?.pitch) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

    const pitch = json.data.pitch;
    if (pitch.status !== 'published') return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

    const rendered = await renderPitchCard({
      title: pitch.title,
      logline: pitch.logline,
      genre: pitch.genre,
      creatorName: pitch.creator_name?.trim() || 'a creator',
      coverImageUrl: pitch.title_image,
    });

    waitUntil(cache.put(cacheKey, rendered.clone()));

    return request.method === 'HEAD'
      ? new Response(null, { status: rendered.status, headers: rendered.headers })
      : rendered;
  } catch {
    return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);
  }
};
