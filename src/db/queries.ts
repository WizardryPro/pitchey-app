/**
 * Type-safe Database Query Helpers
 * Provides strongly typed query methods for the Pitchey platform
 */

import { NeonConnection, DatabaseError } from './neon-connection.ts';

// Database Entity Interfaces
export interface User {
  id: string;
  email: string;
  name: string;
  user_type: 'creator' | 'investor' | 'production';
  profile_picture?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  last_login?: string;
  email_verified: boolean;
  company?: string;
  location?: string;
  website?: string;
}

export interface Pitch {
  id: string;
  title: string;
  logline: string;
  synopsis?: string;
  genre: string;
  themes?: string;
  target_audience: string;
  budget_range: string;
  creator_id: string;
  status: 'draft' | 'public' | 'private' | 'archived';
  created_at: string;
  updated_at: string;
  published_at?: string;
  view_count: number;
  like_count: number;
  is_featured: boolean;
  title_image?: string;
  pitch_deck_url?: string;
  world_description?: string;
  characters?: any;
  treatment?: string;
  market_analysis?: string;
  financial_projections?: string;
  production_timeline?: string;
}

export interface PitchView {
  id: string;
  pitch_id: string;
  user_id: string;
  viewed_at: string;
  duration?: number;
}

export interface PitchLike {
  id: string;
  pitch_id: string;
  user_id: string;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Investment {
  id: string;
  pitch_id: string;
  investor_id: string;
  amount: number;
  status: 'pending' | 'committed' | 'completed' | 'withdrawn';
  created_at: string;
  updated_at: string;
  terms?: any;
  notes?: string;
}

export interface NDARequest {
  id: string;
  pitch_id: string;
  requester_id: string;
  status: 'pending' | 'approved' | 'denied' | 'signed';
  created_at: string;
  updated_at: string;
  signed_at?: string;
  document_url?: string;
  notes?: string;
}

// Query Parameters and Options
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface SearchOptions extends QueryOptions {
  genre?: string;
  budgetRange?: string;
  themes?: string[];
  targetAudience?: string;
  status?: string;
}

export interface PitchStats {
  totalPitches: number;
  publicPitches: number;
  draftPitches: number;
  featuredPitches: number;
  totalViews: number;
  totalLikes: number;
}

/**
 * Main Database Queries Class
 * Provides type-safe methods for all database operations
 */
export class DatabaseQueries {
  constructor(private db: NeonConnection) {}

  // User Management Queries
  async getUserById(id: string): Promise<User | null> {
    const sql = this.db.sql;
    const result = await sql`
      SELECT * FROM users 
      WHERE id = ${id} AND is_active = true
    `;
    return result[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const sql = this.db.sql;
    const result = await sql`
      SELECT * FROM users 
      WHERE email = ${email} AND is_active = true
    `;
    return result[0] || null;
  }

  async createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const sql = this.db.sql;
    
    const result = await sql`
      INSERT INTO users (
        email, name, user_type, profile_picture, bio, is_active, 
        email_verified, company, location, website
      )
      VALUES (
        ${userData.email},
        ${userData.name},
        ${userData.user_type},
        ${userData.profile_picture || null},
        ${userData.bio || null},
        ${userData.is_active},
        ${userData.email_verified},
        ${userData.company || null},
        ${userData.location || null},
        ${userData.website || null}
      )
      RETURNING *
    `;

    if (!result.length) {
      throw new DatabaseError('Failed to create user');
    }
    return result[0];
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    const sql = this.db.sql;
    await sql`
      UPDATE users 
      SET last_login = NOW(), updated_at = NOW() 
      WHERE id = ${userId}
    `;
  }

  // Pitch Management Queries
  async getPublicPitches(options: QueryOptions = {}): Promise<Pitch[]> {
    const {
      limit = 20,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = options;

    const sql = this.db.sql;
    const result = await sql`
      SELECT p.*, u.name as creator_name, u.profile_picture as creator_profile_picture
      FROM pitches p
      JOIN users u ON p.creator_id = u.id
      WHERE p.status = 'public'
      ORDER BY p.${orderBy} ${orderDirection}
      LIMIT ${limit} OFFSET ${offset}
    `;

    return result;
  }

  async getPitchById(id: string): Promise<Pitch | null> {
    const sql = this.db.sql;
    const result = await sql`
      SELECT p.*, u.name as creator_name, u.profile_picture as creator_profile_picture
      FROM pitches p
      JOIN users u ON p.creator_id = u.id
      WHERE p.id = ${id}
    `;
    return result[0] || null;
  }

  async getUserPitches(userId: string, options: QueryOptions = {}): Promise<Pitch[]> {
    const {
      limit = 20,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = options;

    const sql = this.db.sql;
    const result = await sql`
      SELECT * FROM pitches 
      WHERE creator_id = ${userId}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT ${limit} OFFSET ${offset}
    `;

    return result;
  }

  async createPitch(pitchData: Omit<Pitch, 'id' | 'created_at' | 'updated_at' | 'view_count' | 'like_count'>): Promise<Pitch> {
    const sql = this.db.sql;

    const result = await sql`
      INSERT INTO pitches (
        title, logline, synopsis, genre, themes, target_audience, 
        budget_range, creator_id, status, is_featured, title_image,
        pitch_deck_url, world_description, characters, treatment,
        market_analysis, financial_projections, production_timeline
      )
      VALUES (
        ${pitchData.title},
        ${pitchData.logline},
        ${pitchData.synopsis || null},
        ${pitchData.genre},
        ${pitchData.themes || null},
        ${pitchData.target_audience},
        ${pitchData.budget_range},
        ${pitchData.creator_id},
        ${pitchData.status},
        ${pitchData.is_featured},
        ${pitchData.title_image || null},
        ${pitchData.pitch_deck_url || null},
        ${pitchData.world_description || null},
        ${pitchData.characters ? JSON.stringify(pitchData.characters) : null},
        ${pitchData.treatment || null},
        ${pitchData.market_analysis || null},
        ${pitchData.financial_projections || null},
        ${pitchData.production_timeline || null}
      )
      RETURNING *
    `;

    if (!result.length) {
      throw new DatabaseError('Failed to create pitch');
    }
    return result[0];
  }

  async updatePitch(id: string, updates: Partial<Pitch>): Promise<Pitch | null> {
    const setClause = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at')
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    if (!setClause) {
      throw new DatabaseError('No valid fields to update');
    }

    const query = `
      UPDATE pitches 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const params = [
      id,
      ...Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'created_at')
        .map(key => updates[key as keyof Pitch])
    ];

    return this.db.queryFirst<Pitch>(query, params);
  }

  async searchPitches(searchTerm: string, options: SearchOptions = {}): Promise<Pitch[]> {
    const {
      limit = 20,
      offset = 0,
      genre,
      budgetRange,
      themes,
      targetAudience,
      status = 'public',
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = options;

    const whereConditions = ["p.status = $1"];
    const params: any[] = [status];
    let paramCount = 1;

    // Add search term condition
    if (searchTerm) {
      paramCount++;
      whereConditions.push(`(
        p.title ILIKE $${paramCount} OR 
        p.logline ILIKE $${paramCount} OR 
        p.synopsis ILIKE $${paramCount} OR
        p.genre ILIKE $${paramCount} OR
        p.themes ILIKE $${paramCount}
      )`);
      params.push(`%${searchTerm}%`);
    }

    // Add genre filter
    if (genre) {
      paramCount++;
      whereConditions.push(`p.genre = $${paramCount}`);
      params.push(genre);
    }

    // Add budget range filter
    if (budgetRange) {
      paramCount++;
      whereConditions.push(`p.budget_range = $${paramCount}`);
      params.push(budgetRange);
    }

    // Add target audience filter
    if (targetAudience) {
      paramCount++;
      whereConditions.push(`p.target_audience = $${paramCount}`);
      params.push(targetAudience);
    }

    // Add themes filter
    if (themes && themes.length > 0) {
      paramCount++;
      whereConditions.push(`p.themes && $${paramCount}`);
      params.push(themes);
    }

    const query = `
      SELECT p.*, u.name as creator_name, u.profile_picture as creator_profile_picture
      FROM pitches p
      JOIN users u ON p.creator_id = u.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.${orderBy} ${orderDirection}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    params.push(limit, offset);
    return this.db.query<Pitch>(query, params);
  }

  async countPublicPitches(): Promise<number> {
    const sql = this.db.sql;
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM pitches 
      WHERE status = 'public'
    `;
    return result[0]?.count || 0;
  }

  async getFeaturedPitches(limit: number = 10): Promise<Pitch[]> {
    const sql = this.db.sql;
    const result = await sql`
      SELECT p.*, u.name as creator_name, u.profile_picture as creator_profile_picture
      FROM pitches p
      JOIN users u ON p.creator_id = u.id
      WHERE p.status = 'public' AND p.is_featured = true
      ORDER BY p.created_at DESC
      LIMIT ${limit}
    `;
    return result;
  }

  async getTrendingPitches(limit: number = 10): Promise<Pitch[]> {
    const sql = this.db.sql;
    const result = await sql`
      SELECT p.*, u.name as creator_name, u.profile_picture as creator_profile_picture,
             (p.view_count * 0.7 + p.like_count * 0.3) as trending_score
      FROM pitches p
      JOIN users u ON p.creator_id = u.id
      WHERE p.status = 'public' 
        AND p.created_at > NOW() - INTERVAL '30 days'
      ORDER BY trending_score DESC, p.created_at DESC
      LIMIT ${limit}
    `;
    return result;
  }

  // Engagement Queries
  async recordPitchView(pitchId: string, userId: string): Promise<void> {
    const sql = this.db.sql;
    
    // Check if view already exists today
    const existingView = await sql`
      SELECT id FROM pitch_views 
      WHERE pitch_id = ${pitchId} AND user_id = ${userId} 
        AND viewed_at > NOW() - INTERVAL '1 day'
    `;

    if (!existingView.length) {
      // Insert new view
      await sql`
        INSERT INTO pitch_views (pitch_id, viewer_id, viewed_at)
        VALUES (${pitchId}, ${userId}, NOW())
      `;

      // Update pitch view count
      await sql`
        UPDATE pitches 
        SET view_count = view_count + 1, updated_at = NOW()
        WHERE id = ${pitchId}
      `;
    }
  }

  async togglePitchLike(pitchId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const sql = this.db.sql;
    
    // Check if like exists
    const existingLike = await sql`
      SELECT id FROM pitch_likes 
      WHERE pitch_id = ${pitchId} AND user_id = ${userId}
    `;

    if (existingLike.length > 0) {
      // Remove like
      await sql`
        DELETE FROM pitch_likes 
        WHERE pitch_id = ${pitchId} AND user_id = ${userId}
      `;

      await sql`
        UPDATE pitches 
        SET like_count = like_count - 1, updated_at = NOW()
        WHERE id = ${pitchId}
      `;

      const pitch = await sql`
        SELECT like_count FROM pitches WHERE id = ${pitchId}
      `;

      return { liked: false, likeCount: pitch[0]?.like_count || 0 };
    } else {
      // Add like
      await sql`
        INSERT INTO pitch_likes (pitch_id, user_id, created_at)
        VALUES (${pitchId}, ${userId}, NOW())
      `;

      await sql`
        UPDATE pitches 
        SET like_count = like_count + 1, updated_at = NOW()
        WHERE id = ${pitchId}
      `;

      const pitch = await sql`
        SELECT like_count FROM pitches WHERE id = ${pitchId}
      `;

      return { liked: true, likeCount: pitch[0]?.like_count || 0 };
    }
  }

  async isPitchLikedByUser(pitchId: string, userId: string): Promise<boolean> {
    const sql = this.db.sql;
    const like = await sql`
      SELECT id FROM pitch_likes 
      WHERE pitch_id = ${pitchId} AND user_id = ${userId}
    `;

    return like.length > 0;
  }

  // Analytics and Statistics
  async getPitchStats(): Promise<PitchStats> {
    const sql = this.db.sql;
    
    const result = await sql`
      SELECT 
        COUNT(*) as total_pitches,
        COUNT(CASE WHEN status = 'public' THEN 1 END) as public_pitches,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_pitches,
        COUNT(CASE WHEN is_featured = true THEN 1 END) as featured_pitches,
        SUM(view_count) as total_views,
        SUM(like_count) as total_likes
      FROM pitches
    `;

    const stats = result[0];

    return {
      totalPitches: stats?.total_pitches || 0,
      publicPitches: stats?.public_pitches || 0,
      draftPitches: stats?.draft_pitches || 0,
      featuredPitches: stats?.featured_pitches || 0,
      totalViews: stats?.total_views || 0,
      totalLikes: stats?.total_likes || 0,
    };
  }

  async getUserStats(userId: string): Promise<{
    pitchCount: number;
    totalViews: number;
    totalLikes: number;
    followerCount: number;
    followingCount: number;
  }> {
    const sql = this.db.sql;
    
    const pitchStats = await sql`
      SELECT 
        COUNT(*) as pitch_count,
        SUM(view_count) as total_views,
        SUM(like_count) as total_likes
      FROM pitches 
      WHERE creator_id = ${userId}
    `;

    const followStats = await sql`
      SELECT 
        (SELECT COUNT(*) FROM follows WHERE following_id = ${userId}) as follower_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = ${userId}) as following_count
    `;

    const pitchData = pitchStats[0];
    const followData = followStats[0];

    return {
      pitchCount: pitchData?.pitch_count || 0,
      totalViews: pitchData?.total_views || 0,
      totalLikes: pitchData?.total_likes || 0,
      followerCount: followData?.follower_count || 0,
      followingCount: followData?.following_count || 0,
    };
  }

  // NDA Management
  async createNDARequest(pitchId: string, requesterId: string): Promise<NDARequest> {
    const sql = this.db.sql;
    
    const result = await sql`
      INSERT INTO nda_requests (pitch_id, requester_id, status, created_at)
      VALUES (${pitchId}, ${requesterId}, 'pending', NOW())
      RETURNING *
    `;

    if (!result.length) {
      throw new DatabaseError('Failed to create NDA request');
    }
    return result[0];
  }

  async getNDARequestsByPitch(pitchId: string): Promise<NDARequest[]> {
    const sql = this.db.sql;
    
    const result = await sql`
      SELECT nr.*, u.name as requester_name, u.email as requester_email
      FROM nda_requests nr
      JOIN users u ON nr.requester_id = u.id
      WHERE nr.pitch_id = ${pitchId}
      ORDER BY nr.created_at DESC
    `;
    
    return result;
  }

  async updateNDARequest(id: string, updates: Partial<NDARequest>): Promise<NDARequest | null> {
    const setClause = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at')
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    if (!setClause) {
      throw new DatabaseError('No valid fields to update');
    }

    const query = `
      UPDATE nda_requests 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const params = [
      id,
      ...Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'created_at')
        .map(key => updates[key as keyof NDARequest])
    ];

    return this.db.queryFirst<NDARequest>(query, params);
  }
}

export default DatabaseQueries;