/**
 * Heat Score Handlers
 * Recalculate scores + query hot pitches
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

function jsonResponse(
  data: unknown,
  origin: string | null,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}

// ---------------------------------------------------------------------------
// 1. POST /api/admin/heat-scores/recalculate — Trigger recalculation (admin only)
// ---------------------------------------------------------------------------

export async function recalculateHeatScoresHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!sql || !userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, origin, 401);
  }

  try {
    // Check admin role
    const userResult = await sql`
      SELECT user_type FROM users WHERE id = ${userId}
    `;
    if (userResult.length === 0 || userResult[0].user_type !== 'admin') {
      return jsonResponse({ success: false, error: 'Admin access required' }, origin, 403);
    }

    const result = await sql`SELECT recalculate_heat_scores() AS updated_count`;
    const updatedCount = result[0]?.updated_count ?? 0;

    return jsonResponse({
      success: true,
      data: { updated_count: updatedCount },
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('recalculateHeatScoresHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to recalculate heat scores' }, origin, 500);
  }
}

// ---------------------------------------------------------------------------
// 2. GET /api/pitches/hot — Top pitches by heat score (public)
// ---------------------------------------------------------------------------

export async function hotPitchesHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({ success: false, error: 'Service unavailable' }, origin, 503);
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const genre = url.searchParams.get('genre');
    const format = url.searchParams.get('format');

    let pitches;
    if (genre && format) {
      pitches = await sql`
        SELECT
          p.id, p.title, p.logline, p.genre, p.format,
          p.title_image AS cover_image,
          COALESCE(p.view_count, 0)::int AS view_count,
          COALESCE(p.like_count, 0)::int AS like_count,
          p.heat_score::float AS heat_score,
          p.created_at,
          u.id AS creator_id, u.name AS creator_name, u.username AS creator_username,
          u.profile_image AS creator_avatar
        FROM pitches p
        JOIN users u ON u.id = COALESCE(p.creator_id, p.user_id)
        WHERE p.status = 'published' AND p.heat_score > 0
          AND p.genre = ${genre} AND p.format = ${format}
        ORDER BY p.heat_score DESC
        LIMIT ${limit}
      `;
    } else if (genre) {
      pitches = await sql`
        SELECT
          p.id, p.title, p.logline, p.genre, p.format,
          p.title_image AS cover_image,
          COALESCE(p.view_count, 0)::int AS view_count,
          COALESCE(p.like_count, 0)::int AS like_count,
          p.heat_score::float AS heat_score,
          p.created_at,
          u.id AS creator_id, u.name AS creator_name, u.username AS creator_username,
          u.profile_image AS creator_avatar
        FROM pitches p
        JOIN users u ON u.id = COALESCE(p.creator_id, p.user_id)
        WHERE p.status = 'published' AND p.heat_score > 0
          AND p.genre = ${genre}
        ORDER BY p.heat_score DESC
        LIMIT ${limit}
      `;
    } else if (format) {
      pitches = await sql`
        SELECT
          p.id, p.title, p.logline, p.genre, p.format,
          p.title_image AS cover_image,
          COALESCE(p.view_count, 0)::int AS view_count,
          COALESCE(p.like_count, 0)::int AS like_count,
          p.heat_score::float AS heat_score,
          p.created_at,
          u.id AS creator_id, u.name AS creator_name, u.username AS creator_username,
          u.profile_image AS creator_avatar
        FROM pitches p
        JOIN users u ON u.id = COALESCE(p.creator_id, p.user_id)
        WHERE p.status = 'published' AND p.heat_score > 0
          AND p.format = ${format}
        ORDER BY p.heat_score DESC
        LIMIT ${limit}
      `;
    } else {
      pitches = await sql`
        SELECT
          p.id, p.title, p.logline, p.genre, p.format,
          p.title_image AS cover_image,
          COALESCE(p.view_count, 0)::int AS view_count,
          COALESCE(p.like_count, 0)::int AS like_count,
          p.heat_score::float AS heat_score,
          p.created_at,
          u.id AS creator_id, u.name AS creator_name, u.username AS creator_username,
          u.profile_image AS creator_avatar
        FROM pitches p
        JOIN users u ON u.id = COALESCE(p.creator_id, p.user_id)
        WHERE p.status = 'published' AND p.heat_score > 0
        ORDER BY p.heat_score DESC
        LIMIT ${limit}
      `;
    }

    return jsonResponse({ success: true, data: { pitches } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('hotPitchesHandler error:', e.message);
    return jsonResponse({ success: true, data: { pitches: [] } }, origin);
  }
}

// ---------------------------------------------------------------------------
// 3. GET /api/pitches/:id/heat — Single pitch heat breakdown
// ---------------------------------------------------------------------------

export async function pitchHeatBreakdownHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({ success: false, error: 'Service unavailable' }, origin, 503);
  }

  try {
    const params = (request as any).params;
    const pitchId = parseInt(params?.id, 10);
    if (!pitchId || isNaN(pitchId)) {
      return jsonResponse({ success: false, error: 'Invalid pitch ID' }, origin, 400);
    }

    const result = await sql`
      SELECT
        p.heat_score::float AS heat_score,
        COALESCE(p.view_count, 0)::int AS view_count,
        COALESCE(p.like_count, 0)::int AS like_count,
        (SELECT COUNT(*) FROM saved_pitches sp WHERE sp.pitch_id = p.id)::int AS save_count,
        (SELECT COUNT(*) FROM investment_interests ii WHERE ii.pitch_id = p.id)::int AS investor_interest_count,
        (SELECT COUNT(*) FROM pitch_views pv WHERE pv.pitch_id = p.id AND pv.viewed_at > NOW() - INTERVAL '7 days')::int AS views_7d,
        (SELECT COUNT(*) FROM pitch_likes pl WHERE pl.pitch_id = p.id AND pl.created_at > NOW() - INTERVAL '7 days')::int AS likes_7d
      FROM pitches p
      WHERE p.id = ${pitchId} AND p.status = 'published'
    `;

    if (result.length === 0) {
      return jsonResponse({ success: false, error: 'Pitch not found' }, origin, 404);
    }

    return jsonResponse({ success: true, data: result[0] }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('pitchHeatBreakdownHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to get heat breakdown' }, origin, 500);
  }
}
