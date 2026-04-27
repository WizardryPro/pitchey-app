/**
 * GET /og/slate/:id — branded 1200×630 OG image for a published slate.
 */
import { renderSlateCard } from '../../_lib/og-image';
import { DEFAULT_BACKEND_URL, DEFAULT_FALLBACK_IMAGE } from '../../_lib/og';

interface Env {
  API_BACKEND_URL?: string;
}

interface SlateApi {
  success: boolean;
  data?: {
    title: string;
    cover_image: string | null;
    creator: { name: string; username: string | null; avatar_url: string | null };
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

  const slateId = parseInt(String(params.id || ''), 10);
  if (!slateId || isNaN(slateId)) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

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
    const apiRes = await fetch(`${backend}/api/slates/${slateId}/public`, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true } as RequestInitCfProperties,
    });
    if (!apiRes.ok) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

    const json = await apiRes.json() as SlateApi;
    if (!json.success || !json.data) return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);

    const slate = json.data;
    const cover =
      slate.cover_image ||
      slate.pitches.find(p => p.cover_image)?.cover_image ||
      null;

    const rendered = await renderSlateCard({
      title: slate.title,
      creatorName: slate.creator.name?.trim() || slate.creator.username?.trim() || 'a creator',
      pitchCount: slate.pitches.length,
      coverImageUrl: cover,
    });

    waitUntil(cache.put(cacheKey, rendered.clone()));

    return request.method === 'HEAD'
      ? new Response(null, { status: rendered.status, headers: rendered.headers })
      : rendered;
  } catch {
    return fallbackRedirect(DEFAULT_FALLBACK_IMAGE);
  }
};
