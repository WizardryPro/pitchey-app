/**
 * Follows Handler with Error Resilience
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

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
    // Check if follows table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'follows'
      )
    `.catch(() => [{ exists: false }]);

    if (!tableCheck[0]?.exists) {
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
    const followers = await sql`
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
    `.catch(() => []);

    // Get following (people the current user follows)
    const following = await sql`
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
    `.catch(() => []);

    // Get recent activity from followed users (new pitches)
    const activities = await sql`
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
    `.catch(() => []);

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
    // Check if follows table exists first
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'follows'
      )
    `.catch(() => [{ exists: false }]);
    
    if (!tableCheck[0]?.exists) {
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
        u.id, u.username, u.email, u.profile_image,
        COUNT(*) OVER() as total_count
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ${creatorId}
      LIMIT 20
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        followers: result || [],
        count: result[0]?.total_count || 0
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
    // Check if follows table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'follows'
      )
    `.catch(() => [{ exists: false }]);
    
    if (!tableCheck[0]?.exists) {
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
        u.id, u.username, u.email, u.profile_image,
        COUNT(*) OVER() as total_count
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ${userId}
      LIMIT 20
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        following: result || [],
        count: result[0]?.total_count || 0
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