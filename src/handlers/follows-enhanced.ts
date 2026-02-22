import type { Env } from '../worker-integrated';
import postgres from 'postgres';
import { z } from 'zod';
import { getAuthUser } from '../utils/auth';
import { corsHeaders, getCorsHeaders } from '../utils/response';
import { getDb } from '../db/connection';
import type { Env as DbEnv } from '../db/connection';
import { getUserId } from '../utils/auth-extract';

// Schema for follow/unfollow actions
// userId can be an integer string ("1025") or UUID — accept both
const FollowActionSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(['follow', 'unfollow'])
});

// Schema for follow list queries
const FollowListSchema = z.object({
  userId: z.string().min(1).optional(),
  type: z.enum(['followers', 'following']).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
});

/** Convert a user ID (string or number) to integer for SQL. Returns 0 for null/undefined (won't match any row). */
function toIntId(id: string | number | null | undefined): number {
  if (id == null) return 0;
  const n = typeof id === 'number' ? id : parseInt(String(id), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Follow or unfollow a user
 */
export async function followActionHandler(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json() as Record<string, unknown>;
    const { userId, action } = FollowActionSchema.parse(body);

    const followerId = toIntId(user.id);
    const followingId = toIntId(userId);

    // Can't follow yourself
    if (followerId === followingId) {
      return new Response(JSON.stringify({ error: 'Cannot follow yourself' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const sql = postgres(env.DATABASE_URL);

    if (action === 'follow') {
      // Check if already following
      const existing = await sql`
        SELECT id FROM follows
        WHERE follower_id = ${followerId}
        AND following_id = ${followingId}
      `;
      
      if (existing.length > 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Already following'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Create follow relationship
      await sql`
        INSERT INTO follows (follower_id, following_id)
        VALUES (${followerId}, ${followingId})
        ON CONFLICT (follower_id, following_id) DO NOTHING
      `;

      // Get updated counts
      const [counts] = await sql`
        SELECT
          (SELECT COUNT(*) FROM follows WHERE following_id = ${followingId}) as followers,
          (SELECT COUNT(*) FROM follows WHERE follower_id = ${followerId}) as following
      `;
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Successfully followed',
        data: {
          isFollowing: true,
          followerCount: parseInt(counts.followers),
          followingCount: parseInt(counts.following)
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } else { // unfollow
      await sql`
        DELETE FROM follows
        WHERE follower_id = ${followerId}
        AND following_id = ${followingId}
      `;

      // Get updated counts
      const [counts] = await sql`
        SELECT
          (SELECT COUNT(*) FROM follows WHERE following_id = ${followingId}) as followers,
          (SELECT COUNT(*) FROM follows WHERE follower_id = ${followerId}) as following
      `;
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Successfully unfollowed',
        data: {
          isFollowing: false,
          followerCount: parseInt(counts.followers),
          followingCount: parseInt(counts.following)
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error: any) {
    console.error('Follow action error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to process follow action'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get followers or following list
 */
export async function getFollowListHandler(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const query = FollowListSchema.parse(params);
    
    const currentUser = await getAuthUser(request, env);
    const rawTargetId = query.userId || (currentUser?.id != null ? String(currentUser.id) : null);

    if (!rawTargetId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const targetId = toIntId(rawTargetId);
    const currentId = toIntId(currentUser?.id);

    const sql = postgres(env.DATABASE_URL);

    // Determine which list to fetch
    const isFollowers = query.type === 'followers';

    const users = await sql`
      SELECT
        u.id,
        u.username,
        u.email,
        u.user_type,
        u.avatar_url,
        u.bio,
        u.created_at,
        f.followed_at,
        CASE
          WHEN ${currentId} != 0
          AND EXISTS (
            SELECT 1 FROM follows
            WHERE follower_id = ${currentId}
            AND following_id = u.id
          ) THEN true
          ELSE false
        END as is_following,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as follower_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
        (SELECT COUNT(*) FROM pitches WHERE user_id = u.id AND status = 'published') as pitch_count
      FROM follows f
      JOIN users u ON ${isFollowers
        ? sql`u.id = f.follower_id`
        : sql`u.id = f.following_id`}
      WHERE ${isFollowers
        ? sql`f.following_id = ${targetId}`
        : sql`f.follower_id = ${targetId}`}
      ORDER BY f.followed_at DESC
      LIMIT ${query.limit}
      OFFSET ${query.offset}
    `;

    // Get total count
    const [countResult] = await sql`
      SELECT COUNT(*) as total
      FROM follows
      WHERE ${isFollowers
        ? sql`following_id = ${targetId}`
        : sql`follower_id = ${targetId}`}
    `;

    // Get mutual follows if viewing own list
    let mutualFollows: postgres.Row[] = [];
    if (currentId !== 0 && currentId === targetId) {
      mutualFollows = await sql`
        SELECT
          u.id,
          u.username,
          u.avatar_url
        FROM follows f1
        JOIN follows f2 ON f1.following_id = f2.follower_id
          AND f1.follower_id = f2.following_id
        JOIN users u ON u.id = f1.following_id
        WHERE f1.follower_id = ${currentId}
        LIMIT 10
      `;
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        users,
        total: parseInt(countResult.total),
        mutualFollows,
        hasMore: parseInt(countResult.total) > query.offset + query.limit
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Get follow list error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to get follow list'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get follow statistics for a user
 */
export async function getFollowStatsHandler(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    const currentUser = await getAuthUser(request, env);
    const rawTargetId = userId || (currentUser?.id != null ? String(currentUser.id) : null);

    if (!rawTargetId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const targetId = toIntId(rawTargetId);
    const currentId = toIntId(currentUser?.id);

    const sql = postgres(env.DATABASE_URL);

    const [stats] = await sql`
      SELECT
        (SELECT COUNT(*) FROM follows WHERE following_id = ${targetId}) as followers,
        (SELECT COUNT(*) FROM follows WHERE follower_id = ${targetId}) as following,
        (SELECT COUNT(*) FROM follows f1
         JOIN follows f2 ON f1.following_id = f2.follower_id
           AND f1.follower_id = f2.following_id
         WHERE f1.follower_id = ${targetId}) as mutual,
        CASE
          WHEN ${currentId} != 0
          AND EXISTS (
            SELECT 1 FROM follows
            WHERE follower_id = ${currentId}
            AND following_id = ${targetId}
          ) THEN true
          ELSE false
        END as is_following,
        CASE
          WHEN ${currentId} != 0
          AND EXISTS (
            SELECT 1 FROM follows
            WHERE follower_id = ${targetId}
            AND following_id = ${currentId}
          ) THEN true
          ELSE false
        END as follows_you
    `;

    // Get recent followers
    const recentFollowers = await sql`
      SELECT
        u.id,
        u.username,
        u.avatar_url,
        u.user_type,
        f.followed_at
      FROM follows f
      JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = ${targetId}
      ORDER BY f.followed_at DESC
      LIMIT 5
    `;

    // Get follower growth over time (last 30 days)
    const growth = await sql`
      SELECT
        DATE(followed_at) as date,
        COUNT(*) as new_followers,
        SUM(COUNT(*)) OVER (ORDER BY DATE(followed_at)) as cumulative
      FROM follows
      WHERE following_id = ${targetId}
      AND followed_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(followed_at)
      ORDER BY date
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        stats: {
          followers: parseInt(stats.followers),
          following: parseInt(stats.following),
          mutual: parseInt(stats.mutual),
          isFollowing: stats.is_following,
          followsYou: stats.follows_you
        },
        recentFollowers,
        growth
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Get follow stats error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to get follow statistics'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get follow suggestions based on mutual connections and interests
 */
export async function getFollowSuggestionsHandler(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const sql = postgres(env.DATABASE_URL);
    
    // Get suggestions based on:
    // 1. Users followed by people you follow (collaborative filtering)
    // 2. Users in same genres/interests
    // 3. Popular users in your user type category
    
    const suggestions = await sql`
      WITH followed_by_friends AS (
        SELECT 
          f2.following_id as user_id,
          COUNT(*) as mutual_connections
        FROM follows f1
        JOIN follows f2 ON f1.following_id = f2.follower_id
        WHERE f1.follower_id = ${user.id}
        AND f2.following_id != ${user.id}
        AND NOT EXISTS (
          SELECT 1 FROM follows 
          WHERE follower_id = ${user.id} 
          AND following_id = f2.following_id
        )
        GROUP BY f2.following_id
      ),
      genre_matches AS (
        SELECT 
          u.id as user_id,
          COUNT(*) as common_genres
        FROM users u
        JOIN pitches p1 ON p1.user_id = u.id
        JOIN pitches p2 ON p2.genre = p1.genre
        WHERE p2.user_id = ${user.id}
        AND u.id != ${user.id}
        AND NOT EXISTS (
          SELECT 1 FROM follows 
          WHERE follower_id = ${user.id} 
          AND following_id = u.id
        )
        GROUP BY u.id
      ),
      popular_users AS (
        SELECT 
          u.id as user_id,
          COUNT(f.id) as follower_count
        FROM users u
        LEFT JOIN follows f ON f.following_id = u.id
        WHERE u.user_type = ${user.userType || null}
        AND u.id != ${user.id}
        AND NOT EXISTS (
          SELECT 1 FROM follows 
          WHERE follower_id = ${user.id} 
          AND following_id = u.id
        )
        GROUP BY u.id
        ORDER BY follower_count DESC
        LIMIT 20
      )
      SELECT 
        u.id,
        u.username,
        u.email,
        u.user_type,
        u.avatar_url,
        u.bio,
        COALESCE(fbf.mutual_connections, 0) as mutual_connections,
        COALESCE(gm.common_genres, 0) as common_genres,
        COALESCE(pu.follower_count, 0) as follower_count,
        (SELECT COUNT(*) FROM pitches WHERE user_id = u.id AND status = 'published') as pitch_count,
        (
          COALESCE(fbf.mutual_connections, 0) * 3 + 
          COALESCE(gm.common_genres, 0) * 2 + 
          LEAST(COALESCE(pu.follower_count, 0) / 10, 10)
        ) as relevance_score
      FROM users u
      LEFT JOIN followed_by_friends fbf ON fbf.user_id = u.id
      LEFT JOIN genre_matches gm ON gm.user_id = u.id
      LEFT JOIN popular_users pu ON pu.user_id = u.id
      WHERE (
        fbf.user_id IS NOT NULL 
        OR gm.user_id IS NOT NULL 
        OR pu.user_id IS NOT NULL
      )
      ORDER BY relevance_score DESC
      LIMIT 20
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: suggestions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Get follow suggestions error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to get suggestions'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/follows/mutual/:userId
 * Returns users that BOTH the authenticated user AND the target userId follow.
 */
export async function mutualFollowersHandler(request: Request, env: DbEnv): Promise<Response> {
  const origin = request.headers.get('Origin');
  const authenticatedUserId = await getUserId(request, env);

  const defaultResponse = new Response(JSON.stringify({
    success: true,
    data: { mutualFollowers: [], total: 0 }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
  });

  if (!authenticatedUserId) {
    return defaultResponse;
  }

  const sql = getDb(env);
  if (!sql) {
    return defaultResponse;
  }

  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const targetUserId = pathSegments[pathSegments.length - 1];

  if (!targetUserId) {
    return defaultResponse;
  }

  try {
    const rows = await sql`
      SELECT u.id, u.username, u.name, u.user_type, u.profile_image, u.bio
      FROM follows f1
      JOIN follows f2 ON f1.following_id = f2.following_id
      JOIN users u ON f1.following_id = u.id
      WHERE f1.follower_id = ${authenticatedUserId}
        AND f2.follower_id = ${targetUserId}
        AND u.is_active = true
      ORDER BY u.name ASC
    `;

    return new Response(JSON.stringify({
      success: true,
      data: { mutualFollowers: rows, total: rows.length }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
    });
  } catch (error) {
    console.error('Mutual followers query error:', error);
    return defaultResponse;
  }
}