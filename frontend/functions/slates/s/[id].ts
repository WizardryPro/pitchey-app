/**
 * GET /slates/s/:id — branded social-unfurl HTML for a published slate.
 *
 * Same pattern as /portfolio/s/[token].ts. Slates are public by ID (no token
 * table) — `publicSlateHandler` only returns slates with status='published'.
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
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  API_BACKEND_URL?: string;
}

interface SlateApi {
  success: boolean;
  data?: {
    id: number;
    title: string;
    description: string | null;
    cover_image: string | null;
    creator: {
      id: number;
      name: string;
      username: string | null;
      avatar_url: string | null;
    };
    pitches: Array<{
      id: number;
      title: string;
      cover_image: string | null;
    }>;
  };
}

async function fetchIndex(env: Env, request: Request): Promise<Response> {
  const indexUrl = new URL(request.url);
  indexUrl.pathname = '/index.html';
  return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const idStr = String(params.id || '');
  const slateId = parseInt(idStr, 10);
  const indexResponse = await fetchIndex(env, request);

  if (!slateId || isNaN(slateId)) return indexResponse;

  try {
    const backend = env.API_BACKEND_URL || DEFAULT_BACKEND_URL;
    const apiRes = await fetch(`${backend}/api/slates/${slateId}/public`, {
      headers: { Accept: 'application/json' },
    });

    if (!apiRes.ok) return indexResponse;
    const json = await apiRes.json() as SlateApi;
    if (!json.success || !json.data) return indexResponse;

    const slate = json.data;
    const creatorName = slate.creator.name?.trim() || slate.creator.username?.trim() || 'a creator';
    const pitchCount = slate.pitches.length;
    const pitchWord = pitchCount === 1 ? 'pitch' : 'pitches';

    // Branded composite — phase 2 endpoint renders the card; falls back to raw
    // image inside that endpoint if rendering fails.
    const ogImage = canonicalUrl(request, `/og/slate/${slateId}`);

    const description = slate.description?.trim()
      ? clampDescription(slate.description)
      : `A curated slate by ${creatorName} — ${pitchCount} ${pitchWord} on Pitchey.`;

    const meta: OgMeta = {
      title: clampTitle(`${slate.title} — ${creatorName}`),
      description,
      url: canonicalUrl(request, `/slates/s/${slateId}`),
      image: ogImage,
      type: 'website',
      twitterCard: 'summary_large_image',
    };

    return applyOgMeta(indexResponse, meta);
  } catch {
    return indexResponse;
  }
};
