/**
 * Schema Adapter Middleware
 * Maps between frontend expectations and actual database schema
 */

export class SchemaAdapter {
  /**
   * Adapt follows query based on actual database schema
   * The follows table has: follower_id, pitch_id, creator_id, followed_at
   * Frontend expects: follower_id, following_id, created_at
   */
  static adaptFollowsQuery(type: 'user' | 'pitch' | 'creator', params: any) {
    if (type === 'user') {
      // User-to-user follows - use following_id column
      return {
        query: `
          SELECT 
            f.id,
            f.follower_id,
            f.following_id,
            COALESCE(f.created_at, f.followed_at) as created_at,
            u.id as user_id,
            u.name,
            u.email,
            u.profile_image,
            u.user_type
          FROM follows f
          JOIN users u ON u.id = f.following_id
          WHERE f.follower_id = $1 AND f.following_id IS NOT NULL
          ORDER BY COALESCE(f.created_at, f.followed_at) DESC
        `,
        params: [params.userId]
      };
    } else if (type === 'pitch') {
      // Pitch follows
      return {
        query: `
          SELECT 
            f.id,
            f.follower_id,
            f.pitch_id,
            COALESCE(f.created_at, f.followed_at) as created_at,
            p.title,
            p.genre,
            p.status
          FROM follows f
          JOIN pitches p ON p.id = f.pitch_id
          WHERE f.follower_id = $1 AND f.pitch_id IS NOT NULL
          ORDER BY COALESCE(f.created_at, f.followed_at) DESC
        `,
        params: [params.userId]
      };
    } else {
      // Creator follows (legacy)
      return {
        query: `
          SELECT 
            f.id,
            f.follower_id,
            f.creator_id,
            COALESCE(f.created_at, f.followed_at) as created_at,
            u.id as user_id,
            u.name,
            u.email,
            u.user_type
          FROM follows f
          JOIN users u ON u.id = f.creator_id
          WHERE f.follower_id = $1 AND f.creator_id IS NOT NULL
          ORDER BY COALESCE(f.created_at, f.followed_at) DESC
        `,
        params: [params.userId]
      };
    }
  }

  /**
   * Adapt views tracking for pitches
   * Now we have a proper views table
   */
  static adaptViewsQuery(pitchId?: number, userId?: number) {
    if (pitchId && userId) {
      return {
        query: `
          INSERT INTO views (user_id, pitch_id, viewed_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (user_id, pitch_id) 
          DO UPDATE SET viewed_at = NOW()
          RETURNING *
        `,
        params: [userId, pitchId]
      };
    } else if (pitchId) {
      return {
        query: `
          SELECT COUNT(DISTINCT user_id) as view_count
          FROM views
          WHERE pitch_id = $1
        `,
        params: [pitchId]
      };
    } else if (userId) {
      return {
        query: `
          SELECT 
            v.*,
            p.title,
            p.genre,
            p.thumbnail_url
          FROM views v
          JOIN pitches p ON p.id = v.pitch_id
          WHERE v.user_id = $1
          ORDER BY v.viewed_at DESC
        `,
        params: [userId]
      };
    }
    
    return { query: 'SELECT 1', params: [] };
  }

  /**
   * Get followers (who follows this user)
   */
  static getFollowersQuery(userId: number) {
    return {
      query: `
        SELECT 
          f.id,
          f.follower_id as user_id,
          COALESCE(f.created_at, f.followed_at) as created_at,
          u.name,
          u.email,
          u.profile_image,
          u.user_type
        FROM follows f
        JOIN users u ON u.id = f.follower_id
        WHERE (f.following_id = $1 OR f.creator_id = $1)
        ORDER BY COALESCE(f.created_at, f.followed_at) DESC
      `,
      params: [userId]
    };
  }

  /**
   * Get following (who this user follows)
   */
  static getFollowingQuery(userId: number) {
    return {
      query: `
        SELECT 
          f.id,
          COALESCE(f.following_id, f.creator_id) as user_id,
          COALESCE(f.created_at, f.followed_at) as created_at,
          u.name,
          u.email,
          u.profile_image,
          u.user_type
        FROM follows f
        JOIN users u ON u.id = COALESCE(f.following_id, f.creator_id)
        WHERE f.follower_id = $1
          AND (f.following_id IS NOT NULL OR f.creator_id IS NOT NULL)
        ORDER BY COALESCE(f.created_at, f.followed_at) DESC
      `,
      params: [userId]
    };
  }

  /**
   * Create a follow relationship
   */
  static createFollowQuery(followerId: number, targetId: number, type: 'user' | 'pitch') {
    if (type === 'user') {
      return {
        query: `
          INSERT INTO follows (follower_id, following_id, followed_at, created_at)
          VALUES ($1, $2, NOW(), NOW())
          ON CONFLICT (follower_id, COALESCE(following_id, creator_id, pitch_id))
          DO NOTHING
          RETURNING *
        `,
        params: [followerId, targetId]
      };
    } else {
      return {
        query: `
          INSERT INTO follows (follower_id, pitch_id, followed_at, created_at)
          VALUES ($1, $2, NOW(), NOW())
          ON CONFLICT (follower_id, COALESCE(following_id, creator_id, pitch_id))
          DO NOTHING
          RETURNING *
        `,
        params: [followerId, targetId]
      };
    }
  }

  /**
   * Delete a follow relationship
   */
  static unfollowQuery(followerId: number, targetId: number, type: 'user' | 'pitch') {
    if (type === 'user') {
      return {
        query: `
          DELETE FROM follows 
          WHERE follower_id = $1 
            AND (following_id = $2 OR creator_id = $2)
        `,
        params: [followerId, targetId]
      };
    } else {
      return {
        query: `
          DELETE FROM follows 
          WHERE follower_id = $1 
            AND pitch_id = $2
        `,
        params: [followerId, targetId]
      };
    }
  }

  /**
   * Adapt pitch queries to include view counts
   */
  static adaptPitchQuery(includeViews: boolean = true) {
    return `
      SELECT 
        p.*,
        u.name as creator_name,
        u.email as creator_email,
        u.user_type as creator_type,
        ${includeViews ? `
        (SELECT COUNT(DISTINCT user_id) FROM views WHERE pitch_id = p.id) as view_count,
        (SELECT COUNT(*) FROM saved_pitches WHERE pitch_id = p.id) as save_count,
        (SELECT COUNT(*) FROM investments WHERE pitch_id = p.id) as investment_count,
        (SELECT COUNT(*) FROM ndas WHERE pitch_id = p.id AND status = 'approved') as nda_count
        ` : '0 as view_count, 0 as save_count, 0 as investment_count, 0 as nda_count'}
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
    `;
  }

  /**
   * Dashboard stats query with proper joins
   */
  static getDashboardStatsQuery(userId: number, role: string) {
    const baseQuery = `
      SELECT 
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'published') as published_pitches,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'draft') as draft_pitches,
        COUNT(DISTINCT p.id) as total_pitches,
        (SELECT COUNT(*) FROM views WHERE pitch_id IN (SELECT id FROM pitches WHERE user_id = $1)) as total_views,
        (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = $1 OR creator_id = $1) as followers_count,
        (SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false) as unread_notifications
      FROM users u
      LEFT JOIN pitches p ON p.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const investorQuery = `
      SELECT 
        COUNT(DISTINCT i.id) as total_investments,
        COUNT(DISTINCT n.id) FILTER (WHERE n.status = 'approved') as approved_ndas,
        COUNT(DISTINCT n.id) FILTER (WHERE n.status = 'pending') as pending_ndas,
        COUNT(DISTINCT sp.pitch_id) as saved_pitches,
        (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following_count,
        (SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false) as unread_notifications
      FROM users u
      LEFT JOIN investments i ON i.investor_id = u.id
      LEFT JOIN ndas n ON n.user_id = u.id
      LEFT JOIN saved_pitches sp ON sp.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const productionQuery = `
      SELECT 
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'in_production') as active_projects,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'completed') as completed_projects,
        COUNT(DISTINCT i.id) as total_investments,
        COUNT(DISTINCT n.id) FILTER (WHERE n.status = 'approved') as approved_ndas,
        (SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false) as unread_notifications
      FROM users u
      LEFT JOIN pitches p ON p.user_id = u.id
      LEFT JOIN investments i ON i.pitch_id IN (SELECT id FROM pitches WHERE user_id = u.id)
      LEFT JOIN ndas n ON n.pitch_id IN (SELECT id FROM pitches WHERE user_id = u.id)
      WHERE u.id = $1
      GROUP BY u.id
    `;

    switch (role) {
      case 'investor':
        return { query: investorQuery, params: [userId] };
      case 'production':
        return { query: productionQuery, params: [userId] };
      default:
        return { query: baseQuery, params: [userId] };
    }
  }
}

/**
 * Middleware function to adapt requests/responses
 */
export function schemaAdapterMiddleware(handler: Function) {
  return async (request: Request, env: any, ctx: any) => {
    // Store the adapter in the request context
    const requestWithAdapter = Object.assign(request, {
      schemaAdapter: SchemaAdapter
    });

    // Call the handler with the enhanced request
    const response = await handler(requestWithAdapter, env, ctx);

    return response;
  };
}