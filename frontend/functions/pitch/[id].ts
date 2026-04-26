/**
 * GET /pitch/:id — branded social-unfurl HTML for a pitch detail page.
 *
 * Same pattern as /portfolio/s/[token].ts and /slates/s/[id].ts. Pitches are
 * publicly readable via /api/pitches/:id without auth (the API truncates
 * synopsis for non-NDA viewers, but title/logline/genre/title_image are
 * always exposed). Status='published' check happens here so drafts don't
 * unfurl with bot UAs.
 *
 * Failure mode: any error → return the unmodified index.html (humans get
 * the SPA pitch page either way; bots get the static site OG meta).
 */
import {
  applyOgMeta,
  clampDescription,
  clampTitle,
  canonicalUrl,
  isCrawlerUA,
  DEFAULT_BACKEND_URL,
  type OgMeta,
} from '../_lib/og';

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
      format: string | null;
      title_image: string | null;
      creator_name: string | null;
      updated_at: string | null;
      status: string;
    };
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const idStr = String(params.id || '');
  const pitchId = parseInt(idStr, 10);

  // Fetch the SPA index.html via same-origin HTTP (see portfolio/s/[token].ts
  // for why we can't use env.ASSETS.fetch or context.next here).
  const origin = new URL(request.url).origin;
  const indexResponse = await fetch(`${origin}/index.html`, {
    headers: { Accept: 'text/html' },
  });

  // Bot-UA gate: only rewrite meta for crawlers. Humans get the unmodified
  // SPA shell immediately, no upstream-API latency on every pitch page load.
  if (!isCrawlerUA(request.headers.get('User-Agent'))) {
    return indexResponse;
  }

  if (!pitchId || isNaN(pitchId)) return indexResponse;

  try {
    const backend = env.API_BACKEND_URL || DEFAULT_BACKEND_URL;
    const apiRes = await fetch(`${backend}/api/pitches/${pitchId}`, {
      headers: { Accept: 'application/json' },
    });

    if (!apiRes.ok) return indexResponse;
    const json = await apiRes.json() as PitchApi;
    if (!json.success || !json.data?.pitch) return indexResponse;

    const pitch = json.data.pitch;

    // Only unfurl published pitches — drafts get the generic site card.
    if (pitch.status !== 'published') return indexResponse;

    const creatorName = pitch.creator_name?.trim() || 'a creator';
    const ogVersionUnix = pitch.updated_at
      ? Math.floor(new Date(pitch.updated_at).getTime() / 1000)
      : 0;
    const versionParam = ogVersionUnix ? `?v=${ogVersionUnix}` : '';
    const ogImage = canonicalUrl(request, `/og/pitch/${pitchId}${versionParam}`);

    // Description preference: logline → "{Genre} {Format} by {Creator} on Pitchey"
    const description = pitch.logline?.trim()
      ? clampDescription(pitch.logline)
      : `${pitch.genre || 'A pitch'}${pitch.format ? ` · ${pitch.format}` : ''} by ${creatorName} on Pitchey.`;

    const meta: OgMeta = {
      title: clampTitle(`${pitch.title} — ${creatorName}`),
      description,
      url: canonicalUrl(request, `/pitch/${pitchId}`),
      image: ogImage,
      type: 'website',
      twitterCard: 'summary_large_image',
    };

    return applyOgMeta(indexResponse, meta);
  } catch {
    return indexResponse;
  }
};
