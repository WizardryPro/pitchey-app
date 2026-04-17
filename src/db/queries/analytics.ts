/**
 * Analytics and metrics database queries using raw SQL
 * Replaces Drizzle ORM with parameterized Neon queries
 */

import type { SqlQuery } from './base';
import { WhereBuilder, extractFirst, extractMany, DatabaseError } from './base';

// Type definitions
export interface PitchAnalytics {
  pitch_id: string;
  view_count: number;
  unique_viewers: number;
  save_count: number;
  share_count: number;
  avg_view_duration: number;
  bounce_rate: number;
  engagement_score: number;
  conversion_rate: number;
}

export interface UserAnalytics {
  user_id: string;
  total_pitches: number;
  total_views: number;
  total_investments: number;
  avg_engagement: number;
  growth_rate: number;
  active_days: number;
}

export interface PlatformMetrics {
  total_users: number;
  active_users: number;
  total_pitches: number;
  total_investments: number;
  total_revenue: number;
  conversion_rate: number;
  churn_rate: number;
  growth_rate: number;
}

export interface ViewEvent {
  id: string;
  pitch_id: string;
  viewer_id?: string;
  session_id: string;
  ip_address?: string;
  user_agent?: string;
  referrer?: string;
  duration_seconds: number;
  bounce: boolean;
  created_at: Date;
}

// Time-series data types for charts
export interface ViewTimeSeriesPoint {
  date: string;
  views: number;
}

export interface EngagementTimeSeriesPoint {
  date: string;
  engagement_rate: number;
  likes: number;
  shares: number;
  saves: number;
}

export interface FundingTimeSeriesPoint {
  date: string;
  amount: number;
  cumulative: number;
}

export interface AudienceDemographic {
  category: string;
  count: number;
  percentage: number;
}

export interface TopPerformingPitch {
  pitch_id: string;
  title: string;
  views: number;
  engagement_rate: number;
  funding: number;
}

// ============================================
// TIME-SERIES ANALYTICS QUERIES
// ============================================

/**
 * Get pitch views over time for charts
 */
export async function getPitchViewsTimeSeries(
  sql: SqlQuery,
  pitchId: string,
  days: number = 30
): Promise<ViewTimeSeriesPoint[]> {
  try {
    // Each row in pitch_views is a single view, so COUNT(*) gives us views per day
    const result = await sql`
      WITH date_series AS (
        SELECT generate_series(
          DATE_TRUNC('day', NOW() - INTERVAL '1 day' * ${days}),
          DATE_TRUNC('day', NOW()),
          '1 day'::interval
        )::date AS date
      )
      SELECT
        ds.date::text,
        COALESCE(COUNT(pv.id), 0)::int AS views
      FROM date_series ds
      LEFT JOIN pitch_views pv
        ON DATE(pv.viewed_at) = ds.date
        AND pv.pitch_id::text = ${pitchId}
      GROUP BY ds.date
      ORDER BY ds.date ASC
    `;

    return extractMany<ViewTimeSeriesPoint>(result);
  } catch (error) {
    console.error('[Analytics] getPitchViewsTimeSeries error:', error);
    return [];
  }
}

/**
 * Get user's total views over time across all their pitches
 */
export async function getUserViewsTimeSeries(
  sql: SqlQuery,
  userId: string,
  days: number = 30
): Promise<ViewTimeSeriesPoint[]> {
  try {
    const result = await sql`
      WITH date_series AS (
        SELECT generate_series(
          DATE_TRUNC('day', NOW() - INTERVAL '1 day' * ${days}),
          DATE_TRUNC('day', NOW()),
          '1 day'::interval
        )::date AS date
      ),
      user_pitches AS (
        SELECT id FROM pitches WHERE creator_id::text = ${userId} OR user_id::text = ${userId}
      )
      SELECT
        ds.date::text,
        COALESCE(COUNT(pv.id), 0)::int AS views
      FROM date_series ds
      LEFT JOIN pitch_views pv
        ON DATE(pv.viewed_at) = ds.date
        AND pv.pitch_id IN (SELECT id FROM user_pitches)
      GROUP BY ds.date
      ORDER BY ds.date ASC
    `;

    return extractMany<ViewTimeSeriesPoint>(result);
  } catch (error) {
    console.error('[Analytics] getUserViewsTimeSeries error:', error);
    return [];
  }
}

/**
 * Get engagement rate over time (likes, saves, shares per view)
 */
export async function getEngagementTimeSeries(
  sql: SqlQuery,
  userId: string,
  days: number = 30
): Promise<EngagementTimeSeriesPoint[]> {
  try {
    const result = await sql`
      WITH date_series AS (
        SELECT generate_series(
          DATE_TRUNC('day', NOW() - INTERVAL '1 day' * ${days}),
          DATE_TRUNC('day', NOW()),
          '1 day'::interval
        )::date AS date
      ),
      user_pitches AS (
        SELECT id FROM pitches WHERE creator_id::text = ${userId} OR user_id::text = ${userId}
      ),
      daily_views AS (
        SELECT DATE(viewed_at) as date, COUNT(*) as views
        FROM pitch_views
        WHERE pitch_id IN (SELECT id FROM user_pitches)
        GROUP BY DATE(viewed_at)
      ),
      daily_likes AS (
        SELECT DATE(created_at) as date, COUNT(*) as likes
        FROM pitch_likes
        WHERE pitch_id IN (SELECT id FROM user_pitches)
        GROUP BY DATE(created_at)
      ),
      daily_saves AS (
        SELECT DATE(created_at) as date, COUNT(*) as saves
        FROM saved_pitches
        WHERE pitch_id IN (SELECT id FROM user_pitches)
        GROUP BY DATE(created_at)
      )
      SELECT
        ds.date::text,
        CASE
          WHEN COALESCE(dv.views, 0) > 0
          THEN ROUND((COALESCE(dl.likes, 0) + COALESCE(dsv.saves, 0))::numeric / dv.views * 100, 2)
          ELSE 0
        END as engagement_rate,
        COALESCE(dl.likes, 0)::int as likes,
        0::int as shares,
        COALESCE(dsv.saves, 0)::int as saves
      FROM date_series ds
      LEFT JOIN daily_views dv ON ds.date = dv.date
      LEFT JOIN daily_likes dl ON ds.date = dl.date
      LEFT JOIN daily_saves dsv ON ds.date = dsv.date
      ORDER BY ds.date ASC
    `;

    return extractMany<EngagementTimeSeriesPoint>(result);
  } catch (error) {
    console.error('[Analytics] getEngagementTimeSeries error:', error);
    return [];
  }
}

/**
 * Get cumulative funding progress over time
 */
export async function getFundingTimeSeries(
  sql: SqlQuery,
  userId: string,
  days: number = 365
): Promise<FundingTimeSeriesPoint[]> {
  try {
    const result = await sql`
      WITH date_series AS (
        SELECT generate_series(
          DATE_TRUNC('day', NOW() - INTERVAL '1 day' * ${days}),
          DATE_TRUNC('day', NOW()),
          '1 day'::interval
        )::date AS date
      ),
      user_pitches AS (
        SELECT id FROM pitches WHERE creator_id::text = ${userId}
      ),
      daily_funding AS (
        SELECT
          DATE(created_at) as date,
          SUM(amount) as amount
        FROM investments
        WHERE pitch_id IN (SELECT id FROM user_pitches)
          AND status IN ('committed', 'funded')
        GROUP BY DATE(created_at)
      )
      SELECT
        ds.date::text,
        COALESCE(df.amount, 0)::numeric as amount,
        SUM(COALESCE(df.amount, 0)) OVER (ORDER BY ds.date)::numeric as cumulative
      FROM date_series ds
      LEFT JOIN daily_funding df ON ds.date = df.date
      ORDER BY ds.date ASC
    `;

    return extractMany<FundingTimeSeriesPoint>(result);
  } catch (error) {
    console.error('[Analytics] getFundingTimeSeries error:', error);
    return [];
  }
}

/**
 * Get audience demographics by user type
 */
export async function getAudienceDemographics(
  sql: SqlQuery,
  userId: string
): Promise<{ userTypes: AudienceDemographic[]; categories: AudienceDemographic[] }> {
  try {
    // Get viewer user types
    const userTypeResult = await sql`
      WITH user_pitches AS (
        SELECT id FROM pitches WHERE creator_id::text = ${userId}
      ),
      viewer_types AS (
        SELECT
          COALESCE(u.user_type, 'anonymous') as user_type,
          COUNT(*) as count
        FROM pitch_views pv
        LEFT JOIN users u ON pv.viewer_id = u.id
        WHERE pv.pitch_id IN (SELECT id FROM user_pitches)
        GROUP BY COALESCE(u.user_type, 'anonymous')
      ),
      total AS (
        SELECT SUM(count) as total FROM viewer_types
      )
      SELECT
        user_type as category,
        count::int,
        CASE WHEN t.total > 0
          THEN ROUND((count::numeric / t.total) * 100, 1)
          ELSE 0
        END as percentage
      FROM viewer_types, total t
      ORDER BY count DESC
    `;

    // Get views by pitch category/genre
    const categoryResult = await sql`
      WITH user_pitches AS (
        SELECT id, genre FROM pitches WHERE creator_id::text = ${userId} OR user_id::text = ${userId}
      ),
      category_views AS (
        SELECT
          COALESCE(up.genre, 'Uncategorized') as category,
          COUNT(pv.id) as count
        FROM pitch_views pv
        JOIN user_pitches up ON pv.pitch_id = up.id
        GROUP BY COALESCE(up.genre, 'Uncategorized')
      ),
      total AS (
        SELECT SUM(count) as total FROM category_views
      )
      SELECT
        category,
        count::int,
        CASE WHEN t.total > 0
          THEN ROUND((count::numeric / t.total) * 100, 1)
          ELSE 0
        END as percentage
      FROM category_views, total t
      ORDER BY count DESC
    `;

    return {
      userTypes: extractMany<AudienceDemographic>(userTypeResult),
      categories: extractMany<AudienceDemographic>(categoryResult)
    };
  } catch (error) {
    console.error('[Analytics] getAudienceDemographics error:', error);
    return { userTypes: [], categories: [] };
  }
}

/**
 * Get top performing pitches for a user
 */
export async function getTopPerformingPitchesForUser(
  sql: SqlQuery,
  userId: string,
  limit: number = 5
): Promise<TopPerformingPitch[]> {
  try {
    const result = await sql`
      SELECT
        p.id::text as pitch_id,
        p.title,
        COALESCE(p.view_count, 0)::int as views,
        CASE
          WHEN COALESCE(p.view_count, 0) > 0
          THEN ROUND(
            (COALESCE(p.like_count, 0) + COALESCE((SELECT COUNT(*) FROM saved_pitches sp WHERE sp.pitch_id = p.id), 0))::numeric
            / p.view_count * 100, 1
          )
          ELSE 0
        END as engagement_rate,
        COALESCE(
          (SELECT SUM(amount) FROM investments
           WHERE pitch_id = p.id AND status IN ('committed', 'funded')),
          0
        )::numeric as funding
      FROM pitches p
      WHERE p.creator_id::text = ${userId}
        AND p.status = 'published'
      ORDER BY views DESC, engagement_rate DESC
      LIMIT ${limit}
    `;

    return extractMany<TopPerformingPitch>(result);
  } catch (error) {
    console.error('[Analytics] getTopPerformingPitchesForUser error:', error);
    return [];
  }
}

/**
 * Get monthly performance overview
 */
export async function getMonthlyPerformance(
  sql: SqlQuery,
  userId: string,
  months: number = 12
): Promise<Array<{ month: string; pitches: number; views: number; engagement: number }>> {
  try {
    const result = await sql`
      WITH month_series AS (
        SELECT generate_series(
          DATE_TRUNC('month', NOW() - INTERVAL '1 month' * ${months}),
          DATE_TRUNC('month', NOW()),
          '1 month'::interval
        )::date AS month
      ),
      monthly_pitches AS (
        SELECT
          DATE_TRUNC('month', created_at)::date as month,
          COUNT(*) as pitches
        FROM pitches
        WHERE creator_id::text = ${userId} OR user_id::text = ${userId}
        GROUP BY DATE_TRUNC('month', created_at)
      ),
      user_pitch_ids AS (
        SELECT id FROM pitches WHERE creator_id::text = ${userId} OR user_id::text = ${userId}
      ),
      monthly_views AS (
        SELECT
          DATE_TRUNC('month', viewed_at)::date as month,
          COUNT(*) as views
        FROM pitch_views
        WHERE pitch_id IN (SELECT id FROM user_pitch_ids)
        GROUP BY DATE_TRUNC('month', viewed_at)
      ),
      monthly_likes AS (
        SELECT
          DATE_TRUNC('month', created_at)::date as month,
          COUNT(*) as likes
        FROM pitch_likes
        WHERE pitch_id IN (SELECT id FROM user_pitch_ids)
        GROUP BY DATE_TRUNC('month', created_at)
      )
      SELECT
        TO_CHAR(ms.month, 'Mon') as month,
        COALESCE(mp.pitches, 0)::int as pitches,
        COALESCE(mv.views, 0)::int as views,
        CASE
          WHEN COALESCE(mv.views, 0) > 0
          THEN ROUND(COALESCE(ml.likes, 0)::numeric / mv.views * 100, 1)
          ELSE 0
        END as engagement
      FROM month_series ms
      LEFT JOIN monthly_pitches mp ON ms.month = mp.month
      LEFT JOIN monthly_views mv ON ms.month = mv.month
      LEFT JOIN monthly_likes ml ON ms.month = ml.month
      ORDER BY ms.month ASC
    `;

    return extractMany<any>(result);
  } catch (error) {
    console.error('[Analytics] getMonthlyPerformance error:', error);
    return [];
  }
}

/**
 * Get average rating for user's pitches
 */
export async function getUserAverageRating(
  sql: SqlQuery,
  userId: string
): Promise<number> {
  try {
    const result = await sql`
      SELECT COALESCE(AVG(rating), 0)::numeric as avg_rating
      FROM pitch_ratings pr
      JOIN pitches p ON pr.pitch_id = p.id
      WHERE p.creator_id::text = ${userId}
    `;

    const data = extractFirst<{ avg_rating: number }>(result);
    return data?.avg_rating || 0;
  } catch (error) {
    console.error('[Analytics] getUserAverageRating error:', error);
    return 0;
  }
}

/**
 * Get response rate (messages responded to / total messages received)
 */
export async function getUserResponseRate(
  sql: SqlQuery,
  userId: string
): Promise<number> {
  try {
    const result = await sql`
      WITH received AS (
        SELECT COUNT(*) as total
        FROM messages
        WHERE recipient_id::text = ${userId}
      ),
      responded AS (
        SELECT COUNT(DISTINCT m1.sender_id) as total
        FROM messages m1
        WHERE m1.recipient_id::text = ${userId}
          AND EXISTS (
            SELECT 1 FROM messages m2
            WHERE m2.sender_id::text = ${userId}
              AND m2.recipient_id = m1.sender_id
              AND m2.sent_at > m1.sent_at
          )
      )
      SELECT
        CASE WHEN r.total > 0
          THEN ROUND(res.total::numeric / r.total * 100, 1)
          ELSE 0
        END as response_rate
      FROM received r, responded res
    `;

    const data = extractFirst<{ response_rate: number }>(result);
    return data?.response_rate || 0;
  } catch (error) {
    console.error('[Analytics] getUserResponseRate error:', error);
    return 0;
  }
}

// View tracking — uses pitch_views table (not view_events)
export async function trackPitchView(
  sql: SqlQuery,
  pitchId: string,
  viewerId?: string,
  sessionId?: string,
  metadata?: {
    ip_address?: string;
    user_agent?: string;
    referrer?: string;
  }
): Promise<ViewEvent> {
  const result = await sql`
    INSERT INTO pitch_views (
      pitch_id, user_id, session_id,
      ip_address, user_agent, referrer,
      view_duration, viewed_at
    ) VALUES (
      ${pitchId}, ${viewerId || null}, ${sessionId || crypto.randomUUID()},
      ${metadata?.ip_address || null}, ${metadata?.user_agent || null},
      ${metadata?.referrer || null},
      0, NOW()
    )
    RETURNING
      id, pitch_id, user_id as viewer_id, session_id,
      ip_address, user_agent, referrer,
      view_duration as duration_seconds, false as bounce, viewed_at as created_at
  `;

  const event = extractFirst<ViewEvent>(result);
  if (!event) {
    throw new DatabaseError('Failed to track view');
  }

  // Update pitch view count
  await sql`
    UPDATE pitches
    SET
      view_count = view_count + 1,
      updated_at = NOW()
    WHERE id = ${pitchId}
  `;

  return event;
}

export async function updateViewDuration(
  sql: SqlQuery,
  viewEventId: string,
  durationSeconds: number,
  _bounce: boolean
): Promise<void> {
  await sql`
    UPDATE pitch_views
    SET view_duration = ${durationSeconds}
    WHERE id = ${viewEventId}
  `;
}

// Pitch analytics — uses pitch_views table
export async function getPitchAnalytics(
  sql: SqlQuery,
  pitchId: string,
  _startDate?: Date,
  _endDate?: Date
): Promise<PitchAnalytics> {
  try {
    const result = await sql`
      SELECT
        ${pitchId} as pitch_id,
        COUNT(*)::int as view_count,
        COUNT(DISTINCT COALESCE(pv.viewer_id::text, pv.session_id))::int as unique_viewers,
        (SELECT COUNT(*) FROM saved_pitches WHERE pitch_id = ${pitchId})::int as save_count,
        0 as share_count,
        COALESCE(AVG(pv.view_duration), 0) as avg_view_duration,
        0 as bounce_rate,
        COALESCE(
          (COUNT(CASE WHEN pv.view_duration > 30 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100),
          0
        ) as engagement_score,
        0 as conversion_rate
      FROM pitch_views pv
      WHERE pv.pitch_id::text = ${pitchId}
    `;

    const analytics = extractFirst<PitchAnalytics>(result);
    if (!analytics) {
      return {
        pitch_id: pitchId,
        view_count: 0,
        unique_viewers: 0,
        save_count: 0,
        share_count: 0,
        avg_view_duration: 0,
        bounce_rate: 0,
        engagement_score: 0,
        conversion_rate: 0
      };
    }
    return analytics;
  } catch (error) {
    console.error('[Analytics] getPitchAnalytics error:', error);
    return {
      pitch_id: pitchId,
      view_count: 0,
      unique_viewers: 0,
      save_count: 0,
      share_count: 0,
      avg_view_duration: 0,
      bounce_rate: 0,
      engagement_score: 0,
      conversion_rate: 0
    };
  }
}

export async function getTopPerformingPitches(
  sql: SqlQuery,
  limit: number = 10,
  _metric: 'views' | 'engagement' | 'conversion' = 'views',
  _startDate?: Date,
  _endDate?: Date
): Promise<Array<{
  pitch_id: string;
  title: string;
  creator_username: string;
  metric_value: number;
}>> {
  try {
    const result = await sql`
      SELECT
        p.id as pitch_id,
        p.title,
        COALESCE(u.name, u.email) as creator_username,
        COALESCE(p.view_count, 0)::float as metric_value
      FROM pitches p
      LEFT JOIN users u ON p.creator_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.view_count DESC NULLS LAST
      LIMIT ${limit}
    `;
    return extractMany<any>(result);
  } catch (error) {
    console.error('[Analytics] getTopPerformingPitches error:', error);
    return [];
  }
}

// User analytics
export async function getUserAnalytics(
  sql: SqlQuery,
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<UserAnalytics> {
  const wb = new WhereBuilder();
  wb.addOptional('created_at', '>=', startDate);
  wb.addOptional('created_at', '<=', endDate);
  
  const { where } = wb.build();
  
  const result = await sql`
    SELECT 
      ${userId} as user_id,
      (SELECT COUNT(*) FROM pitches WHERE creator_id = ${userId})::int as total_pitches,
      (
        SELECT SUM(view_count) FROM pitches 
        WHERE creator_id = ${userId}
      )::int as total_views,
      (
        SELECT COUNT(*) FROM investments 
        WHERE investor_id = ${userId} 
          AND status IN ('committed', 'funded')
      )::int as total_investments,
      (
        SELECT AVG(
          CASE
            WHEN view_count > 0 THEN
              (like_count::float / view_count * 100)
            ELSE 0
          END
        )
        FROM pitches
        WHERE creator_id = ${userId}
      ) as avg_engagement,
      0 as growth_rate, -- Calculate based on time period
      (
        SELECT COUNT(DISTINCT DATE(created_at))::int
        FROM (
          SELECT created_at FROM pitches WHERE creator_id = ${userId}
          UNION ALL
          SELECT created_at FROM messages WHERE sender_id = ${userId}
          UNION ALL
          SELECT created_at FROM investments WHERE investor_id = ${userId}
        ) activity
        ${where}
      ) as active_days
  `;
  
  const analytics = extractFirst<UserAnalytics>(result);
  
  if (!analytics) {
    return {
      user_id: userId,
      total_pitches: 0,
      total_views: 0,
      total_investments: 0,
      avg_engagement: 0,
      growth_rate: 0,
      active_days: 0
    };
  }
  
  return analytics;
}

export async function getUserEngagementHistory(
  sql: SqlQuery,
  userId: string,
  days: number = 30
): Promise<Array<{
  date: string;
  pitches_created: number;
  pitches_viewed: number;
  messages_sent: number;
  investments_made: number;
}>> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const result = await sql`
    WITH date_series AS (
      SELECT generate_series(
        ${startDate}::date,
        CURRENT_DATE,
        '1 day'::interval
      )::date AS date
    ),
    daily_activity AS (
      SELECT 
        DATE(created_at) as activity_date,
        COUNT(CASE WHEN creator_id = ${userId} THEN 1 END) as pitches_created,
        0 as pitches_viewed,
        0 as messages_sent,
        0 as investments_made
      FROM pitches
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      
      UNION ALL

      SELECT
        DATE(viewed_at) as activity_date,
        0 as pitches_created,
        COUNT(*) as pitches_viewed,
        0 as messages_sent,
        0 as investments_made
      FROM pitch_views
      WHERE user_id = ${userId} AND viewed_at >= ${startDate}
      GROUP BY DATE(viewed_at)
      
      UNION ALL
      
      SELECT 
        DATE(sent_at) as activity_date,
        0 as pitches_created,
        0 as pitches_viewed,
        COUNT(*) as messages_sent,
        0 as investments_made
      FROM messages
      WHERE sender_id = ${userId} AND sent_at >= ${startDate}
      GROUP BY DATE(sent_at)
      
      UNION ALL
      
      SELECT 
        DATE(created_at) as activity_date,
        0 as pitches_created,
        0 as pitches_viewed,
        0 as messages_sent,
        COUNT(*) as investments_made
      FROM investments
      WHERE investor_id = ${userId} AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
    )
    SELECT 
      ds.date::text,
      COALESCE(SUM(da.pitches_created), 0)::int as pitches_created,
      COALESCE(SUM(da.pitches_viewed), 0)::int as pitches_viewed,
      COALESCE(SUM(da.messages_sent), 0)::int as messages_sent,
      COALESCE(SUM(da.investments_made), 0)::int as investments_made
    FROM date_series ds
    LEFT JOIN daily_activity da ON ds.date = da.activity_date
    GROUP BY ds.date
    ORDER BY ds.date ASC
  `;
  
  return extractMany<any>(result);
}

// Platform metrics
export async function getPlatformMetrics(
  sql: SqlQuery,
  startDate?: Date,
  endDate?: Date
): Promise<PlatformMetrics> {
  const wb = new WhereBuilder();
  wb.addOptional('created_at', '>=', startDate);
  wb.addOptional('created_at', '<=', endDate);
  
  const { where, params } = wb.build();
  
  const result = await sql`
    SELECT 
      (SELECT COUNT(*) FROM users)::int as total_users,
      (
        SELECT COUNT(DISTINCT user_id) FROM (
          SELECT creator_id as user_id FROM pitches ${where}
          UNION
          SELECT sender_id as user_id FROM messages 
            WHERE sent_at >= ${startDate || '1970-01-01'} 
              AND sent_at <= ${endDate || 'NOW()'}
          UNION
          SELECT investor_id as user_id FROM investments ${where}
        ) active
      )::int as active_users,
      (SELECT COUNT(*) FROM pitches)::int as total_pitches,
      (SELECT COUNT(*) FROM investments WHERE status IN ('committed', 'funded'))::int as total_investments,
      (SELECT COALESCE(SUM(amount), 0) FROM investments WHERE status = 'funded') as total_revenue,
      (
        SELECT COUNT(*)::float / NULLIF(COUNT(DISTINCT pv.viewer_id), 0) * 100
        FROM investments i
        JOIN pitch_views pv ON i.pitch_id = pv.pitch_id
        WHERE i.status IN ('committed', 'funded')
      ) as conversion_rate,
      0 as churn_rate, -- Calculate based on subscription data
      0 as growth_rate -- Calculate based on time period comparison
  `;
  
  const metrics = extractFirst<PlatformMetrics>(result);
  
  if (!metrics) {
    return {
      total_users: 0,
      active_users: 0,
      total_pitches: 0,
      total_investments: 0,
      total_revenue: 0,
      conversion_rate: 0,
      churn_rate: 0,
      growth_rate: 0
    };
  }
  
  return metrics;
}

export async function getDashboardMetrics(
  sql: SqlQuery,
  userId: string,
  userType: 'creator' | 'investor' | 'production'
): Promise<Record<string, any>> {
  if (userType === 'creator') {
    const result = await sql`
      SELECT 
        (SELECT COUNT(*) FROM pitches WHERE creator_id = ${userId})::int as total_pitches,
        (SELECT SUM(view_count) FROM pitches WHERE creator_id = ${userId})::int as total_views,
        (SELECT COUNT(*) FROM follows WHERE following_id = ${userId})::int as total_followers,
        (
          SELECT COUNT(*) FROM investments i
          JOIN pitches p ON i.pitch_id = p.id
          WHERE p.creator_id = ${userId}
            AND i.status IN ('committed', 'funded')
        )::int as total_investors,
        (
          SELECT COALESCE(SUM(i.amount), 0)
          FROM investments i
          JOIN pitches p ON i.pitch_id = p.id
          WHERE p.creator_id = ${userId}
            AND i.status = 'funded'
        ) as total_funding,
        (
          SELECT COUNT(*) FROM nda_requests nr
          JOIN pitches p ON nr.pitch_id = p.id
          WHERE p.creator_id = ${userId}
            AND nr.status = 'pending'
        )::int as pending_ndas
    `;
    return extractFirst<any>(result) || {};
  } else if (userType === 'investor') {
    const result = await sql`
      SELECT 
        (SELECT COUNT(*) FROM investments WHERE investor_id = ${userId})::int as total_investments,
        (
          SELECT COALESCE(SUM(amount), 0) 
          FROM investments 
          WHERE investor_id = ${userId}
            AND status = 'funded'
        ) as total_invested,
        (
          SELECT COUNT(*) FROM investments 
          WHERE investor_id = ${userId}
            AND status IN ('committed', 'funded')
        )::int as active_investments,
        (SELECT COUNT(*) FROM saved_pitches WHERE user_id = ${userId})::int as saved_pitches,
        (
          SELECT COUNT(*) FROM nda_requests 
          WHERE requester_id = ${userId}
            AND status = 'approved'
        )::int as signed_ndas,
        (SELECT COUNT(*) FROM follows WHERE follower_id = ${userId})::int as following_count
    `;
    return extractFirst<any>(result) || {};
  } else if (userType === 'production') {
    const result = await sql`
      SELECT 
        (
          SELECT COUNT(*) FROM pitches p
          JOIN production_interested pi ON pi.pitch_id = p.id
          WHERE pi.production_company_id = ${userId}
        )::int as interested_projects,
        (
          SELECT COUNT(*) FROM pitches p
          WHERE p.production_status = 'in_development'
            AND EXISTS (
              SELECT 1 FROM production_deals pd
              WHERE pd.pitch_id = p.id AND pd.production_company_id = ${userId}
            )
        )::int as projects_in_development,
        (
          SELECT COUNT(*) FROM pitches p
          WHERE p.production_status = 'in_production'
            AND EXISTS (
              SELECT 1 FROM production_deals pd
              WHERE pd.pitch_id = p.id AND pd.production_company_id = ${userId}
            )
        )::int as projects_in_production,
        (
          SELECT COALESCE(SUM(budget_amount), 0)
          FROM production_deals
          WHERE production_company_id = ${userId}
        ) as total_budget,
        (SELECT COUNT(*) FROM messages WHERE sender_id = ${userId})::int as messages_sent,
        (SELECT COUNT(*) FROM follows WHERE follower_id = ${userId})::int as following_count
    `;
    return extractFirst<any>(result) || {};
  }
  
  return {};
}

// Revenue analytics
export async function getRevenueAnalytics(
  sql: SqlQuery,
  startDate: Date,
  endDate: Date,
  groupBy: 'day' | 'week' | 'month' = 'month'
): Promise<Array<{
  period: string;
  subscription_revenue: number;
  investment_fees: number;
  total_revenue: number;
  new_subscribers: number;
  churned_subscribers: number;
}>> {
  const dateFormat = {
    'day': 'YYYY-MM-DD',
    'week': 'YYYY-WW',
    'month': 'YYYY-MM'
  }[groupBy];

  const result = await sql`
    SELECT 
      TO_CHAR(created_at, ${dateFormat}) as period,
      0 as subscription_revenue, -- Implement based on payment data
      0 as investment_fees, -- Implement based on fee structure
      0 as total_revenue,
      COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as new_subscribers,
      COUNT(CASE WHEN subscription_status = 'cancelled' THEN 1 END) as churned_subscribers
    FROM users
    WHERE created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY period
    ORDER BY period ASC
  `;
  
  return extractMany<any>(result);
}

// Search analytics
export async function trackSearchQuery(
  sql: SqlQuery,
  query: string,
  userId?: string,
  resultCount: number = 0,
  metadata?: Record<string, any>
): Promise<void> {
  await sql`
    INSERT INTO search_queries (
      query_text, user_id, result_count,
      metadata, created_at
    ) VALUES (
      ${query}, ${userId || null}, ${resultCount},
      ${metadata || null}::jsonb, NOW()
    )
  `;
}

export async function getPopularSearches(
  sql: SqlQuery,
  limit: number = 20,
  days: number = 7
): Promise<Array<{
  query: string;
  search_count: number;
  avg_results: number;
  click_through_rate: number;
}>> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const result = await sql`
    SELECT 
      query_text as query,
      COUNT(*) as search_count,
      AVG(result_count) as avg_results,
      0 as click_through_rate -- Implement click tracking
    FROM search_queries
    WHERE created_at >= ${startDate}
    GROUP BY query_text
    ORDER BY search_count DESC
    LIMIT ${limit}
  `;
  
  return extractMany<any>(result);
}

// Performance metrics
export async function getPerformanceMetrics(
  sql: SqlQuery
): Promise<{
  avg_response_time: number;
  error_rate: number;
  cache_hit_rate: number;
  active_connections: number;
}> {
  // This would typically integrate with APM tools
  // Placeholder implementation
  return {
    avg_response_time: 0,
    error_rate: 0,
    cache_hit_rate: 0,
    active_connections: 0
  };
}