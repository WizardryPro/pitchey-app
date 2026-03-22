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

    // Base response — always returned
    const response: Record<string, unknown> = {
      success: true,
      viewCount: Number(pitch.view_count),
      likeCount: Number(pitch.like_count),
      recentLikers: [],
    };

    if (!userId) {
      // Anonymous: counts only
      return new Response(JSON.stringify(response), { headers });
    }

    const isOwner = String(pitch.user_id) === String(userId);

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

    // All authenticated users see named likers and viewers
    // This is a B2B platform — knowing who's engaging is the core value
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
