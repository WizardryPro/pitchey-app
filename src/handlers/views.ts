import type { Env } from '../worker-integrated';
import { getDb } from '../db/connection';
import { getUserId } from '../utils/auth-extract';
import { getCorsHeaders } from '../utils/response';

/**
 * Track a view for a pitch
 * Table schema: views(id, user_id, pitch_id, viewed_at, created_at, view_type, session_id, viewer_id)
 */
export async function trackViewHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers = { 'Content-Type': 'application/json', ...getCorsHeaders(origin) };

  try {
    const body = await request.json() as Record<string, unknown>;
    const pitchId = typeof body.pitchId === 'number' ? body.pitchId : parseInt(String(body.pitchId), 10);
    const duration = Number.isFinite(body.duration) && (body.duration as number) > 0
      ? Math.floor(body.duration as number)
      : 0;

    if (!pitchId || isNaN(pitchId)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid pitchId' }), {
        status: 400, headers
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ success: true, message: 'View tracked (no db)' }), { headers });
    }

    const viewerId = await getUserId(request, env);
    const sessionId = request.headers.get('X-Session-ID') || crypto.randomUUID();
    const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || null;

    // For logged-in users: one view per user per pitch (enforced by unique index)
    if (viewerId) {
      const existing = await sql`
        SELECT id FROM views
        WHERE user_id = ${viewerId} AND pitch_id = ${pitchId}
        LIMIT 1
      `;

      if (existing.length > 0) {
        // Heartbeat — bump timestamp and accumulate duration (frontend sends cumulative)
        await sql`
          UPDATE views
          SET viewed_at = NOW(),
              view_duration = GREATEST(COALESCE(view_duration, 0), ${duration}::int)
          WHERE user_id = ${viewerId} AND pitch_id = ${pitchId}
        `;
        return new Response(JSON.stringify({ success: true, message: 'View updated', duplicate: true }), { headers });
      }
    } else {
      // For anonymous users: deduplicate by session (24h) and IP+pitch (24h)
      const recent = await sql`
        SELECT id FROM views
        WHERE pitch_id = ${pitchId}
          AND user_id IS NULL
          AND (
            session_id = ${sessionId}
            ${ipAddress ? sql`OR ip_address = ${ipAddress}` : sql``}
          )
          AND viewed_at > NOW() - INTERVAL '24 hours'
        LIMIT 1
      `;

      if (recent.length > 0) {
        return new Response(JSON.stringify({ success: true, message: 'View already tracked', duplicate: true }), { headers });
      }
    }

    // Insert new view
    const [view] = await sql`
      INSERT INTO views (pitch_id, viewer_id, user_id, session_id, view_type, ip_address, view_duration)
      VALUES (${pitchId}, ${viewerId || null}, ${viewerId || null}, ${sessionId}, 'page_view', ${ipAddress}, ${duration})
      RETURNING id, viewed_at
    `;

    // Update cached view count on pitches table
    await sql`
      UPDATE pitches
      SET view_count = (SELECT COUNT(*) FROM views WHERE pitch_id = ${pitchId}),
          updated_at = NOW()
      WHERE id = ${pitchId}
    `;

    return new Response(JSON.stringify({
      success: true,
      data: { viewId: view.id, viewedAt: view.viewed_at }
    }), { headers });
  } catch (error: any) {
    console.error('Track view error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to track view'
    }), { status: 500, headers });
  }
}

/**
 * Get view analytics for pitches
 */
export async function getViewAnalyticsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers = { 'Content-Type': 'application/json', ...getCorsHeaders(origin) };

  try {
    const userId = await getUserId(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ success: true, data: { analytics: [], summary: { totalViews: 0, uniqueViewers: 0 } } }), { headers });
    }

    const url = new URL(request.url);
    const pitchId = url.searchParams.get('pitchId');

    // Get view analytics grouped by day for the user's pitches
    const analytics = await sql`
      SELECT
        DATE_TRUNC('day', v.viewed_at) AS period,
        COUNT(*)::int AS views,
        COUNT(DISTINCT v.viewer_id)::int AS unique_viewers
      FROM views v
      JOIN pitches p ON p.id = v.pitch_id
      WHERE p.user_id::text = ${userId}
        ${pitchId ? sql`AND v.pitch_id = ${parseInt(pitchId)}` : sql``}
      GROUP BY period
      ORDER BY period DESC
      LIMIT 30
    `;

    // Top viewers
    const topViewers = await sql`
      SELECT
        u.id,
        u.name,
        u.user_type,
        COUNT(*)::int AS view_count,
        MAX(v.viewed_at) AS last_viewed
      FROM views v
      JOIN pitches p ON p.id = v.pitch_id
      LEFT JOIN users u ON u.id = v.viewer_id
      WHERE p.user_id::text = ${userId}
        AND v.viewer_id IS NOT NULL
      GROUP BY u.id, u.name, u.user_type
      ORDER BY view_count DESC
      LIMIT 10
    `;

    const totalViews = analytics.reduce((sum: number, a: any) => sum + (a.views || 0), 0);
    const uniqueViewers = analytics.reduce((sum: number, a: any) => sum + (a.unique_viewers || 0), 0);

    return new Response(JSON.stringify({
      success: true,
      data: {
        analytics,
        topViewers,
        summary: { totalViews, uniqueViewers }
      }
    }), { headers });
  } catch (error: any) {
    console.error('Get view analytics error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to get analytics'
    }), { status: 500, headers });
  }
}

/**
 * Get viewers for a specific pitch
 */
export async function getPitchViewersHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers = { 'Content-Type': 'application/json', ...getCorsHeaders(origin) };

  try {
    const url = new URL(request.url);
    const pitchId = url.pathname.split('/').pop();

    if (!pitchId) {
      return new Response(JSON.stringify({ success: false, error: 'Pitch ID required' }), {
        status: 400, headers
      });
    }

    const userId = await getUserId(request, env);
    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ success: true, data: { viewers: [], isOwner: false } }), { headers });
    }

    // Check ownership
    const [pitch] = await sql`
      SELECT id, user_id FROM pitches WHERE id = ${parseInt(pitchId)}
    `;

    if (!pitch) {
      return new Response(JSON.stringify({ success: false, error: 'Pitch not found' }), {
        status: 404, headers
      });
    }

    const isOwner = String(pitch.user_id) === userId;

    const viewers = await sql`
      SELECT
        v.id,
        v.viewed_at,
        v.view_type,
        u.id AS user_id,
        u.name,
        u.user_type
      FROM views v
      LEFT JOIN users u ON u.id = v.viewer_id
      WHERE v.pitch_id = ${parseInt(pitchId)}
      ORDER BY v.viewed_at DESC
      LIMIT 100
    `;

    return new Response(JSON.stringify({
      success: true,
      data: { viewers, isOwner }
    }), { headers });
  } catch (error: any) {
    console.error('Get pitch viewers error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to get viewers'
    }), { status: 500, headers });
  }
}
