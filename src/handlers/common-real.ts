/**
 * Real Database Handlers for Common Endpoints
 * Replaces stub endpoints with actual Neon PostgreSQL queries
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import * as Sentry from '@sentry/cloudflare';

function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
  });
}

// =============================================================================
// GET /api/notifications — Real database notifications
// =============================================================================

export async function notificationsRealHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  // Unauthenticated users get empty results
  if (!userId) {
    return jsonResponse({
      success: true,
      data: { notifications: [], unreadCount: 0, total: 0 }
    }, 200, origin);
  }

  const sql = getDb(env);

  // Graceful degradation when DB is unavailable
  if (!sql) {
    return jsonResponse({
      success: true,
      data: { notifications: [], unreadCount: 0, total: 0 }
    }, 200, origin);
  }

  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(rawLimit, 1), 50);

  try {
    const [notifications, unreadResult] = await Promise.all([
      sql`
        SELECT id, user_id, type, title, message, is_read, related_id, related_type, data, created_at
        FROM notifications
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `,
      sql`
        SELECT COUNT(*)::int as count
        FROM notifications
        WHERE user_id = ${userId} AND is_read = false
      `
    ]);

    const unreadCount = unreadResult[0]?.count ?? 0;
    const total = notifications.length;

    return jsonResponse({
      success: true,
      data: { notifications, unreadCount, total }
    }, 200, origin);
  } catch (error) {
    // Critical UX surface — a silent fallback to `unreadCount: 0` would
    // make every authenticated user see "0 unread" during a DB outage, with
    // no error indication. Surface honestly instead. (#66)
    const e = error instanceof Error ? error : new Error(String(error));
    console.error('notificationsRealHandler query error:', e.message);
    try {
      Sentry.withScope((scope) => {
        scope.setTag('handler.context', 'common-real.notificationsRealHandler');
        Sentry.captureException(e);
      });
    } catch { /* Sentry hub not initialized */ }
    return jsonResponse(
      { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Notifications temporarily unavailable' } },
      503,
      origin,
    );
  }
}

// =============================================================================
// GET /api/user/following — Real database user following list
// =============================================================================

export async function userFollowingRealHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({
      success: true,
      data: { following: [], total: 0 }
    }, 200, origin);
  }

  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({
      success: true,
      data: { following: [], total: 0 }
    }, 200, origin);
  }

  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

  try {
    const rows = await sql`
      SELECT u.id, u.username, u.name, u.user_type, u.profile_image, u.bio, f.created_at as followed_at
      FROM follows f
      JOIN users u ON f.creator_id = u.id
      WHERE f.follower_id = ${userId}
      ORDER BY f.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await sql`
      SELECT COUNT(*)::int as count
      FROM follows
      WHERE follower_id = ${userId}
    `;

    const total = countResult[0]?.count ?? 0;

    return jsonResponse({
      success: true,
      data: { following: rows || [], total }
    }, 200, origin);
  } catch (error) {
    // Same anti-pattern as notificationsRealHandler — silent empty fallback
    // would mask DB failures. Surface honestly. (#66)
    const e = error instanceof Error ? error : new Error(String(error));
    console.error('userFollowingRealHandler query error:', e.message);
    try {
      Sentry.withScope((scope) => {
        scope.setTag('handler.context', 'common-real.userFollowingRealHandler');
        Sentry.captureException(e);
      });
    } catch { /* Sentry hub not initialized */ }
    return jsonResponse(
      { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Following list temporarily unavailable' } },
      503,
      origin,
    );
  }
}

// =============================================================================
// GET /api/pitches/discover — Real database pitch discovery
// =============================================================================

export async function pitchesDiscoverRealHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);

  const emptyResponse = {
    success: true,
    data: {
      pitches: [],
      featured: [],
      trending: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    }
  };

  if (!sql) {
    return jsonResponse(emptyResponse, 200, origin);
  }

  const url = new URL(request.url);
  const genre = url.searchParams.get('genre');
  const rawLimit = parseInt(url.searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const rawOffset = parseInt(url.searchParams.get('offset') || '0', 10);
  const offset = Math.max(rawOffset, 0);
  const page = Math.floor(offset / limit) + 1;

  try {
    // Build the main pitches query — with optional genre filter
    let pitches;
    let totalResult;

    if (genre && genre !== 'all') {
      pitches = await sql`
        SELECT p.id, p.title, p.logline, p.genre, p.status, p.budget_range,
               p.thumbnail_url, p.view_count, p.like_count, p.created_at, p.published_at,
               COALESCE(u.name, u.username) as creator_name, u.profile_image as creator_image
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.status = 'published' AND LOWER(p.genre) = LOWER(${genre})
        ORDER BY p.published_at DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `;
      totalResult = await sql`
        SELECT COUNT(*)::int as count
        FROM pitches
        WHERE status = 'published' AND LOWER(genre) = LOWER(${genre})
      `;
    } else {
      pitches = await sql`
        SELECT p.id, p.title, p.logline, p.genre, p.status, p.budget_range,
               p.thumbnail_url, p.view_count, p.like_count, p.created_at, p.published_at,
               COALESCE(u.name, u.username) as creator_name, u.profile_image as creator_image
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.status = 'published'
        ORDER BY p.published_at DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `;
      totalResult = await sql`
        SELECT COUNT(*)::int as count
        FROM pitches
        WHERE status = 'published'
      `;
    }

    // Featured: top by view count
    const featured = await sql`
      SELECT p.id, p.title, p.logline, p.genre, p.status, p.budget_range,
             p.thumbnail_url, p.view_count, p.like_count, p.created_at, p.published_at,
             COALESCE(u.name, u.username) as creator_name, u.profile_image as creator_image
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.view_count DESC NULLS LAST
      LIMIT 5
    `;

    // Trending: top by like count
    const trending = await sql`
      SELECT p.id, p.title, p.logline, p.genre, p.status, p.budget_range,
             p.thumbnail_url, p.view_count, p.like_count, p.created_at, p.published_at,
             COALESCE(u.name, u.username) as creator_name, u.profile_image as creator_image
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.like_count DESC NULLS LAST
      LIMIT 5
    `;

    const total = totalResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return jsonResponse({
      success: true,
      data: {
        pitches: pitches || [],
        featured: featured || [],
        trending: trending || [],
        pagination: { page, limit, total, totalPages }
      }
    }, 200, origin);
  } catch (error) {
    console.error('pitchesDiscoverRealHandler query error:', error);
    return jsonResponse(emptyResponse, 200, origin);
  }
}

// =============================================================================
// GET /api/dashboard/stats — Real database platform stats
// =============================================================================

export async function dashboardStatsRealHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);

  const emptyStats = {
    success: true,
    data: {
      totalPitches: 0,
      totalViews: 0,
      totalInvestments: 0,
      activeUsers: 0,
      newPitchesThisWeek: 0,
      lastUpdated: new Date().toISOString()
    }
  };

  if (!sql) {
    return jsonResponse(emptyStats, 200, origin);
  }

  try {
    const result = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM pitches) as total_pitches,
        (SELECT COALESCE(SUM(view_count), 0)::int FROM pitches) as total_views,
        (SELECT COUNT(*)::int FROM investments) as total_investments,
        (SELECT COUNT(*)::int FROM users WHERE is_active = true) as active_users,
        (SELECT COUNT(*)::int FROM pitches WHERE created_at > NOW() - INTERVAL '7 days') as new_pitches_this_week
    `;

    const stats = result[0] || {};

    return jsonResponse({
      success: true,
      data: {
        totalPitches: stats.total_pitches ?? 0,
        totalViews: stats.total_views ?? 0,
        totalInvestments: stats.total_investments ?? 0,
        activeUsers: stats.active_users ?? 0,
        newPitchesThisWeek: stats.new_pitches_this_week ?? 0,
        lastUpdated: new Date().toISOString()
      }
    }, 200, origin);
  } catch (error) {
    console.error('dashboardStatsRealHandler query error:', error);
    return jsonResponse(emptyStats, 200, origin);
  }
}
