/**
 * User Lookup Handlers
 * Search users, get user by ID/username, user stats
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
  });
}

const SAFE_USER_COLUMNS = `
  id, email, username, name, user_type,
  first_name, last_name, company_name,
  profile_image, bio, location, verified,
  created_at
`;

/**
 * GET /api/users/search?q=term&type=creator&limit=20&offset=0
 */
export async function userSearchHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: true, data: { users: [], total: 0 } }, 200, origin);
  }

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const userType = url.searchParams.get('type') || url.searchParams.get('userType');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!q || q.length < 2) {
      return jsonResponse({ success: true, data: { users: [], total: 0 } }, 200, origin);
    }

    const searchTerm = `%${q}%`;

    let users;
    let countResult;

    if (userType) {
      users = await sql`
        SELECT ${sql.unsafe(SAFE_USER_COLUMNS)}
        FROM users
        WHERE (name ILIKE ${searchTerm} OR username ILIKE ${searchTerm} OR company_name ILIKE ${searchTerm})
          AND user_type = ${userType}
          AND is_active = true
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*)::int as total FROM users
        WHERE (name ILIKE ${searchTerm} OR username ILIKE ${searchTerm} OR company_name ILIKE ${searchTerm})
          AND user_type = ${userType}
          AND is_active = true
      `;
    } else {
      users = await sql`
        SELECT ${sql.unsafe(SAFE_USER_COLUMNS)}
        FROM users
        WHERE (name ILIKE ${searchTerm} OR username ILIKE ${searchTerm} OR company_name ILIKE ${searchTerm})
          AND is_active = true
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*)::int as total FROM users
        WHERE (name ILIKE ${searchTerm} OR username ILIKE ${searchTerm} OR company_name ILIKE ${searchTerm})
          AND is_active = true
      `;
    }

    return jsonResponse({
      success: true,
      data: { users, total: countResult[0]?.total || 0 }
    }, 200, origin);
  } catch (error) {
    console.error('User search error:', error);
    return jsonResponse({ success: true, data: { users: [], total: 0 } }, 200, origin);
  }
}

/**
 * GET /api/users/username/:username
 */
export async function userByUsernameHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' } }, 503, origin);
  }

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const username = parts[parts.length - 1];

    if (!username) {
      return jsonResponse({ success: false, error: { code: 'BAD_REQUEST', message: 'Username required' } }, 400, origin);
    }

    const [user] = await sql`
      SELECT ${sql.unsafe(SAFE_USER_COLUMNS)}
      FROM users
      WHERE username = ${username} AND is_active = true
      LIMIT 1
    `;

    if (!user) {
      return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404, origin);
    }

    return jsonResponse({ success: true, data: user }, 200, origin);
  } catch (error) {
    console.error('User by username error:', error);
    return jsonResponse({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' } }, 500, origin);
  }
}

/**
 * GET /api/users/:id
 */
export async function userByIdHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' } }, 503, origin);
  }

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const userId = parts[parts.length - 1];

    if (!userId || isNaN(Number(userId))) {
      return jsonResponse({ success: false, error: { code: 'BAD_REQUEST', message: 'Valid user ID required' } }, 400, origin);
    }

    // Public profile lookup: only expose contact email when the user has
    // opted in via Privacy > "Show Email Address" (user_settings.show_email,
    // default false). The owner sees their own email via /api/users/profile.
    const [user] = await sql`
      SELECT
        u.id, u.username, u.name, u.user_type,
        u.first_name, u.last_name, u.company_name,
        u.profile_image, u.bio, u.location, u.verified, u.created_at,
        CASE WHEN COALESCE(us.show_email, false) THEN u.email ELSE NULL END AS email
      FROM users u
      LEFT JOIN user_settings us ON us.user_id = u.id
      WHERE u.id = ${userId} AND u.is_active = true
      LIMIT 1
    `;

    if (!user) {
      return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404, origin);
    }

    // For investors, expose their structured investment thesis on the public
    // profile only when they've opted in (investor_thesis.is_public = true).
    // Non-investors get thesis: null. Missing table (migration 116 not applied)
    // or any read error → thesis: null, never breaks the profile lookup.
    let thesis: Record<string, unknown> | null = null;
    if (user.user_type === 'investor') {
      try {
        const [t] = await sql`
          SELECT genres, formats, stages, deal_types, territories, themes,
                 budget_min_usd, budget_max_usd, check_size_min_usd, check_size_max_usd,
                 positioning, is_public
          FROM investor_thesis
          WHERE investor_id = ${userId}
          LIMIT 1
        `;
        if (t && t.is_public) {
          const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as unknown[]).map(String) : []);
          const num = (v: unknown): number | null => {
            if (v === null || v === undefined || v === '') return null;
            const n = Number(v);
            return Number.isFinite(n) ? Math.trunc(n) : null;
          };
          thesis = {
            genres: arr(t.genres),
            formats: arr(t.formats),
            stages: arr(t.stages),
            dealTypes: arr(t.deal_types),
            territories: arr(t.territories),
            themes: arr(t.themes),
            budgetMinUsd: num(t.budget_min_usd),
            budgetMaxUsd: num(t.budget_max_usd),
            checkSizeMinUsd: num(t.check_size_min_usd),
            checkSizeMaxUsd: num(t.check_size_max_usd),
            positioning: typeof t.positioning === 'string' ? t.positioning : '',
            isPublic: true,
          };
        }
      } catch {
        // investor_thesis table may not exist yet; leave thesis null.
        thesis = null;
      }
    }

    return jsonResponse({ success: true, data: { ...user, thesis } }, 200, origin);
  } catch (error) {
    console.error('User by ID error:', error);
    return jsonResponse({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' } }, 500, origin);
  }
}

/**
 * GET /api/users/:id/stats
 */
export async function userStatsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: true, data: { stats: {} } }, 200, origin);
  }

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    // /api/users/:id/stats -> id is at index length-2
    const userId = parts[parts.length - 2];

    if (!userId || isNaN(Number(userId))) {
      return jsonResponse({ success: false, error: { code: 'BAD_REQUEST', message: 'Valid user ID required' } }, 400, origin);
    }

    const [user] = await sql`SELECT user_type FROM users WHERE id = ${userId} LIMIT 1`;
    if (!user) {
      return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404, origin);
    }

    const [pitchStats] = await sql`
      SELECT
        COUNT(*)::int as total_pitches,
        COUNT(CASE WHEN status = 'published' THEN 1 END)::int as published_pitches,
        COALESCE(SUM(view_count), 0)::int as total_views,
        COALESCE(SUM(like_count), 0)::int as total_likes
      FROM pitches WHERE user_id = ${userId}
    `;

    const [followStats] = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM follows WHERE follower_id = ${userId}) as following,
        (SELECT COUNT(*)::int FROM follows WHERE creator_id = ${userId}) as followers
    `;

    return jsonResponse({
      success: true,
      data: {
        stats: {
          ...pitchStats,
          ...followStats,
          userType: user.user_type
        }
      }
    }, 200, origin);
  } catch (error) {
    console.error('User stats error:', error);
    return jsonResponse({ success: true, data: { stats: {} } }, 200, origin);
  }
}
