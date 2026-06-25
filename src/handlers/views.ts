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

    // Insert new view. Upsert on (user_id, pitch_id) so a concurrent initial
    // track-view + heartbeat (which both pass the SELECT above before either
    // inserts) can't violate views_user_id_pitch_id_key — the loser updates the
    // duration instead of throwing. For anonymous views user_id is NULL, which a
    // standard unique constraint treats as distinct, so each still inserts.
    const [view] = await sql`
      INSERT INTO views (pitch_id, viewer_id, user_id, session_id, view_type, ip_address, view_duration)
      VALUES (${pitchId}, ${viewerId || null}, ${viewerId || null}, ${sessionId}, 'page_view', ${ipAddress}, ${duration})
      ON CONFLICT (user_id, pitch_id) DO UPDATE
        SET view_duration = GREATEST(COALESCE(views.view_duration, 0), EXCLUDED.view_duration),
            viewed_at = NOW()
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
      WHERE p.user_id = ${userId}
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
      WHERE p.user_id = ${userId}
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
    const id = parseInt(pitchId);
    if (!sql) {
      return new Response(JSON.stringify({ success: true, data: { viewers: [], isOwner: false, locked: true, totalViewers: 0, breakdown: {} } }), { headers });
    }

    // Ownership — only the pitch owner may see who viewed it (moat #2). creator_id
    // OR user_id (both coexist due to drift). Previously this handler leaked named
    // viewers to ANY caller; the gate below fixes that.
    const [pitch] = await sql`
      SELECT id, user_id, creator_id FROM pitches WHERE id = ${id}
    `;
    if (!pitch) {
      return new Response(JSON.stringify({ success: false, error: 'Pitch not found' }), {
        status: 404, headers
      });
    }
    const isOwner =
      String(pitch.user_id ?? '') === String(userId) || String(pitch.creator_id ?? '') === String(userId);

    // Role breakdown + total unique viewers — counts only, no identities. Safe to
    // compute always; returned to the owner regardless of tier (the teaser).
    const breakdown: Record<string, number> = { creator: 0, investor: 0, production: 0, viewer: 0 };
    let totalViewers = 0;
    try {
      const rows = await sql`
        SELECT u.user_type, COUNT(DISTINCT v.viewer_id)::int AS count
        FROM views v JOIN users u ON u.id = v.viewer_id
        WHERE v.pitch_id = ${id} AND v.viewer_id IS NOT NULL
        GROUP BY u.user_type
      `;
      for (const r of rows as Array<Record<string, unknown>>) {
        breakdown[String(r.user_type ?? 'viewer')] = Number(r.count) || 0;
        totalViewers += Number(r.count) || 0;
      }
    } catch { /* drift → zero counts, still renders */ }

    // Non-owners never see names or counts detail.
    if (!userId || !isOwner) {
      return new Response(JSON.stringify({
        success: true,
        data: { viewers: [], isOwner: false, locked: true, totalViewers, breakdown }
      }), { headers });
    }

    // The gate: per-viewer DETAIL is unlocked only for a paid Creator subscription.
    const PAID_TIERS = new Set(['creator', 'creator_plus', 'creator_unlimited']);
    let isPaid = false;
    try {
      const [u] = await sql`SELECT subscription_tier FROM users WHERE id = ${userId}`;
      isPaid = PAID_TIERS.has(String((u as Record<string, unknown>)?.subscription_tier ?? ''));
    } catch { isPaid = false; }

    if (!isPaid) {
      // Free owner — counts + breakdown, but no names. Frontend shows the upsell.
      return new Response(JSON.stringify({
        success: true,
        data: { viewers: [], isOwner: true, locked: true, totalViewers, breakdown }
      }), { headers });
    }

    // NDA-signed viewer ids (guarded — ndas.signer_id has documented drift).
    const ndaSigners = new Set<string>();
    try {
      const ndaRows = await sql`
        SELECT DISTINCT signer_id FROM ndas
        WHERE pitch_id = ${id} AND status IN ('approved', 'signed', 'completed')
      `;
      for (const r of ndaRows as Array<Record<string, unknown>>) {
        if (r.signer_id != null) ndaSigners.add(String(r.signer_id));
      }
    } catch { /* no NDA badges on drift */ }

    // Paid owner — named per-viewer detail aggregated per unique viewer.
    const rows = await sql`
      SELECT
        v.viewer_id,
        COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username, 'Unknown viewer') AS name,
        u.user_type,
        COUNT(*)::int AS view_count,
        MAX(v.viewed_at) AS last_viewed_at,
        COALESCE(SUM(v.view_duration), 0)::int AS total_duration
      FROM views v JOIN users u ON u.id = v.viewer_id
      WHERE v.pitch_id = ${id} AND v.viewer_id IS NOT NULL
      GROUP BY v.viewer_id, u.first_name, u.last_name, u.username, u.user_type
      ORDER BY MAX(v.viewed_at) DESC
      LIMIT 200
    `;
    const viewers = (rows as Array<Record<string, unknown>>).map((r) => ({
      viewerId: r.viewer_id,
      name: r.name,
      role: r.user_type,
      viewCount: Number(r.view_count) || 0,
      lastViewedAt: r.last_viewed_at ? String(r.last_viewed_at) : null,
      totalDuration: Number(r.total_duration) || 0,
      ndaSigned: ndaSigners.has(String(r.viewer_id)),
    }));

    return new Response(JSON.stringify({
      success: true,
      data: { viewers, isOwner: true, locked: false, totalViewers, breakdown }
    }), { headers });
  } catch (error: any) {
    console.error('Get pitch viewers error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to get viewers'
    }), { status: 500, headers });
  }
}
