/**
 * "Your Pitchey" value dashboard — moat item #8.
 *
 * Read-only totals over EXISTING tables that make a creator's accumulated stored
 * value legible (and the lock-in *felt*): pitches, seals, followers, views,
 * tracked-share reach, honored NDAs, heat, verification tier, and tenure.
 *
 * Design notes:
 * - Every metric is fetched INDEPENDENTLY and guarded, so schema drift in one
 *   table degrades that single tile to its fallback rather than 500ing the whole
 *   card (the live worker has well-documented id/column drift — see CLAUDE.md).
 * - The authenticated user's id is a NUMBER (users.id is INTEGER), so user-id
 *   comparisons (creator_id/user_id/following_id = ${userId}) are plain numeric.
 *   Pitch-id comparisons keep `::text` on both sides — pitch ids drift between
 *   INTEGER and UUID across history; `::text` is the established defensive
 *   pattern in this codebase (e.g. creator-dashboard).
 * - Pitch ownership is `creator_id OR user_id` (both columns coexist due to drift).
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Short cache — these are slow-moving aggregates, not real-time.
      'Cache-Control': 'private, max-age=120',
      ...getCorsHeaders(origin),
    },
  });
}

/**
 * Run a single-row aggregate query, returning `fallback` (and logging, not
 * swallowing) on any error. This is NOT a silent swallow-to-default: the error is
 * logged with its metric label so drift stays visible in observability.
 */
async function guard<T extends Record<string, unknown>>(
  run: () => Promise<T[]>,
  fallback: T,
  metric: string,
): Promise<T> {
  try {
    const rows = await run();
    return rows[0] ?? fallback;
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.warn(JSON.stringify({
      level: 'warn', category: 'creator_value', metric, outcome: 'degraded', error: e.message,
    }));
    return fallback;
  }
}

export async function creatorValueHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const empty = {
    verificationTier: 'grey',
    memberSince: null as string | null,
    username: null as string | null,
    pitches: { total: 0, published: 0, sealed: 0 },
    audience: { followers: 0, totalViews: 0 },
    reach: { shareLinkViews: 0 },
    trust: { ndas: 0 },
    heat: { top: 0 },
  };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: empty }, origin);
  }

  const [user, pitchAgg, followers, shareViews, ndaAgg, seals] = await Promise.all([
    guard(() => sql`
      SELECT verification_tier, created_at, username
      FROM users WHERE id = ${userId}
    `, { verification_tier: 'grey', created_at: null as string | null, username: null as string | null }, 'user'),

    guard(() => sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN status IN ('published', 'public', 'active') THEN 1 END)::int AS published,
        COALESCE(SUM(view_count), 0)::int AS views,
        COALESCE(MAX(heat_score), 0)::float AS top_heat
      FROM pitches
      WHERE creator_id = ${userId} OR user_id = ${userId}
    `, { total: 0, published: 0, views: 0, top_heat: 0 }, 'pitches'),

    guard(() => sql`
      SELECT COUNT(*)::int AS v FROM follows WHERE following_id = ${userId}
    `, { v: 0 }, 'followers'),

    // Tracked-link reach = portfolio share links + slate share links (moat #5).
    // Both are the creator's own tokenized share links; sum their view counts so the
    // tile reflects ALL share-link reach, not just the older portfolio links.
    guard(() => sql`
      SELECT (
        COALESCE((SELECT SUM(view_count) FROM portfolio_share_links WHERE creator_id = ${userId}), 0)
        + COALESCE((SELECT SUM(view_count) FROM slate_share_links WHERE creator_id = ${userId}), 0)
      )::int AS v
    `, { v: 0 }, 'share_views'),

    // Honored/seriousness signal: NDAs across both historical tables on owned pitches.
    guard(() => sql`
      SELECT (
        COALESCE((SELECT COUNT(*) FROM ndas n
          WHERE n.pitch_id::text IN (
            SELECT id::text FROM pitches WHERE creator_id = ${userId} OR user_id = ${userId}
          )), 0)
        + COALESCE((SELECT COUNT(*) FROM nda_requests nr
          WHERE nr.pitch_id::text IN (
            SELECT id::text FROM pitches WHERE creator_id = ${userId} OR user_id = ${userId}
          )), 0)
      )::int AS v
    `, { v: 0 }, 'ndas'),

    guard(() => sql`
      SELECT COUNT(DISTINCT pp.pitch_id)::int AS v
      FROM pitch_provenance pp
      WHERE pp.pitch_id::text IN (
        SELECT id::text FROM pitches WHERE creator_id = ${userId} OR user_id = ${userId}
      )
    `, { v: 0 }, 'seals'),
  ]);

  const data = {
    verificationTier: (user.verification_tier as string) || 'grey',
    memberSince: user.created_at ? String(user.created_at) : null,
    username: (user.username as string) || null,
    pitches: {
      total: Number(pitchAgg.total) || 0,
      published: Number(pitchAgg.published) || 0,
      sealed: Number(seals.v) || 0,
    },
    audience: {
      followers: Number(followers.v) || 0,
      totalViews: Number(pitchAgg.views) || 0,
    },
    reach: { shareLinkViews: Number(shareViews.v) || 0 },
    trust: { ndas: Number(ndaAgg.v) || 0 },
    heat: { top: Math.round((Number(pitchAgg.top_heat) || 0) * 100) / 100 },
  };

  return jsonResponse({ success: true, data }, origin);
}
