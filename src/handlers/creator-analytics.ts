// Phase 2: Creator Analytics Handlers
// Comprehensive analytics and performance tracking for creators

export class CreatorAnalyticsHandler {
  constructor(private db: any) {}

  // Get analytics overview
  async getAnalyticsOverview(userId: number) {
    try {
      // Get current period analytics (last 30 days)
      const currentAnalytics = await this.db.query(
        `SELECT * FROM creator_analytics 
         WHERE creator_id = $1 
           AND period_end = CURRENT_DATE
         ORDER BY period_end DESC 
         LIMIT 1`,
        [userId]
      );

      // If no current analytics, calculate them
      if (currentAnalytics.length === 0) {
        await this.calculateCurrentAnalytics(userId);
        const updated = await this.db.query(
          `SELECT * FROM creator_analytics 
           WHERE creator_id = $1 
             AND period_end = CURRENT_DATE
           ORDER BY period_end DESC 
           LIMIT 1`,
          [userId]
        );
        currentAnalytics.push(...updated);
      }

      // Get historical trend (last 6 months)
      const historicalTrend = await this.db.query(
        `SELECT 
          DATE_TRUNC('month', period_end) as month,
          SUM(total_views) as views,
          SUM(total_likes) as likes,
          SUM(nda_requests) as ndas,
          AVG(engagement_rate) as engagement
         FROM creator_analytics
         WHERE creator_id = $1 
           AND period_end >= CURRENT_DATE - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', period_end)
         ORDER BY month DESC`,
        [userId]
      );

      // Get top performing pitches
      const topPitches = await this.db.query(
        `SELECT
          p.id, p.title, p.genre,
          SUM(pa.views) as views,
          SUM(pa.likes) as likes,
          SUM(pa.nda_requests) as ndas
         FROM pitches p
         JOIN pitch_analytics pa ON pa.pitch_id = p.id
         WHERE p.user_id = $1 AND p.status = 'published'
         GROUP BY p.id, p.title, p.genre
         ORDER BY views DESC
         LIMIT 5`,
        [userId]
      );

      // Get audience breakdown from pitch_engagement
      let audienceBreakdown: { userType: string; count: number; percentage: number }[] = [];
      try {
        const viewerTypes = await this.db.query(
          `SELECT pe.viewer_type AS "userType", COUNT(*)::int AS count
           FROM pitch_engagement pe
           JOIN pitches p ON p.id = pe.pitch_id
           WHERE p.user_id = $1
           GROUP BY pe.viewer_type`,
          [userId]
        );
        const total = viewerTypes.reduce((sum: number, row: any) => sum + Number(row.count), 0);
        audienceBreakdown = viewerTypes.map((row: any) => ({
          userType: row.userType,
          count: Number(row.count),
          percentage: total > 0 ? Math.round((Number(row.count) / total) * 100) : 0,
        }));
      } catch {
        // pitch_engagement table may not exist or be empty
      }

      // Get engagement breakdown by genre
      let engagementByGenre: { genre: string; views: number; likes: number; ndas: number }[] = [];
      try {
        engagementByGenre = await this.db.query(
          `SELECT
            COALESCE(p.genre, 'Other') as genre,
            COALESCE(SUM(p.view_count), 0)::int as views,
            COALESCE(SUM(p.like_count), 0)::int as likes,
            COALESCE(COUNT(DISTINCT nr.id), 0)::int as ndas
           FROM pitches p
           LEFT JOIN nda_requests nr ON nr.pitch_id = p.id
           WHERE p.user_id = $1 AND p.status = 'published'
           GROUP BY p.genre
           ORDER BY views DESC`,
          [userId]
        );
      } catch {
        // Keep empty if query fails
      }

      return {
        success: true,
        data: {
          current: currentAnalytics[0] || this.getEmptyAnalytics(),
          trend: historicalTrend,
          topPitches,
          audienceBreakdown,
          engagementByGenre
        }
      };
    } catch (error) {
      console.error('Analytics overview error:', error);
      return { success: false, error: 'Failed to fetch analytics overview' };
    }
  }

  // Get pitch-specific analytics
  async getPitchAnalytics(userId: number) {
    try {
      const pitchAnalytics = await this.db.query(
        `SELECT 
          p.id, p.title, p.genre, p.status,
          p.created_at, p.updated_at,
          COALESCE(SUM(pa.views), 0) as total_views,
          COALESCE(SUM(pa.unique_views), 0) as unique_views,
          COALESCE(SUM(pa.likes), 0) as total_likes,
          COALESCE(SUM(pa.saves), 0) as total_saves,
          COALESCE(SUM(pa.nda_requests), 0) as nda_requests,
          COALESCE(AVG(pa.avg_view_duration), 0) as avg_duration,
          COUNT(DISTINCT pa.date) as days_active
         FROM pitches p
         LEFT JOIN pitch_analytics pa ON pa.pitch_id = p.id
         WHERE p.user_id = $1
         GROUP BY p.id, p.title, p.genre, p.status, p.created_at, p.updated_at
         ORDER BY total_views DESC`,
        [userId]
      );

      // Calculate performance metrics for each pitch
      const enhancedAnalytics = pitchAnalytics.map((pitch: any) => ({
        ...pitch,
        engagement_rate: pitch.total_views > 0 
          ? ((pitch.total_likes + pitch.total_saves) / pitch.total_views * 100).toFixed(2)
          : 0,
        conversion_rate: pitch.total_views > 0
          ? (pitch.nda_requests / pitch.total_views * 100).toFixed(2)
          : 0,
        days_since_created: Math.floor(
          (Date.now() - new Date(pitch.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )
      }));

      return {
        success: true,
        data: { pitches: enhancedAnalytics }
      };
    } catch (error) {
      console.error('Pitch analytics error:', error);
      return { success: false, error: 'Failed to fetch pitch analytics' };
    }
  }

  // Get engagement metrics
  async getEngagementMetrics(userId: number) {
    try {
      // Overall engagement stats
      const overallStats = await this.db.query(
        `SELECT 
          COUNT(DISTINCT pe.viewer_id) as unique_viewers,
          COUNT(*) as total_views,
          AVG(pe.view_duration) as avg_duration,
          AVG(pe.engagement_score) as avg_engagement_score,
          SUM(CASE WHEN (pe.actions_taken->>'liked')::boolean THEN 1 ELSE 0 END) as total_likes,
          SUM(CASE WHEN (pe.actions_taken->>'saved')::boolean THEN 1 ELSE 0 END) as total_saves,
          SUM(CASE WHEN (pe.actions_taken->>'nda_requested')::boolean THEN 1 ELSE 0 END) as nda_requests
         FROM pitch_engagement pe
         JOIN pitches p ON p.id = pe.pitch_id
         WHERE p.user_id = $1`,
        [userId]
      );

      // Viewer type distribution
      const viewerTypes = await this.db.query(
        `SELECT 
          viewer_type,
          COUNT(*) as count,
          AVG(view_duration) as avg_duration,
          AVG(engagement_score) as avg_engagement
         FROM pitch_engagement pe
         JOIN pitches p ON p.id = pe.pitch_id
         WHERE p.user_id = $1
         GROUP BY viewer_type`,
        [userId]
      );

      // Time-based engagement (hourly distribution)
      const hourlyEngagement = await this.db.query(
        `SELECT 
          EXTRACT(HOUR FROM viewed_at) as hour,
          COUNT(*) as views,
          AVG(view_duration) as avg_duration
         FROM pitch_engagement pe
         JOIN pitches p ON p.id = pe.pitch_id
         WHERE p.user_id = $1 AND viewed_at >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY EXTRACT(HOUR FROM viewed_at)
         ORDER BY hour`,
        [userId]
      );

      // Device type distribution
      const deviceTypes = await this.db.query(
        `SELECT 
          device_type,
          COUNT(*) as count,
          AVG(view_duration) as avg_duration
         FROM pitch_engagement pe
         JOIN pitches p ON p.id = pe.pitch_id
         WHERE p.user_id = $1
         GROUP BY device_type`,
        [userId]
      );

      return {
        success: true,
        data: {
          overall: overallStats[0] || {},
          viewerTypes,
          hourlyEngagement,
          deviceTypes
        }
      };
    } catch (error) {
      console.error('Engagement metrics error:', error);
      return { success: false, error: 'Failed to fetch engagement metrics' };
    }
  }

  // Get investor interest data
  async getInvestorInterest(userId: number) {
    try {
      // Get investors showing interest
      const interestedInvestors = await this.db.query(
        `SELECT 
          ii.*,
          u.name as investor_name,
          u.email as investor_email,
          u.company_name,
          p.title as pitch_title,
          p.genre
         FROM investor_interest ii
         JOIN users u ON u.id = ii.investor_id
         JOIN pitches p ON p.id = ii.pitch_id
         WHERE p.user_id = $1
         ORDER BY ii.interest_level DESC, ii.last_viewed DESC`,
        [userId]
      );

      // Group by interest level
      const byInterestLevel = await this.db.query(
        `SELECT 
          ii.interest_level,
          COUNT(DISTINCT ii.investor_id) as investor_count,
          SUM(ii.potential_investment) as total_potential,
          AVG(ii.time_spent) as avg_time_spent
         FROM investor_interest ii
         JOIN pitches p ON p.id = ii.pitch_id
         WHERE p.user_id = $1
         GROUP BY ii.interest_level
         ORDER BY 
          CASE ii.interest_level
            WHEN 'very_high' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END`,
        [userId]
      );

      // Top interested investors
      const topInvestors = await this.db.query(
        `SELECT 
          u.id, u.name, u.email, u.company_name,
          COUNT(DISTINCT ii.pitch_id) as pitches_viewed,
          SUM(ii.time_spent) as total_time_spent,
          MAX(ii.potential_investment) as max_potential_investment,
          STRING_AGG(DISTINCT ii.interest_level, ', ') as interest_levels
         FROM investor_interest ii
         JOIN users u ON u.id = ii.investor_id
         JOIN pitches p ON p.id = ii.pitch_id
         WHERE p.user_id = $1
         GROUP BY u.id, u.name, u.email, u.company_name
         ORDER BY total_time_spent DESC
         LIMIT 10`,
        [userId]
      );

      return {
        success: true,
        data: {
          investors: interestedInvestors,
          byLevel: byInterestLevel,
          topInvestors
        }
      };
    } catch (error) {
      console.error('Investor interest error:', error);
      return { success: false, error: 'Failed to fetch investor interest' };
    }
  }

  // Get revenue analytics
  async getRevenueAnalytics(userId: number) {
    try {
      // Total revenue by type
      const revenueByType = await this.db.query(
        `SELECT 
          revenue_type,
          COUNT(*) as transaction_count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
         FROM creator_revenue
         WHERE creator_id = $1 AND status = 'confirmed'
         GROUP BY revenue_type`,
        [userId]
      );

      // Revenue over time
      const revenueTimeline = await this.db.query(
        `SELECT 
          DATE_TRUNC('month', transaction_date) as month,
          SUM(amount) as total,
          COUNT(*) as transactions
         FROM creator_revenue
         WHERE creator_id = $1 AND status = 'confirmed'
         GROUP BY DATE_TRUNC('month', transaction_date)
         ORDER BY month DESC
         LIMIT 12`,
        [userId]
      );

      // Revenue by pitch
      const revenueByPitch = await this.db.query(
        `SELECT 
          p.id, p.title, p.genre,
          SUM(cr.amount) as total_revenue,
          COUNT(cr.id) as transaction_count,
          STRING_AGG(DISTINCT cr.revenue_type, ', ') as revenue_types
         FROM creator_revenue cr
         JOIN pitches p ON p.id = cr.pitch_id
         WHERE cr.creator_id = $1 AND cr.status = 'confirmed'
         GROUP BY p.id, p.title, p.genre
         ORDER BY total_revenue DESC`,
        [userId]
      );

      // Pending revenue
      const pendingRevenue = await this.db.query(
        `SELECT 
          SUM(amount) as total_pending,
          COUNT(*) as pending_transactions
         FROM creator_revenue
         WHERE creator_id = $1 AND status = 'pending'`,
        [userId]
      );

      return {
        success: true,
        data: {
          byType: revenueByType,
          timeline: revenueTimeline,
          byPitch: revenueByPitch,
          pending: pendingRevenue[0] || { total_pending: 0, pending_transactions: 0 }
        }
      };
    } catch (error) {
      console.error('Revenue analytics error:', error);
      return { success: false, error: 'Failed to fetch revenue analytics' };
    }
  }

  // Get analytics for specific pitch
  async getPitchDetailedAnalytics(userId: number, pitchId: number) {
    try {
      // Verify ownership
      const ownership = await this.db.query(
        `SELECT id FROM pitches WHERE id = $1 AND user_id = $2`,
        [pitchId, userId]
      );

      if (ownership.length === 0) {
        return { success: false, error: 'Pitch not found or unauthorized' };
      }

      // Daily analytics for last 30 days
      const dailyAnalytics = await this.db.query(
        `SELECT * FROM pitch_analytics 
         WHERE pitch_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
         ORDER BY date DESC`,
        [pitchId]
      );

      // Viewer engagement details
      const engagement = await this.db.query(
        `SELECT 
          viewer_type,
          COUNT(*) as viewers,
          AVG(view_duration) as avg_duration,
          AVG(engagement_score) as avg_score,
          SUM(CASE WHEN (actions_taken->>'liked')::boolean THEN 1 ELSE 0 END) as likes,
          SUM(CASE WHEN (actions_taken->>'saved')::boolean THEN 1 ELSE 0 END) as saves
         FROM pitch_engagement
         WHERE pitch_id = $1
         GROUP BY viewer_type`,
        [pitchId]
      );

      // Section popularity
      const sectionViews = await this.db.query(
        `SELECT 
          jsonb_object_keys(sections_viewed) as section,
          COUNT(*) as view_count
         FROM pitch_engagement
         WHERE pitch_id = $1 AND sections_viewed IS NOT NULL
         GROUP BY jsonb_object_keys(sections_viewed)
         ORDER BY view_count DESC`,
        [pitchId]
      );

      return {
        success: true,
        data: {
          daily: dailyAnalytics,
          engagement,
          sections: sectionViews
        }
      };
    } catch (error) {
      console.error('Pitch detailed analytics error:', error);
      return { success: false, error: 'Failed to fetch pitch analytics' };
    }
  }

  // Get viewer details for a pitch
  async getPitchViewers(userId: number, pitchId: number) {
    try {
      // Verify ownership
      const ownership = await this.db.query(
        `SELECT id FROM pitches WHERE id = $1 AND user_id = $2`,
        [pitchId, userId]
      );

      if (ownership.length === 0) {
        return { success: false, error: 'Pitch not found or unauthorized' };
      }

      const viewers = await this.db.query(
        `SELECT 
          pe.*,
          u.name as viewer_name,
          u.email as viewer_email,
          u.user_type,
          u.company_name
         FROM pitch_engagement pe
         LEFT JOIN users u ON u.id = pe.viewer_id
         WHERE pe.pitch_id = $1
         ORDER BY pe.viewed_at DESC`,
        [pitchId]
      );

      return {
        success: true,
        data: { viewers }
      };
    } catch (error) {
      console.error('Pitch viewers error:', error);
      return { success: false, error: 'Failed to fetch pitch viewers' };
    }
  }

  // Get engagement data for a pitch
  async getPitchEngagement(userId: number, pitchId: number) {
    try {
      // Verify ownership
      const ownership = await this.db.query(
        `SELECT id FROM pitches WHERE id = $1 AND user_id = $2`,
        [pitchId, userId]
      );

      if (ownership.length === 0) {
        return { success: false, error: 'Pitch not found or unauthorized' };
      }

      // Engagement over time
      const engagementTimeline = await this.db.query(
        `SELECT 
          DATE(viewed_at) as date,
          COUNT(*) as views,
          COUNT(DISTINCT viewer_id) as unique_viewers,
          AVG(view_duration) as avg_duration,
          AVG(engagement_score) as avg_score
         FROM pitch_engagement
         WHERE pitch_id = $1
         GROUP BY DATE(viewed_at)
         ORDER BY date DESC
         LIMIT 30`,
        [pitchId]
      );

      // Action conversion funnel
      const conversionFunnel = await this.db.query(
        `SELECT 
          COUNT(*) as total_views,
          SUM(CASE WHEN view_duration > 30 THEN 1 ELSE 0 END) as engaged_views,
          SUM(CASE WHEN (actions_taken->>'liked')::boolean THEN 1 ELSE 0 END) as likes,
          SUM(CASE WHEN (actions_taken->>'saved')::boolean THEN 1 ELSE 0 END) as saves,
          SUM(CASE WHEN (actions_taken->>'nda_requested')::boolean THEN 1 ELSE 0 END) as nda_requests
         FROM pitch_engagement
         WHERE pitch_id = $1`,
        [pitchId]
      );

      return {
        success: true,
        data: {
          timeline: engagementTimeline,
          funnel: conversionFunnel[0] || {}
        }
      };
    } catch (error) {
      console.error('Pitch engagement error:', error);
      return { success: false, error: 'Failed to fetch pitch engagement' };
    }
  }

  // Get feedback for a pitch
  async getPitchFeedback(userId: number, pitchId: number) {
    try {
      // Verify ownership
      const ownership = await this.db.query(
        `SELECT id FROM pitches WHERE id = $1 AND user_id = $2`,
        [pitchId, userId]
      );

      if (ownership.length === 0) {
        return { success: false, error: 'Pitch not found or unauthorized' };
      }

      const feedback = await this.db.query(
        `SELECT 
          pf.*,
          CASE 
            WHEN pf.is_anonymous THEN 'Anonymous'
            ELSE u.name
          END as reviewer_name,
          CASE 
            WHEN pf.is_anonymous THEN NULL
            ELSE u.company_name
          END as reviewer_company
         FROM pitch_feedback pf
         LEFT JOIN users u ON u.id = pf.reviewer_id
         WHERE pf.pitch_id = $1
         ORDER BY pf.created_at DESC`,
        [pitchId]
      );

      // Aggregate ratings
      const ratings = await this.db.query(
        `SELECT 
          AVG(rating) as avg_rating,
          COUNT(*) as total_reviews,
          COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
          COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
          COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
          COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
          COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
         FROM pitch_feedback
         WHERE pitch_id = $1`,
        [pitchId]
      );

      return {
        success: true,
        data: {
          feedback,
          ratings: ratings[0] || {}
        }
      };
    } catch (error) {
      console.error('Pitch feedback error:', error);
      return { success: false, error: 'Failed to fetch pitch feedback' };
    }
  }

  // Get pitch comparisons
  async getPitchComparisons(userId: number, pitchId: number) {
    try {
      // Verify ownership
      const ownership = await this.db.query(
        `SELECT genre FROM pitches WHERE id = $1 AND user_id = $2`,
        [pitchId, userId]
      );

      if (ownership.length === 0) {
        return { success: false, error: 'Pitch not found or unauthorized' };
      }

      const genre = ownership[0].genre;

      // Get latest comparison data
      const comparison = await this.db.query(
        `SELECT * FROM pitch_comparisons 
         WHERE pitch_id = $1 
         ORDER BY comparison_date DESC 
         LIMIT 1`,
        [pitchId]
      );

      // If no comparison exists, calculate it
      if (comparison.length === 0) {
        // Calculate genre averages
        const genreStats = await this.db.query(
          `SELECT 
            AVG(pa.views) as avg_views,
            AVG(pa.likes) as avg_likes,
            AVG(pa.nda_requests) as avg_ndas
           FROM pitch_analytics pa
           JOIN pitches p ON p.id = pa.pitch_id
           WHERE p.genre = $1 AND pa.date >= CURRENT_DATE - INTERVAL '30 days'`,
          [genre]
        );

        // Calculate pitch performance
        const pitchStats = await this.db.query(
          `SELECT 
            SUM(views) as total_views,
            SUM(likes) as total_likes,
            SUM(nda_requests) as total_ndas
           FROM pitch_analytics
           WHERE pitch_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'`,
          [pitchId]
        );

        return {
          success: true,
          data: {
            pitch: pitchStats[0] || {},
            genreAverage: genreStats[0] || {},
            comparison: comparison[0] || null
          }
        };
      }

      return {
        success: true,
        data: { comparison: comparison[0] }
      };
    } catch (error) {
      console.error('Pitch comparisons error:', error);
      return { success: false, error: 'Failed to fetch pitch comparisons' };
    }
  }

  // Helper: Calculate current analytics
  private async calculateCurrentAnalytics(userId: number) {
    try {
      await this.db.query(
        `INSERT INTO creator_analytics (
          creator_id, period_start, period_end,
          total_pitches, published_pitches, draft_pitches,
          total_views, unique_viewers, total_likes, total_saves,
          nda_requests, nda_signed, engagement_rate
        )
        SELECT 
          $1,
          CURRENT_DATE - INTERVAL '30 days',
          CURRENT_DATE,
          COUNT(DISTINCT p.id),
          COUNT(DISTINCT CASE WHEN p.status = 'published' THEN p.id END),
          COUNT(DISTINCT CASE WHEN p.status = 'draft' THEN p.id END),
          COALESCE(SUM(pa.views), 0),
          COALESCE(SUM(pa.unique_views), 0),
          COALESCE(SUM(pa.likes), 0),
          COALESCE(SUM(pa.saves), 0),
          COALESCE(SUM(pa.nda_requests), 0),
          0, -- TODO: Calculate signed NDAs
          CASE 
            WHEN SUM(pa.views) > 0 
            THEN (SUM(pa.likes) + SUM(pa.saves))::FLOAT / SUM(pa.views) * 100
            ELSE 0
          END
        FROM pitches p
        LEFT JOIN pitch_analytics pa ON pa.pitch_id = p.id
          AND pa.date >= CURRENT_DATE - INTERVAL '30 days'
        WHERE p.user_id = $1
        ON CONFLICT (creator_id, period_start, period_end) DO NOTHING`,
        [userId]
      );
    } catch (error) {
      console.error('Calculate analytics error:', error);
    }
  }

  // Helper: Get empty analytics object
  private getEmptyAnalytics() {
    return {
      total_pitches: 0,
      published_pitches: 0,
      draft_pitches: 0,
      total_views: 0,
      unique_viewers: 0,
      total_likes: 0,
      total_saves: 0,
      nda_requests: 0,
      nda_signed: 0,
      engagement_rate: 0
    };
  }
}