/**
 * Pitch-related database queries using raw SQL
 * Parameterized Neon queries for all pitch operations
 */

import type { SqlQuery } from './base';
import { WhereBuilder, extractFirst, extractMany, DatabaseError, withTransaction } from './base';

// Type definitions
export interface Pitch {
  id: string;
  title: string;
  tagline: string;
  genre: string;
  subgenre?: string;
  format: string;
  setting?: string;
  time_period?: string;
  logline: string;
  synopsis?: string;
  target_audience?: string;
  budget_range?: string;
  comparable_works?: string[];
  pitch_deck_url?: string;
  video_pitch_url?: string;
  creator_id: string;
  status: 'draft' | 'published' | 'review' | 'archived';
  visibility: 'public' | 'private' | 'investors_only';
  view_count: number;
  like_count: number;
  investment_count: number;
  pitch_type?: string;
  themes?: string[];
  mood_tone?: string[];
  pacing?: string;
  hook?: string;
  character_description?: string;
  world_description?: string;
  visual_style?: string;
  audio_style?: string;
  franchise_potential?: string;
  merchandising_potential?: string;
  adaptation_source?: string;
  unique_selling_points?: string[];
  additional_media?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  published_at?: Date;
}

export interface CreatePitchInput {
  title: string;
  tagline: string;
  genre: string;
  subgenre?: string;
  format: string;
  logline: string;
  synopsis?: string;
  creator_id: string;
  status?: 'draft' | 'published' | 'review';
  visibility?: 'public' | 'private' | 'investors_only';
  target_audience?: string;
  budget_range?: string;
  comparable_works?: string[];
  pitch_deck_url?: string;
  video_pitch_url?: string;
  themes?: string[];
  mood_tone?: string[];
}

export interface UpdatePitchInput {
  title?: string;
  tagline?: string;
  genre?: string;
  subgenre?: string;
  format?: string;
  logline?: string;
  synopsis?: string;
  target_audience?: string;
  budget_range?: string;
  comparable_works?: string[];
  pitch_deck_url?: string;
  video_pitch_url?: string;
  status?: 'draft' | 'published' | 'review' | 'archived';
  visibility?: 'public' | 'private' | 'investors_only';
  themes?: string[];
  mood_tone?: string[];
}

export interface PitchFilters {
  genre?: string;
  format?: string;
  budget_range?: string;
  status?: string;
  visibility?: string;
  creator_id?: string;
  search?: string;
  excludeId?: string;
}

// Core pitch queries
export async function createPitch(
  sql: SqlQuery,
  input: CreatePitchInput
): Promise<Pitch> {
  const result = await sql`
    INSERT INTO pitches (
      title, tagline, genre, subgenre, format,
      logline, synopsis, target_audience, budget_range,
      comparable_works, pitch_deck_url, video_pitch_url,
      creator_id, user_id, status, visibility,
      themes, mood_tone,
      view_count, like_count, investment_count,
      created_at, updated_at, published_at
    ) VALUES (
      ${input.title}, ${input.tagline}, ${input.genre},
      ${input.subgenre || null}, ${input.format},
      ${input.logline}, ${input.synopsis || null},
      ${input.target_audience || null}, ${input.budget_range || null},
      ${input.comparable_works || []}::text[],
      ${input.pitch_deck_url || null}, ${input.video_pitch_url || null},
      ${input.creator_id}, ${input.creator_id}, ${input.status || 'draft'},
      ${input.visibility || 'public'},
      ${input.themes || []}::text[], ${input.mood_tone || []}::text[],
      0, 0, 0,
      NOW(), NOW(),
      ${input.status === 'published' ? sql`NOW()` : null}
    )
    RETURNING *
  `;
  
  const pitch = extractFirst<Pitch>(result);
  if (!pitch) {
    throw new DatabaseError('Failed to create pitch');
  }
  return pitch;
}

export async function getPitchById(
  sql: SqlQuery,
  pitchId: string,
  includeCreator: boolean = false
): Promise<Pitch | null> {
  const query = includeCreator ? `
    SELECT 
      p.*,
      u.username as creator_username,
      COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) as creator_avatar,
      u.company_name as creator_company,
      u.verification_tier as creator_verification_tier
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id
    WHERE p.id = $1
  ` : `
    SELECT * FROM pitches WHERE id = $1
  `;
  
  const result = await sql(query, [pitchId]);
  return extractFirst<Pitch>(result);
}

export async function updatePitch(
  sql: SqlQuery,
  pitchId: string,
  creatorId: string,
  input: UpdatePitchInput
): Promise<Pitch | null> {
  // Build dynamic UPDATE clause
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 3; // $1 is pitchId, $2 is creatorId

  // Handle each field
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        setClauses.push(`${key} = $${paramIndex}::text[]`);
      } else {
        setClauses.push(`${key} = $${paramIndex}`);
      }
      values.push(value);
      paramIndex++;
    }
  });

  if (setClauses.length === 0) {
    return getPitchById(sql, pitchId);
  }

  // Update published_at if changing to published
  if (input.status === 'published') {
    setClauses.push(`published_at = COALESCE(published_at, NOW())`);
  }

  setClauses.push(`updated_at = NOW()`);

  const query = `
    UPDATE pitches 
    SET ${setClauses.join(', ')}
    WHERE id = $1 AND creator_id = $2
    RETURNING *
  `;

  const result = await sql(query, [pitchId, creatorId, ...values]);
  return extractFirst<Pitch>(result);
}

export async function incrementPitchView(
  sql: SqlQuery,
  pitchId: string,
  viewerId?: string
): Promise<void> {
  // Increment view count
  await sql`
    UPDATE pitches 
    SET view_count = view_count + 1
    WHERE id = ${pitchId}
  `;

  // Track individual view if viewer is provided
  if (viewerId) {
    await sql`
      INSERT INTO pitch_views (pitch_id, viewer_id, viewed_at)
      VALUES (${pitchId}, ${viewerId}, NOW())
      ON CONFLICT (pitch_id, viewer_id) 
      DO UPDATE SET viewed_at = NOW(), view_count = pitch_views.view_count + 1
    `;
  }
}

export async function togglePitchLike(
  sql: SqlQuery,
  pitchId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> {
  return await withTransaction(sql, async (txSql) => {
    // Check if already liked
    const existing = await txSql`
      SELECT id FROM pitch_likes
      WHERE pitch_id = ${pitchId} AND user_id = ${userId}
    `;

    let liked: boolean;
    if (existing.length > 0) {
      // Unlike
      await txSql`
        DELETE FROM pitch_likes
        WHERE pitch_id = ${pitchId} AND user_id = ${userId}
      `;
      await txSql`
        UPDATE pitches 
        SET like_count = GREATEST(0, like_count - 1)
        WHERE id = ${pitchId}
      `;
      liked = false;
    } else {
      // Like
      await txSql`
        INSERT INTO pitch_likes (pitch_id, user_id, created_at)
        VALUES (${pitchId}, ${userId}, NOW())
      `;
      await txSql`
        UPDATE pitches 
        SET like_count = like_count + 1
        WHERE id = ${pitchId}
      `;
      liked = true;
    }

    // Get updated count
    const result = await txSql`
      SELECT like_count FROM pitches WHERE id = ${pitchId}
    `;
    const pitch = extractFirst<any>(result);
    
    return { liked, likeCount: pitch?.like_count || 0 };
  });
}

// Browse and discovery queries
// FIXED: Trending tab - Only shows pitches with >100 views in last 7 days
export async function getTrendingPitches(
  sql: SqlQuery,
  limit: number = 20,
  offset: number = 0
): Promise<Pitch[]> {
  const result = await sql`
    SELECT 
      p.*,
      u.username as creator_username,
      COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) as creator_avatar,
      u.company_name as creator_company,
      u.verification_tier as creator_verification_tier,
      (p.view_count + (p.like_count * 2) + (p.investment_count * 5)) as engagement_score
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id
    WHERE p.status = 'published' 
      AND p.visibility IN ('public', 'investors_only')
      AND p.view_count > 100
      AND p.published_at > NOW() - INTERVAL '7 days'
    ORDER BY engagement_score DESC, p.view_count DESC, p.published_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return extractMany<Pitch>(result);
}

// FIXED: New tab - Only shows pitches from last 30 days, excludes trending
export async function getNewPitches(
  sql: SqlQuery,
  limit: number = 20,
  offset: number = 0
): Promise<Pitch[]> {
  const result = await sql`
    SELECT 
      p.*,
      u.username as creator_username,
      COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) as creator_avatar,
      u.company_name as creator_company,
      u.verification_tier as creator_verification_tier
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id
    WHERE p.status = 'published' 
      AND p.visibility IN ('public', 'investors_only')
      AND p.published_at > NOW() - INTERVAL '30 days'
      AND (p.view_count <= 100 OR p.published_at <= NOW() - INTERVAL '7 days')
    ORDER BY p.published_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return extractMany<Pitch>(result);
}

export async function searchPitches(
  sql: SqlQuery,
  filters: PitchFilters,
  limit: number = 20,
  offset: number = 0
): Promise<Pitch[]> {
  const wb = new WhereBuilder();
  
  // Basic filters
  wb.add('p.status = \'published\'');
  wb.add('p.visibility IN (\'public\', \'investors_only\')');
  
  // Optional filters
  wb.addOptional('p.genre', '=', filters.genre);
  wb.addOptional('p.format', '=', filters.format);
  wb.addOptional('p.budget_range', '=', filters.budget_range);
  wb.addOptional('p.creator_id', '=', filters.creator_id);
  
  // Exclude specific pitch
  if (filters.excludeId) {
    wb.add('p.id != $param', filters.excludeId);
  }
  
  // Text search
  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    wb.add(`(
      LOWER(p.title) LIKE LOWER($param) OR 
      LOWER(p.tagline) LIKE LOWER($param) OR 
      LOWER(p.logline) LIKE LOWER($param) OR
      LOWER(p.synopsis) LIKE LOWER($param)
    )`, searchPattern);
  }
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT 
      p.*,
      u.username as creator_username,
      COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) as creator_avatar,
      u.company_name as creator_company,
      u.verification_tier as creator_verification_tier
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id
    ${where}
    ORDER BY 
      CASE 
        WHEN LOWER(p.title) = LOWER($1) THEN 1
        WHEN LOWER(p.title) LIKE LOWER($1 || '%') THEN 2
        ELSE 3
      END,
      p.published_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  
  const result = await sql(query, [filters.search || '', ...params]);
  return extractMany<Pitch>(result);
}

export async function getSimilarPitches(
  sql: SqlQuery,
  pitchId: string,
  limit: number = 6
): Promise<Pitch[]> {
  // First get the reference pitch
  const refPitch = await getPitchById(sql, pitchId);
  if (!refPitch) return [];

  const result = await sql`
    SELECT 
      p.*,
      u.username as creator_username,
      COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) as creator_avatar,
      (
        CASE WHEN p.genre = ${refPitch.genre} THEN 3 ELSE 0 END +
        CASE WHEN p.format = ${refPitch.format} THEN 2 ELSE 0 END +
        CASE WHEN p.budget_range = ${refPitch.budget_range} THEN 1 ELSE 0 END
      ) as similarity_score
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id
    WHERE p.id != ${pitchId}
      AND p.status = 'published'
      AND p.visibility IN ('public', 'investors_only')
      AND (
        p.genre = ${refPitch.genre} OR 
        p.format = ${refPitch.format} OR
        p.subgenre = ${refPitch.subgenre}
      )
    ORDER BY similarity_score DESC, p.view_count DESC
    LIMIT ${limit}
  `;
  return extractMany<Pitch>(result);
}

// Creator-specific queries
export async function getCreatorPitches(
  sql: SqlQuery,
  creatorId: string,
  status?: 'draft' | 'published' | 'review' | 'archived',
  limit: number = 20,
  offset: number = 0
): Promise<Pitch[]> {
  const wb = new WhereBuilder();
  wb.add('creator_id = $param', creatorId);
  wb.addOptional('status', '=', status);
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT * FROM pitches
    ${where}
    ORDER BY updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  
  const result = await sql(query, params);
  return extractMany<Pitch>(result);
}

export async function getCreatorStats(
  sql: SqlQuery,
  creatorId: string
): Promise<{
  totalPitches: number;
  publishedPitches: number;
  totalViews: number;
  totalLikes: number;
  totalInvestments: number;
  avgEngagement: number;
}> {
  const result = await sql`
    SELECT 
      COUNT(*) as total_pitches,
      COUNT(CASE WHEN status = 'published' THEN 1 END) as published_pitches,
      COALESCE(SUM(view_count), 0) as total_views,
      COALESCE(SUM(like_count), 0) as total_likes,
      COALESCE(SUM(investment_count), 0) as total_investments,
      COALESCE(AVG(
        CASE 
          WHEN status = 'published' AND view_count > 0 
          THEN (like_count::float / view_count * 100)
          ELSE 0 
        END
      ), 0) as avg_engagement
    FROM pitches
    WHERE creator_id = ${creatorId}
  `;
  
  const stats = extractFirst<any>(result) || {};
  return {
    totalPitches: Number(stats.total_pitches || 0),
    publishedPitches: Number(stats.published_pitches || 0),
    totalViews: Number(stats.total_views || 0),
    totalLikes: Number(stats.total_likes || 0),
    totalInvestments: Number(stats.total_investments || 0),
    avgEngagement: Number(stats.avg_engagement || 0)
  };
}

// Investor-specific queries
export async function getSavedPitches(
  sql: SqlQuery,
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<Pitch[]> {
  const result = await sql`
    SELECT 
      p.*,
      u.username as creator_username,
      COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) as creator_avatar,
      sp.saved_at
    FROM saved_pitches sp
    JOIN pitches p ON sp.pitch_id = p.id
    LEFT JOIN users u ON p.creator_id = u.id
    WHERE sp.user_id = ${userId}
    ORDER BY sp.saved_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return extractMany<Pitch>(result);
}

export async function toggleSavePitch(
  sql: SqlQuery,
  pitchId: string,
  userId: string
): Promise<{ saved: boolean }> {
  // Check if already saved
  const existing = await sql`
    SELECT id FROM saved_pitches
    WHERE pitch_id = ${pitchId} AND user_id = ${userId}
  `;

  if (existing.length > 0) {
    // Unsave
    await sql`
      DELETE FROM saved_pitches
      WHERE pitch_id = ${pitchId} AND user_id = ${userId}
    `;
    return { saved: false };
  } else {
    // Save
    await sql`
      INSERT INTO saved_pitches (pitch_id, user_id, saved_at)
      VALUES (${pitchId}, ${userId}, NOW())
    `;
    return { saved: true };
  }
}

// Delete/Archive operations
export async function archivePitch(
  sql: SqlQuery,
  pitchId: string,
  creatorId: string
): Promise<boolean> {
  const result = await sql`
    UPDATE pitches 
    SET status = 'archived', updated_at = NOW()
    WHERE id = ${pitchId} AND creator_id = ${creatorId}
    RETURNING id
  `;
  return result.length > 0;
}

export async function deletePitch(
  sql: SqlQuery,
  pitchId: string,
  creatorId: string
): Promise<boolean> {
  const result = await sql`
    DELETE FROM pitches 
    WHERE id = ${pitchId} AND creator_id = ${creatorId}
    RETURNING id
  `;
  return result.length > 0;
}

// Public endpoint queries - no authentication required
// These queries filter for public visibility and published status only

export async function getPublicPitches(
  sql: SqlQuery,
  filters: {
    genre?: string;
    format?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Pitch[]> {
  const {
    genre,
    format,
    search,
    limit = 20,
    offset = 0
  } = filters;

  const wb = new WhereBuilder();
  wb.add('p.status = \'published\'');
  wb.add('p.visibility = \'public\''); // Only truly public pitches
  
  // Optional filters
  wb.addOptional('p.genre', '=', genre);
  wb.addOptional('p.format', '=', format);
  
  // Text search (safe for public)
  if (search) {
    const searchPattern = `%${search}%`;
    wb.add(`(
      LOWER(p.title) LIKE LOWER($param) OR 
      LOWER(p.tagline) LIKE LOWER($param) OR 
      LOWER(p.logline) LIKE LOWER($param)
    )`, searchPattern);
  }
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT
      p.*,
      u.username as creator_username,
      COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) as creator_avatar,
      u.company_name as creator_company,
      u.verification_tier as creator_verification_tier,
      u.user_type as creator_type
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id OR p.user_id = u.id
    ${where}
    ORDER BY p.published_at DESC, p.view_count DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const result = await sql(query, params);
  return extractMany<Pitch>(result);
}

export async function getPublicTrendingPitches(
  sql: SqlQuery,
  limit: number = 20,
  offset: number = 0
): Promise<Pitch[]> {
  const result = await sql`
    SELECT
      p.*,
      u.username as creator_username,
      COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) as creator_avatar,
      u.company_name as creator_company,
      u.verification_tier as creator_verification_tier,
      u.user_type as creator_type,
      COALESCE(p.heat_score, 0)::float as heat_score
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id OR p.user_id = u.id
    WHERE p.status = 'published'
      AND p.visibility = 'public'
    ORDER BY p.heat_score DESC NULLS LAST, p.view_count DESC, p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return extractMany<Pitch>(result);
}

export async function getPublicNewPitches(
  sql: SqlQuery,
  limit: number = 20,
  offset: number = 0
): Promise<Pitch[]> {
  const result = await sql`
    SELECT
      p.*,
      u.username as creator_username,
      COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) as creator_avatar,
      u.company_name as creator_company,
      u.verification_tier as creator_verification_tier,
      u.user_type as creator_type
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id OR p.user_id = u.id
    WHERE p.status = 'published'
      AND p.visibility = 'public'
    ORDER BY p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return extractMany<Pitch>(result);
}

export async function getPublicFeaturedPitches(
  sql: SqlQuery,
  limit: number = 6
): Promise<Pitch[]> {
  const result = await sql`
    SELECT
      p.*,
      u.username as creator_username,
      COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) as creator_avatar,
      u.company_name as creator_company,
      u.verification_tier as creator_verification_tier,
      u.user_type as creator_type,
      (COALESCE(p.view_count, 0) + (COALESCE(p.like_count, 0) * 3)) as feature_score
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id OR p.user_id = u.id
    WHERE p.status = 'published'
      AND p.visibility = 'public'
    ORDER BY feature_score DESC, p.created_at DESC
    LIMIT ${limit}
  `;
  return extractMany<Pitch>(result);
}

export async function getPublicPitchById(
  sql: SqlQuery,
  pitchId: string
): Promise<Pitch | null> {
  const result = await sql`
    SELECT
      p.*,
      u.username as creator_username,
      COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) as creator_avatar,
      u.company_name as creator_company,
      u.verification_tier as creator_verification_tier,
      u.user_type as creator_type
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id OR p.user_id = u.id
    WHERE p.id = ${pitchId}
      AND p.status = 'published'
      AND p.visibility = 'public'
  `;
  return extractFirst<Pitch>(result);
}

export async function searchPublicPitches(
  sql: SqlQuery,
  searchTerm: string,
  filters: {
    genre?: string;
    format?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Pitch[]> {
  const {
    genre,
    format,
    limit = 20,
    offset = 0
  } = filters;

  const wb = new WhereBuilder();
  wb.add('p.status = \'published\'');
  wb.add('p.visibility = \'public\'');
  
  // Optional filters
  wb.addOptional('p.genre', '=', genre);
  wb.addOptional('p.format', '=', format);
  
  // Search terms - only search public fields
  if (searchTerm) {
    const searchPattern = `%${searchTerm}%`;
    wb.add(`(
      LOWER(p.title) LIKE LOWER($param) OR 
      LOWER(p.tagline) LIKE LOWER($param) OR 
      LOWER(p.logline) LIKE LOWER($param) OR
      LOWER(p.genre) LIKE LOWER($param) OR
      LOWER(p.format) LIKE LOWER($param)
    )`, searchPattern);
  }
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT
      p.*,
      u.username as creator_username,
      COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) as creator_avatar,
      u.company_name as creator_company,
      u.verification_tier as creator_verification_tier,
      u.user_type as creator_type
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id OR p.user_id = u.id
    ${where}
    ORDER BY
      CASE
        WHEN LOWER(p.title) = LOWER($1) THEN 1
        WHEN LOWER(p.title) LIKE LOWER($1 || '%') THEN 2
        ELSE 3
      END,
      p.view_count DESC,
      p.published_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const result = await sql(query, [searchTerm || '', ...params]);
  return extractMany<Pitch>(result);
}

// Increment view count for public pitch (without user tracking)
export async function incrementPublicPitchView(
  sql: SqlQuery,
  pitchId: string
): Promise<void> {
  await sql`
    UPDATE pitches 
    SET view_count = view_count + 1
    WHERE id = ${pitchId} 
      AND status = 'published' 
      AND visibility = 'public'
  `;
}