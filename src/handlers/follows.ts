/**
 * Follows Handler with Error Resilience
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import { safeQuery } from '../db/safe-query';

/**
 * Main follows handler - returns combined followers, following, activities, and summary
 * Used by the Following page component
 */
export async function followsHandler(request: Request, env: Env): Promise<Response> {
  const authenticatedUserId = await getUserId(request, env);
  const sql = getDb(env);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  const defaultResponse = {
    success: true,
    followers: [],
    following: [],
    activities: [],
    summary: {
      newPitches: 0,
      activeCreators: 0,
      engagementRate: 0
    }
  };

  if (!sql || !authenticatedUserId) {
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });
  }

  try {
    // Table probe — expected to fail on envs without the follows table, so report: false.
    const tableCheck = await safeQuery<{ exists: boolean }>(
      () => sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'follows'
        )
      `,
      { fallback: [{ exists: false }], context: 'follows.table-probe', report: false },
    );

    if (!tableCheck.rows[0]?.exists) {
      return new Response(JSON.stringify(defaultResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          ...corsHeaders
        }
      });
    }

    // Get followers (people who follow the current user)
    const followersResult = await safeQuery(
      () => sql`
        SELECT
          u.id, u.username, u.email, u.first_name as "firstName", u.last_name as "lastName",
          u.profile_image as "profileImage", u.bio, u.location, u.user_type as "userType",
          COALESCE(f.followed_at, f.created_at) as "followedAt", u.created_at as "createdAt",
          COALESCE((SELECT COUNT(*) FROM pitches WHERE user_id = u.id), 0) as "pitchCount"
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        WHERE f.following_id = ${authenticatedUserId}
        ORDER BY COALESCE(f.followed_at, f.created_at) DESC
        LIMIT 50
      `,
      { fallback: [], context: 'follows.followers-list', tags: { userId: String(authenticatedUserId) } },
    );
    const followers = followersResult.rows;

    // Get following (people the current user follows)
    const followingResult = await safeQuery(
      () => sql`
        SELECT
          u.id, u.username, u.email, u.first_name as "firstName", u.last_name as "lastName",
          u.profile_image as "profileImage", u.bio, u.location, u.user_type as "userType",
          COALESCE(f.followed_at, f.created_at) as "followedAt", u.created_at as "createdAt",
          COALESCE((SELECT COUNT(*) FROM pitches WHERE user_id = u.id), 0) as "pitchCount"
        FROM follows f
        JOIN users u ON f.following_id = u.id
        WHERE f.follower_id = ${authenticatedUserId}
        ORDER BY COALESCE(f.followed_at, f.created_at) DESC
        LIMIT 50
      `,
      { fallback: [], context: 'follows.following-list', tags: { userId: String(authenticatedUserId) } },
    );
    const following = followingResult.rows;

    // Get recent activity from followed users (new pitches)
    const activitiesResult = await safeQuery(
      () => sql`
        SELECT
          p.id,
          'pitch_created' as type,
          json_build_object(
            'id', u.id,
            'username', u.username,
            'companyName', u.company_name,
            'profileImage', u.profile_image,
            'userType', u.user_type
          ) as creator,
          'created a new pitch' as action,
          json_build_object(
            'id', p.id,
            'title', p.title,
            'genre', p.genre,
            'logline', p.logline
          ) as pitch,
          p.created_at as "createdAt"
        FROM pitches p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id IN (
          SELECT following_id FROM follows WHERE follower_id = ${authenticatedUserId}
        )
        AND p.created_at > NOW() - INTERVAL '30 days'
        ORDER BY p.created_at DESC
        LIMIT 20
      `,
      { fallback: [], context: 'follows.activity-feed', tags: { userId: String(authenticatedUserId) } },
    );
    const activities = activitiesResult.rows;

    // Calculate summary stats
    const newPitchesCount = activities.length;
    const activeCreatorsCount = following.length;
    const engagementRate = following.length > 0
      ? Math.round((activities.length / following.length) * 100)
      : 0;

    return new Response(JSON.stringify({
      success: true,
      followers: followers || [],
      following: following || [],
      activities: activities || [],
      summary: {
        newPitches: newPitchesCount,
        activeCreators: activeCreatorsCount,
        engagementRate: engagementRate
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Follows query error:', error);
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });
  }
}

export async function followersHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  // creatorId can be from query param (viewing someone else's followers) or auth (own followers)
  const authenticatedUserId = await getUserId(request, env);
  const creatorId = url.searchParams.get('creatorId') || authenticatedUserId || '1';
  const sql = getDb(env);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  const defaultResponse = {
    success: true,
    data: {
      followers: [],
      count: 0
    }
  };
  
  if (!sql) {
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        ...corsHeaders
      }
    });
  }
  
  try {
    // Table probe — expected to fail on envs without the follows table, so report: false.
    const tableCheck = await safeQuery<{ exists: boolean }>(
      () => sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'follows'
        )
      `,
      { fallback: [{ exists: false }], context: 'follows.followers-table-probe', report: false },
    );

    if (!tableCheck.rows[0]?.exists) {
      // Table doesn't exist, return empty
      return new Response(JSON.stringify(defaultResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          ...corsHeaders
        }
      });
    }

    const result = await sql`
      SELECT
        u.id, u.username, u.email,
        u.first_name as "firstName", u.last_name as "lastName",
        u.profile_image as "profileImage", u.bio, u.location,
        u.user_type as "userType", u.company_name as "companyName",
        COALESCE(f.followed_at, f.created_at) as "followedAt",
        u.created_at as "createdAt",
        COALESCE((SELECT COUNT(*) FROM pitches WHERE user_id = u.id), 0) as "pitchCount",
        COUNT(*) OVER() as "totalCount"
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ${creatorId}
      ORDER BY COALESCE(f.followed_at, f.created_at) DESC
      LIMIT 20
    `;

    return new Response(JSON.stringify({
      success: true,
      data: {
        followers: result || [],
        count: result[0]?.totalCount || 0
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Followers query error:', error);
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });
  }
}

export async function followingHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const authenticatedUserId = await getUserId(request, env);
  const userId = url.searchParams.get('userId') || authenticatedUserId || '1';
  const sql = getDb(env);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  const defaultResponse = {
    success: true,
    data: {
      following: [],
      count: 0
    }
  };
  
  if (!sql) {
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });
  }
  
  try {
    // Table probe — expected to fail on envs without the follows table, so report: false.
    const tableCheck = await safeQuery<{ exists: boolean }>(
      () => sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'follows'
        )
      `,
      { fallback: [{ exists: false }], context: 'follows.following-table-probe', report: false },
    );

    if (!tableCheck.rows[0]?.exists) {
      return new Response(JSON.stringify(defaultResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          ...corsHeaders
        }
      });
    }

    const result = await sql`
      SELECT
        u.id, u.username, u.email,
        u.first_name as "firstName", u.last_name as "lastName",
        u.profile_image as "profileImage", u.bio, u.location,
        u.user_type as "userType", u.company_name as "companyName",
        COALESCE(f.followed_at, f.created_at) as "followedAt",
        u.created_at as "createdAt",
        COALESCE((SELECT COUNT(*) FROM pitches WHERE user_id = u.id), 0) as "pitchCount",
        COUNT(*) OVER() as "totalCount"
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ${userId}
      ORDER BY COALESCE(f.followed_at, f.created_at) DESC
      LIMIT 20
    `;

    return new Response(JSON.stringify({
      success: true,
      data: {
        following: result || [],
        count: result[0]?.totalCount || 0
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Following query error:', error);
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });
  }
}