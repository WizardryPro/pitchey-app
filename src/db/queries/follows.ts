/**
 * Follow system database queries using raw SQL
 * Handles user following relationships
 */

import type { SqlQuery } from './base';
import { WhereBuilder, extractFirst, extractMany, DatabaseError, withTransaction } from './base';

// Type definitions
export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: Date;
}

export interface FollowWithUser extends Follow {
  username: string;
  first_name?: string;
  last_name?: string;
  profile_image?: string;
  bio?: string;
  company_name?: string;
  user_type: string;
  is_following_back?: boolean;
}

// Core follow operations
export async function followUser(
  sql: SqlQuery,
  followerId: string,
  followingId: string
): Promise<Follow> {
  // Can't follow yourself
  if (followerId === followingId) {
    throw new DatabaseError('Cannot follow yourself');
  }

  try {
    const result = await sql`
      INSERT INTO follows (follower_id, following_id, followed_at, created_at)
      VALUES (${followerId}, ${followingId}, NOW(), NOW())
      ON CONFLICT (follower_id, following_id) DO NOTHING
      RETURNING *
    `;
    
    const follow = extractFirst<Follow>(result);
    if (!follow) {
      // Already following
      const existing = await sql`
        SELECT * FROM follows 
        WHERE follower_id = ${followerId} AND following_id = ${followingId}
      `;
      return extractFirst<Follow>(existing)!;
    }

    // Create notification for the followed user
    await sql`
      INSERT INTO notifications (
        user_id, type, title, message,
        related_user_id, priority, created_at
      ) VALUES (
        ${followingId}, 'new_follower', 
        'New Follower',
        'You have a new follower',
        ${followerId}, 'low', NOW()
      )
    `;

    return follow;
  } catch (error: any) {
    if (error.code === '23505') {
      // Already following
      const existing = await sql`
        SELECT * FROM follows 
        WHERE follower_id = ${followerId} AND following_id = ${followingId}
      `;
      return extractFirst<Follow>(existing)!;
    }
    throw error;
  }
}

export async function unfollowUser(
  sql: SqlQuery,
  followerId: string,
  followingId: string
): Promise<boolean> {
  const result = await sql`
    DELETE FROM follows
    WHERE follower_id = ${followerId} AND following_id = ${followingId}
    RETURNING id
  `;
  return result.length > 0;
}

export async function isFollowing(
  sql: SqlQuery,
  followerId: string,
  followingId: string
): Promise<boolean> {
  const result = await sql`
    SELECT EXISTS(
      SELECT 1 FROM follows 
      WHERE follower_id = ${followerId} AND following_id = ${followingId}
    ) as is_following
  `;
  return result[0]?.is_following || false;
}

// Get followers of a user
export async function getFollowers(
  sql: SqlQuery,
  userId: string,
  limit: number = 50,
  offset: number = 0,
  currentUserId?: string
): Promise<FollowWithUser[]> {
  const query = currentUserId ? `
    SELECT 
      f.*,
      u.username,
      u.first_name,
      u.last_name,
      u.profile_image,
      u.bio,
      u.company_name,
      u.user_type,
      EXISTS(
        SELECT 1 FROM follows f2 
        WHERE f2.follower_id = $2 AND f2.following_id = f.follower_id
      ) as is_following_back
    FROM follows f
    JOIN users u ON f.follower_id = u.id
    WHERE f.following_id = $1 AND u.is_active = true
    ORDER BY f.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  ` : `
    SELECT 
      f.*,
      u.username,
      u.first_name,
      u.last_name,
      u.profile_image,
      u.bio,
      u.company_name,
      u.user_type
    FROM follows f
    JOIN users u ON f.follower_id = u.id
    WHERE f.following_id = $1 AND u.is_active = true
    ORDER BY f.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const params = currentUserId ? [userId, currentUserId] : [userId];
  const result = await sql(query, params);
  return extractMany<FollowWithUser>(result);
}

// Get users that a user is following
export async function getFollowing(
  sql: SqlQuery,
  userId: string,
  limit: number = 50,
  offset: number = 0,
  currentUserId?: string
): Promise<FollowWithUser[]> {
  const query = currentUserId ? `
    SELECT 
      f.*,
      u.username,
      u.first_name,
      u.last_name,
      u.profile_image,
      u.bio,
      u.company_name,
      u.user_type,
      EXISTS(
        SELECT 1 FROM follows f2 
        WHERE f2.follower_id = $2 AND f2.following_id = f.following_id
      ) as is_following_back
    FROM follows f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = $1 AND u.is_active = true
    ORDER BY f.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  ` : `
    SELECT 
      f.*,
      u.username,
      u.first_name,
      u.last_name,
      u.profile_image,
      u.bio,
      u.company_name,
      u.user_type
    FROM follows f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = $1 AND u.is_active = true
    ORDER BY f.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const params = currentUserId ? [userId, currentUserId] : [userId];
  const result = await sql(query, params);
  return extractMany<FollowWithUser>(result);
}

// Get follow statistics for a user
export async function getFollowStats(
  sql: SqlQuery,
  userId: string
): Promise<{
  followersCount: number;
  followingCount: number;
  mutualCount: number;
}> {
  const result = await sql`
    SELECT 
      (SELECT COUNT(*) FROM follows WHERE following_id = ${userId}) as followers_count,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ${userId}) as following_count,
      (SELECT COUNT(*) FROM follows f1 
       WHERE f1.follower_id = ${userId}
       AND EXISTS(
         SELECT 1 FROM follows f2 
         WHERE f2.follower_id = f1.following_id 
         AND f2.following_id = ${userId}
       )) as mutual_count
  `;
  
  const stats = extractFirst<any>(result) || {};
  return {
    followersCount: Number(stats.followers_count || 0),
    followingCount: Number(stats.following_count || 0),
    mutualCount: Number(stats.mutual_count || 0)
  };
}

// Get mutual connections
export async function getMutualFollowers(
  sql: SqlQuery,
  userId1: string,
  userId2: string,
  limit: number = 20
): Promise<FollowWithUser[]> {
  const result = await sql`
    SELECT DISTINCT
      u.id as follower_id,
      u.username,
      u.first_name,
      u.last_name,
      u.profile_image,
      u.bio,
      u.company_name,
      u.user_type
    FROM users u
    WHERE u.id IN (
      SELECT follower_id FROM follows WHERE following_id = ${userId1}
      INTERSECT
      SELECT follower_id FROM follows WHERE following_id = ${userId2}
    )
    AND u.is_active = true
    LIMIT ${limit}
  `;
  return extractMany<FollowWithUser>(result);
}

// Get suggested users to follow
export async function getSuggestedFollows(
  sql: SqlQuery,
  userId: string,
  limit: number = 10
): Promise<FollowWithUser[]> {
  const result = await sql`
    WITH user_follows AS (
      SELECT following_id FROM follows WHERE follower_id = ${userId}
    ),
    suggested AS (
      SELECT 
        u.id as following_id,
        u.username,
        u.first_name,
        u.last_name,
        u.profile_image,
        u.bio,
        u.company_name,
        u.user_type,
        COUNT(DISTINCT f.follower_id) as mutual_followers,
        COUNT(DISTINCT p.id) as pitch_count
      FROM users u
      LEFT JOIN follows f ON f.following_id = u.id
        AND f.follower_id IN (SELECT following_id FROM user_follows)
      LEFT JOIN pitches p ON p.creator_id = u.id AND p.status = 'published'
      WHERE u.id != ${userId}
        AND u.id NOT IN (SELECT following_id FROM user_follows)
        AND u.is_active = true
      GROUP BY u.id, u.username, u.first_name, u.last_name, 
        u.profile_image, u.bio, u.company_name, u.user_type
      HAVING COUNT(DISTINCT f.follower_id) > 0 OR COUNT(DISTINCT p.id) > 2
    )
    SELECT * FROM suggested
    ORDER BY mutual_followers DESC, pitch_count DESC
    LIMIT ${limit}
  `;
  return extractMany<FollowWithUser>(result);
}

// Check if two users follow each other
export async function areMutualFollowers(
  sql: SqlQuery,
  userId1: string,
  userId2: string
): Promise<boolean> {
  const result = await sql`
    SELECT EXISTS(
      SELECT 1 FROM follows 
      WHERE follower_id = ${userId1} AND following_id = ${userId2}
    ) AND EXISTS(
      SELECT 1 FROM follows 
      WHERE follower_id = ${userId2} AND following_id = ${userId1}
    ) as are_mutual
  `;
  return result[0]?.are_mutual || false;
}

// Batch check follow status
export async function getFollowStatuses(
  sql: SqlQuery,
  currentUserId: string,
  userIds: string[]
): Promise<Map<string, { following: boolean; followedBy: boolean }>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const result = await sql`
    SELECT 
      u.id,
      EXISTS(
        SELECT 1 FROM follows 
        WHERE follower_id = ${currentUserId} AND following_id = u.id
      ) as is_following,
      EXISTS(
        SELECT 1 FROM follows 
        WHERE follower_id = u.id AND following_id = ${currentUserId}
      ) as is_followed_by
    FROM unnest(${userIds}::uuid[]) AS u(id)
  `;

  const statuses = new Map<string, { following: boolean; followedBy: boolean }>();
  result.forEach((row: any) => {
    statuses.set(row.id, {
      following: row.is_following || false,
      followedBy: row.is_followed_by || false
    });
  });

  return statuses;
}

// Get recent follow activity
export async function getRecentFollowActivity(
  sql: SqlQuery,
  userId: string,
  limit: number = 20
): Promise<Array<{
  type: 'followed' | 'got_followed';
  user: FollowWithUser;
  timestamp: Date;
}>> {
  const result = await sql`
    WITH activities AS (
      SELECT 
        'followed' as type,
        f.following_id as user_id,
        f.created_at as timestamp
      FROM follows f
      WHERE f.follower_id = ${userId}
      
      UNION ALL
      
      SELECT 
        'got_followed' as type,
        f.follower_id as user_id,
        f.created_at as timestamp
      FROM follows f
      WHERE f.following_id = ${userId}
    )
    SELECT 
      a.type,
      a.timestamp,
      u.id as following_id,
      u.username,
      u.first_name,
      u.last_name,
      u.profile_image,
      u.bio,
      u.company_name,
      u.user_type
    FROM activities a
    JOIN users u ON a.user_id = u.id
    WHERE u.is_active = true
    ORDER BY a.timestamp DESC
    LIMIT ${limit}
  `;

  return result.map((row: any) => ({
    type: row.type,
    timestamp: row.timestamp,
    user: {
      id: row.following_id,
      follower_id: userId,
      following_id: row.following_id,
      username: row.username,
      first_name: row.first_name,
      last_name: row.last_name,
      profile_image: row.profile_image,
      bio: row.bio,
      company_name: row.company_name,
      user_type: row.user_type,
      created_at: row.timestamp
    }
  }));
}