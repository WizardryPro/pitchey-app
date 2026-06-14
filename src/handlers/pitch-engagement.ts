import type { Env } from '../worker-integrated';
import { getDb } from '../db/connection';
import { getUserId } from '../utils/auth-extract';
import { getCorsHeaders } from '../utils/response';

/**
 * GET /api/pitches/:id/engagement
 * Returns enriched engagement data with privacy tiers:
 * - Anonymous: counts only
 * - Authenticated: counts + viewer breakdown by role
 * - NDA-signed: counts + breakdown + named likers (who also have NDA)
 * - Owner: full visibility — all likers, recent viewers, timeline
 */
export async function getPitchEngagementHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers = { 'Content-Type': 'application/json', ...getCorsHeaders(origin) };

  try {
    const url = new URL(request.url);
    // Router attaches params, fallback to path split
    const pitchId = parseInt((request as any).params?.id || url.pathname.split('/')[3], 10);

    if (!pitchId || isNaN(pitchId)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid pitch ID' }), {
        status: 400, headers
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ success: false, error: 'Database unavailable' }), {
        status: 503, headers
      });
    }

    // Get pitch info
    const pitchResult = await sql`
      SELECT id, user_id, COALESCE(view_count, 0) as view_count, COALESCE(like_count, 0) as like_count
      FROM pitches WHERE id = ${pitchId} AND status = 'published'
    `;

    if (pitchResult.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Pitch not found' }), {
        status: 404, headers
      });
    }

    const pitch = pitchResult[0];
    const userId = await getUserId(request, env);

    // Liker role breakdown — aggregate counts by user_type.
    // Safe to share with any viewer (anonymous, watcher, industry) since it's
    // just counts, no identities. Lets watchers see social proof.
    const likerBreakdownResult = await sql`
      SELECT u.user_type, COUNT(DISTINCT l.user_id)::int as count
      FROM likes l
      JOIN users u ON u.id = l.user_id
      WHERE l.pitch_id = ${pitchId}
      GROUP BY u.user_type
    `;
    const likerBreakdown: Record<string, number> = {
      creator: 0, investor: 0, production: 0, viewer: 0,
    };
    for (const row of likerBreakdownResult) {
      likerBreakdown[row.user_type] = Number(row.count);
    }

    // Base response — always returned
    const response: Record<string, unknown> = {
      success: true,
      viewCount: Number(pitch.view_count),
      likeCount: Number(pitch.like_count),
      likerBreakdown,
      recentLikers: [],
    };

    if (!userId) {
      // Anonymous: counts + role breakdown only
      return new Response(JSON.stringify(response), { headers });
    }

    const isOwner = String(pitch.user_id) === String(userId);

    // Named likers/viewers are restricted to owner + NDA-signed industry
    // viewers. Watchers and non-NDA industry viewers see aggregate-only data.
    const ndaRows = await sql`
      SELECT 1 FROM ndas
      WHERE pitch_id = ${pitchId} AND signer_id = ${userId}
        AND (status = 'approved' OR status = 'signed')
      LIMIT 1
    `;
    const hasNDAAccess = ndaRows.length > 0;
    const canSeeNamedEngagement = isOwner || hasNDAAccess;

    // Viewer breakdown by role — for all authenticated users
    const breakdownResult = await sql`
      SELECT u.user_type, COUNT(DISTINCT v.viewer_id)::int as count
      FROM views v
      JOIN users u ON u.id = v.viewer_id
      WHERE v.pitch_id = ${pitchId} AND v.viewer_id IS NOT NULL
      GROUP BY u.user_type
    `;

    const viewerBreakdown: Record<string, number> = {};
    for (const row of breakdownResult) {
      viewerBreakdown[row.user_type] = Number(row.count);
    }
    response.viewerBreakdown = viewerBreakdown;

    if (!canSeeNamedEngagement) {
      // Watchers and non-NDA industry viewers: aggregate-only, no names.
      return new Response(JSON.stringify(response), { headers });
    }

    // Owner + NDA-signed viewers see named likers and viewers
    const likers = await sql`
      SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as name,
             u.user_type, u.company_name, l.created_at as liked_at
      FROM likes l
      JOIN users u ON u.id = l.user_id
      WHERE l.pitch_id = ${pitchId}
      ORDER BY l.created_at DESC
      LIMIT 20
    `;

    response.recentLikers = likers.map((l: Record<string, unknown>) => ({
      id: l.id,
      name: l.name,
      userType: l.user_type,
      companyName: l.company_name,
      likedAt: l.liked_at,
    }));

    // Recent viewers with names
    const viewers = await sql`
      SELECT DISTINCT ON (v.viewer_id)
        u.id, CONCAT(u.first_name, ' ', u.last_name) as name,
        u.user_type, u.company_name, v.viewed_at
      FROM views v
      JOIN users u ON u.id = v.viewer_id
      WHERE v.pitch_id = ${pitchId} AND v.viewer_id IS NOT NULL
        AND v.viewer_id != ${pitch.user_id}
      ORDER BY v.viewer_id, v.viewed_at DESC
    `;

    const sortedViewers = viewers
      .map((v: Record<string, unknown>) => ({
        id: v.id,
        name: v.name,
        userType: v.user_type,
        companyName: v.company_name,
        viewedAt: v.viewed_at,
      }))
      .sort((a: { viewedAt: unknown }, b: { viewedAt: unknown }) =>
        new Date(String(b.viewedAt)).getTime() - new Date(String(a.viewedAt)).getTime()
      )
      .slice(0, 20);

    response.recentViewers = sortedViewers;

    return new Response(JSON.stringify(response), { headers });

  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('Pitch engagement error:', e.message);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch engagement data' }), {
      status: 500, headers
    });
  }
}

/**
 * GET /api/pitches/audience-demand
 * The producer-facing demand lens — ranks published pitches by *audience*
 * (watcher) engagement specifically, isolated from the blended Heat score.
 *
 * Heat already weights industry attention ×4; this does the opposite — it
 * surfaces what the crowd is backing before the industry weighs in, so a
 * producer can mine genuine audience appetite as its own signal. Score =
 * watcher likes ×3 + saves ×2 + views ×1 (intent-ordered). Only pitches with
 * real audience signal appear; an empty result is honest ("no audience signal
 * yet"), not a bug. Each row carries the raw watcher counts so the UI can show
 * "12 watchers like this" rather than an opaque number.
 *
 * Watcher = user_type 'viewer' (legacy DB naming; see CLAUDE.md viewer/watcher).
 */
export async function audienceDemandHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers = { 'Content-Type': 'application/json', ...getCorsHeaders(origin) };

  const sql = getDb(env);
  if (!sql) {
    return new Response(JSON.stringify({ success: false, error: 'Service unavailable' }), { status: 503, headers });
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(24, Math.max(1, parseInt(url.searchParams.get('limit') || '8', 10)));

    const pitches = await sql`
      WITH wl AS (
        SELECT l.pitch_id, COUNT(DISTINCT l.user_id) AS cnt
        FROM likes l JOIN users u ON u.id = l.user_id
        WHERE u.user_type = 'viewer' GROUP BY l.pitch_id
      ), ws AS (
        SELECT s.pitch_id, COUNT(DISTINCT s.user_id) AS cnt
        FROM saved_pitches s JOIN users u ON u.id = s.user_id
        WHERE u.user_type = 'viewer' GROUP BY s.pitch_id
      ), wv AS (
        SELECT v.pitch_id, COUNT(DISTINCT v.viewer_id) AS cnt
        FROM pitch_views v JOIN users u ON u.id = v.viewer_id
        WHERE u.user_type = 'viewer' GROUP BY v.pitch_id
      )
      SELECT
        p.id, p.title, p.logline, p.genre, p.format,
        p.title_image AS cover_image,
        COALESCE(p.view_count, 0)::int AS view_count,
        COALESCE(p.like_count, 0)::int AS like_count,
        p.heat_score::float AS heat_score,
        p.created_at,
        u.id AS creator_id, u.username AS creator_username,
        u.name AS creator_name, u.profile_image AS creator_avatar,
        COALESCE(wl.cnt, 0)::int AS watcher_likes,
        COALESCE(ws.cnt, 0)::int AS watcher_saves,
        COALESCE(wv.cnt, 0)::int AS watcher_views,
        (COALESCE(wl.cnt, 0) * 3 + COALESCE(ws.cnt, 0) * 2 + COALESCE(wv.cnt, 0))::int AS audience_score
      FROM pitches p
      JOIN users u ON u.id = COALESCE(p.creator_id, p.user_id)
      LEFT JOIN wl ON wl.pitch_id = p.id
      LEFT JOIN ws ON ws.pitch_id = p.id
      LEFT JOIN wv ON wv.pitch_id = p.id
      WHERE p.status = 'published'
        AND (COALESCE(wl.cnt, 0) * 3 + COALESCE(ws.cnt, 0) * 2 + COALESCE(wv.cnt, 0)) > 0
      ORDER BY audience_score DESC, p.heat_score DESC NULLS LAST
      LIMIT ${limit}
    `;

    return new Response(JSON.stringify({ success: true, data: { pitches } }), { headers });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('audienceDemandHandler error:', e.message);
    return new Response(JSON.stringify({ success: false, error: 'Failed to load audience demand' }), { status: 500, headers });
  }
}
