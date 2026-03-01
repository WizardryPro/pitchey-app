/**
 * Production Portal Sidebar Handlers
 * Real database query handlers replacing stub endpoints for the Production portal sidebar.
 *
 * Tables used:
 *   - production_pipeline (may not exist -- guarded with try/catch)
 *   - investments
 *   - notifications
 *   - pitches
 *   - saved_pitches
 *   - users
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}

// ---------------------------------------------------------------------------
// 1. Production Stats
// ---------------------------------------------------------------------------

/**
 * GET /api/production/stats
 *
 * Aggregates project counts, submission counts, revenue totals, and team size
 * from production_pipeline and investments tables.
 */
export async function productionStatsHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const defaultData = {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalSubmissions: 0,
    pendingSubmissions: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    teamMembers: 0,
  };

  const userId = await getUserId(request, env);
  if (!userId) {
    return jsonResponse({ success: true, data: defaultData }, origin);
  }

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: true, data: defaultData }, origin);
  }

  try {
    // Check if production_pipeline table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'production_pipeline'
      ) AS exists
    `.catch(() => [{ exists: false }]);

    let totalProjects = 0;
    let activeProjects = 0;
    let completedProjects = 0;
    let totalBudgetAllocated = 0;

    if (tableCheck[0]?.exists) {
      const projectStats = await sql`
        SELECT
          COUNT(*)::int AS total_projects,
          COUNT(*) FILTER (WHERE status = 'active')::int AS active_projects,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_projects,
          COALESCE(SUM(budget_allocated), 0) AS total_budget_allocated
        FROM production_pipeline
        WHERE production_company_id::text = ${String(userId)}
      `.catch(() => []);

      if (projectStats.length > 0) {
        totalProjects = Number(projectStats[0].total_projects) || 0;
        activeProjects = Number(projectStats[0].active_projects) || 0;
        completedProjects = Number(projectStats[0].completed_projects) || 0;
        totalBudgetAllocated = Number(projectStats[0].total_budget_allocated) || 0;
      }
    }

    // Revenue from investments linked to this production company's pipeline projects
    let totalRevenue = 0;
    let monthlyRevenue = 0;

    if (tableCheck[0]?.exists) {
      const revenueStats = await sql`
        SELECT
          COALESCE(SUM(i.amount), 0) AS total_revenue,
          COALESCE(SUM(
            CASE WHEN i.created_at >= DATE_TRUNC('month', NOW()) THEN i.amount ELSE 0 END
          ), 0) AS monthly_revenue
        FROM investments i
        JOIN production_pipeline pp ON i.pitch_id = pp.pitch_id
        WHERE pp.production_company_id::text = ${String(userId)}
          AND i.status IN ('active', 'funded', 'committed', 'completed')
      `.catch(() => []);

      if (revenueStats.length > 0) {
        totalRevenue = Number(revenueStats[0].total_revenue) || 0;
        monthlyRevenue = Number(revenueStats[0].monthly_revenue) || 0;
      }
    }

    // Count published pitches as "submissions" visible to this production user
    const submissionStats = await sql`
      SELECT
        COUNT(*)::int AS total_submissions,
        COUNT(*) FILTER (WHERE status = 'pending' OR status = 'submitted')::int AS pending_submissions
      FROM pitches
      WHERE status IN ('published', 'pending', 'submitted')
    `.catch(() => [{ total_submissions: 0, pending_submissions: 0 }]);

    const totalSubmissions = Number(submissionStats[0]?.total_submissions) || 0;
    const pendingSubmissions = Number(submissionStats[0]?.pending_submissions) || 0;

    return jsonResponse({
      success: true,
      data: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalSubmissions,
        pendingSubmissions,
        totalRevenue,
        monthlyRevenue,
        teamMembers: 0, // No team_members table currently
      },
    }, origin);
  } catch (error) {
    console.error('productionStatsHandler error:', error);
    return jsonResponse({ success: true, data: defaultData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 2. Production Activity
// ---------------------------------------------------------------------------

/**
 * GET /api/production/activity
 *
 * Returns paginated recent activity (notifications) for the authenticated user.
 */
export async function productionActivityHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const defaultData = {
    activities: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  };

  const userId = await getUserId(request, env);
  if (!userId) {
    return jsonResponse({ success: true, data: defaultData }, origin);
  }

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: true, data: defaultData }, origin);
  }

  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const [activities, countResult] = await Promise.all([
      sql`
        SELECT
          id,
          type,
          title,
          message,
          data,
          related_id,
          related_type,
          action_url,
          is_read,
          priority,
          created_at
        FROM notifications
        WHERE user_id = ${Number(userId)}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `.catch(() => []),
      sql`
        SELECT COUNT(*)::int AS total
        FROM notifications
        WHERE user_id = ${Number(userId)}
      `.catch(() => [{ total: 0 }]),
    ]);

    const total = Number(countResult[0]?.total) || 0;
    const totalPages = Math.ceil(total / limit) || 0;

    return jsonResponse({
      success: true,
      data: {
        activities,
        pagination: { page, limit, total, totalPages },
      },
    }, origin);
  } catch (error) {
    console.error('productionActivityHandler error:', error);
    return jsonResponse({ success: true, data: defaultData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 3. Production Submissions
// ---------------------------------------------------------------------------

/**
 * GET /api/production/submissions
 *
 * Returns published pitches that are available for this production company to
 * review. Supports an optional ?status= query parameter to filter.
 */
export async function productionSubmissionsHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status') || 'new';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const defaultData = {
    submissions: [],
    filter: statusFilter,
    pagination: { page, limit, total: 0, totalPages: 0 },
  };

  const userId = await getUserId(request, env);
  if (!userId) {
    return jsonResponse({ success: true, data: defaultData }, origin);
  }

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: true, data: defaultData }, origin);
  }

  try {
    // "new" = published pitches not yet saved/reviewed by this production user
    // Other statuses = saved_pitches entries with matching review_status
    if (statusFilter === 'new') {
      const [submissions, countResult] = await Promise.all([
        sql`
          SELECT
            p.id, p.title, p.genre, p.logline, p.short_synopsis, p.format,
            p.estimated_budget, p.budget_range, p.status, p.view_count,
            p.like_count, p.created_at, p.updated_at,
            COALESCE(u.name, u.first_name || ' ' || u.last_name, u.email) AS creator,
            u.email AS creator_email,
            'new' AS review_status
          FROM pitches p
          JOIN users u ON p.user_id = u.id
          LEFT JOIN saved_pitches sp ON sp.pitch_id = p.id AND sp.user_id = ${userId}
          WHERE p.status = 'published' AND sp.id IS NULL
          ORDER BY p.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `.catch(() => []),
        sql`
          SELECT COUNT(*)::int AS total
          FROM pitches p
          LEFT JOIN saved_pitches sp ON sp.pitch_id = p.id AND sp.user_id = ${userId}
          WHERE p.status = 'published' AND sp.id IS NULL
        `.catch(() => [{ total: 0 }]),
      ]);

      const total = Number(countResult[0]?.total) || 0;
      return jsonResponse({
        success: true,
        data: { submissions, filter: statusFilter, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } },
      }, origin);
    }

    // For review, shortlisted, accepted, rejected, archived — query saved_pitches
    const [submissions, countResult] = await Promise.all([
      sql`
        SELECT
          p.id, p.title, p.genre, p.logline, p.short_synopsis, p.format,
          p.estimated_budget, p.budget_range, p.status, p.view_count,
          p.like_count, p.created_at, p.updated_at,
          COALESCE(u.name, u.first_name || ' ' || u.last_name, u.email) AS creator,
          u.email AS creator_email,
          sp.review_status, sp.review_notes, sp.review_rating,
          sp.reviewed_at, sp.saved_at AS submitted_date
        FROM saved_pitches sp
        JOIN pitches p ON p.id = sp.pitch_id
        JOIN users u ON p.user_id = u.id
        WHERE sp.user_id = ${userId} AND sp.review_status = ${statusFilter}
        ORDER BY COALESCE(sp.reviewed_at, sp.saved_at) DESC
        LIMIT ${limit} OFFSET ${offset}
      `.catch(() => []),
      sql`
        SELECT COUNT(*)::int AS total
        FROM saved_pitches
        WHERE user_id = ${userId} AND review_status = ${statusFilter}
      `.catch(() => [{ total: 0 }]),
    ]);

    const total = Number(countResult[0]?.total) || 0;
    return jsonResponse({
      success: true,
      data: { submissions, filter: statusFilter, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } },
    }, origin);
  } catch (error) {
    console.error('productionSubmissionsHandler error:', error);
    return jsonResponse({ success: true, data: defaultData }, origin);
  }
}

// Update the review status of a pitch for a production company
export async function updateSubmissionStatus(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');

  const userId = await getUserId(request, env);
  if (!userId) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
    });
  }

  const sql = getDb(env);
  if (!sql) {
    return new Response(JSON.stringify({ success: false, error: 'Database unavailable' }), {
      status: 503, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
    });
  }

  try {
    const url = new URL(request.url);
    const pitchId = parseInt(url.pathname.split('/').pop() || '0');
    const body = await request.json() as Record<string, unknown>;
    const status = typeof body.status === 'string' ? body.status : '';
    const notes = typeof body.notes === 'string' ? body.notes : null;
    const rating = typeof body.rating === 'number' ? body.rating : null;

    const validStatuses = ['reviewing', 'shortlisted', 'accepted', 'rejected', 'archived'];
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }

    // Upsert: if not saved yet, save it and set status; if already saved, update status
    const result = await sql`
      INSERT INTO saved_pitches (user_id, pitch_id, review_status, review_notes, review_rating, reviewed_at)
      VALUES (${userId}, ${pitchId}, ${status}, ${notes}, ${rating}, NOW())
      ON CONFLICT (user_id, pitch_id)
      DO UPDATE SET
        review_status = ${status},
        review_notes = COALESCE(${notes}, saved_pitches.review_notes),
        review_rating = COALESCE(${rating}, saved_pitches.review_rating),
        reviewed_at = NOW()
      RETURNING *
    `;

    return new Response(JSON.stringify({ success: true, data: { review: result[0] } }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
    });
  } catch (error) {
    console.error('updateSubmissionStatus error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to update status' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
    });
  }
}

// ---------------------------------------------------------------------------
// 4. Production Revenue
// ---------------------------------------------------------------------------

/**
 * GET /api/production/revenue
 *
 * Aggregates revenue data from investments joined with production_pipeline.
 * Includes total, monthly, quarterly, yearly breakdowns, per-project, and
 * monthly time-series data.
 */
export async function productionRevenueHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const defaultData = {
    totalRevenue: 0,
    monthlyRevenue: 0,
    quarterlyRevenue: 0,
    yearlyRevenue: 0,
    revenueByProject: [],
    revenueByMonth: [],
    projectedRevenue: 0,
    avgDealSize: 0,
    revenueByCategory: [],
  };

  const userId = await getUserId(request, env);
  if (!userId) {
    return jsonResponse({ success: true, data: defaultData }, origin);
  }

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: true, data: defaultData }, origin);
  }

  try {
    // Check if production_pipeline exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'production_pipeline'
      ) AS exists
    `.catch(() => [{ exists: false }]);

    if (!tableCheck[0]?.exists) {
      return jsonResponse({ success: true, data: defaultData }, origin);
    }

    // Aggregate revenue by time periods
    const revenueSummary = await sql`
      SELECT
        COALESCE(SUM(i.amount), 0) AS total_revenue,
        COALESCE(SUM(
          CASE WHEN i.created_at >= DATE_TRUNC('month', NOW()) THEN i.amount ELSE 0 END
        ), 0) AS monthly_revenue,
        COALESCE(SUM(
          CASE WHEN i.created_at >= DATE_TRUNC('quarter', NOW()) THEN i.amount ELSE 0 END
        ), 0) AS quarterly_revenue,
        COALESCE(SUM(
          CASE WHEN i.created_at >= DATE_TRUNC('year', NOW()) THEN i.amount ELSE 0 END
        ), 0) AS yearly_revenue
      FROM investments i
      JOIN production_pipeline pp ON i.pitch_id = pp.pitch_id
      WHERE pp.production_company_id::text = ${String(userId)}
        AND i.status IN ('active', 'funded', 'committed', 'completed')
    `.catch(() => []);

    const totalRevenue = Number(revenueSummary[0]?.total_revenue) || 0;
    const monthlyRevenue = Number(revenueSummary[0]?.monthly_revenue) || 0;
    const quarterlyRevenue = Number(revenueSummary[0]?.quarterly_revenue) || 0;
    const yearlyRevenue = Number(revenueSummary[0]?.yearly_revenue) || 0;

    // Revenue by project
    const revenueByProject = await sql`
      SELECT
        pp.id AS project_id,
        COALESCE(pp.title, p.title, 'Untitled') AS project_title,
        COALESCE(SUM(i.amount), 0) AS revenue,
        COUNT(i.id)::int AS investment_count
      FROM production_pipeline pp
      LEFT JOIN pitches p ON pp.pitch_id = p.id
      LEFT JOIN investments i ON i.pitch_id = pp.pitch_id
        AND i.status IN ('active', 'funded', 'committed', 'completed')
      WHERE pp.production_company_id::text = ${String(userId)}
      GROUP BY pp.id, pp.title, p.title
      ORDER BY revenue DESC
      LIMIT 20
    `.catch(() => []);

    // Revenue by month (last 12 months)
    const revenueByMonth = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', i.created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(i.amount), 0) AS revenue,
        COUNT(i.id)::int AS investment_count
      FROM investments i
      JOIN production_pipeline pp ON i.pitch_id = pp.pitch_id
      WHERE pp.production_company_id::text = ${String(userId)}
        AND i.status IN ('active', 'funded', 'committed', 'completed')
        AND i.created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', i.created_at)
      ORDER BY month ASC
    `.catch(() => []);

    // Simple projected revenue: average of last 3 months extrapolated
    let projectedRevenue = 0;
    if (revenueByMonth.length > 0) {
      const recent = revenueByMonth.slice(-3);
      const avgMonthly =
        recent.reduce((sum: number, r: any) => sum + Number(r.revenue), 0) /
        recent.length;
      projectedRevenue = Math.round(avgMonthly * 12);
    }

    // Average deal size from production_deals table
    let avgDealSize = 0;
    const dealCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'production_deals'
      ) AS exists
    `.catch(() => [{ exists: false }]);

    if (dealCheck[0]?.exists) {
      const dealStats = await sql`
        SELECT
          AVG(COALESCE(NULLIF(option_amount, 0), NULLIF(purchase_price, 0), NULLIF(development_fee, 0))) AS avg_deal
        FROM production_deals
        WHERE production_company_id = ${Number(userId)}
          AND deal_state NOT IN ('rejected', 'cancelled')
      `.catch(() => []);

      avgDealSize = Number(dealStats[0]?.avg_deal) || 0;
    }

    // Fallback: derive from revenueByProject if no deals exist
    if (avgDealSize === 0 && revenueByProject.length > 0) {
      const projectTotal = revenueByProject.reduce(
        (sum: number, p: any) => sum + (Number(p.revenue) || 0), 0
      );
      avgDealSize = Math.round(projectTotal / revenueByProject.length);
    }

    // Revenue by category (pitch format)
    const revenueByCategory = await sql`
      SELECT
        COALESCE(p.format, 'Other') AS category,
        COALESCE(SUM(i.amount), 0) AS revenue
      FROM production_pipeline pp
      JOIN pitches p ON pp.pitch_id = p.id
      LEFT JOIN investments i ON i.pitch_id = pp.pitch_id
        AND i.status IN ('active', 'funded', 'committed', 'completed')
      WHERE pp.production_company_id::text = ${String(userId)}
      GROUP BY p.format
      ORDER BY revenue DESC
    `.catch(() => []);

    // Compute percentages for each category
    const categoryTotal = revenueByCategory.reduce(
      (sum: number, c: any) => sum + (Number(c.revenue) || 0), 0
    );
    const revenueByCategoryWithPct = revenueByCategory.map((c: any) => ({
      category: String(c.category),
      revenue: Number(c.revenue) || 0,
      percentage: categoryTotal > 0
        ? Math.round(((Number(c.revenue) || 0) / categoryTotal) * 100)
        : 0,
    }));

    return jsonResponse({
      success: true,
      data: {
        totalRevenue,
        monthlyRevenue,
        quarterlyRevenue,
        yearlyRevenue,
        revenueByProject,
        revenueByMonth,
        projectedRevenue,
        avgDealSize,
        revenueByCategory: revenueByCategoryWithPct,
      },
    }, origin);
  } catch (error) {
    console.error('productionRevenueHandler error:', error);
    return jsonResponse({ success: true, data: defaultData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 5. Production Saved Pitches
// ---------------------------------------------------------------------------

/**
 * GET /api/production/saved-pitches
 *
 * Returns pitches saved by this production user via the saved_pitches table.
 */
export async function productionSavedPitchesHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const defaultData = {
    savedPitches: [],
    total: 0,
  };

  const userId = await getUserId(request, env);
  if (!userId) {
    return jsonResponse({ success: true, data: defaultData }, origin);
  }

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: true, data: defaultData }, origin);
  }

  try {
    const [savedPitches, countResult] = await Promise.all([
      sql`
        SELECT
          sp.id AS saved_id,
          sp.notes,
          sp.tags,
          sp.saved_at,
          p.id AS pitch_id,
          p.title,
          p.genre,
          p.logline,
          p.short_synopsis,
          p.format,
          p.estimated_budget,
          p.budget_range,
          p.status,
          p.view_count,
          p.like_count,
          p.title_image,
          p.created_at AS pitch_created_at,
          u.username AS creator_username,
          u.email AS creator_email
        FROM saved_pitches sp
        JOIN pitches p ON sp.pitch_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE sp.user_id = ${Number(userId)}
        ORDER BY sp.saved_at DESC
        LIMIT 50
      `.catch(() => []),
      sql`
        SELECT COUNT(*)::int AS total
        FROM saved_pitches
        WHERE user_id = ${Number(userId)}
      `.catch(() => [{ total: 0 }]),
    ]);

    const total = Number(countResult[0]?.total) || 0;

    return jsonResponse({
      success: true,
      data: {
        savedPitches,
        total,
      },
    }, origin);
  } catch (error) {
    console.error('productionSavedPitchesHandler error:', error);
    return jsonResponse({ success: true, data: defaultData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 6. Production Collaborations
// ---------------------------------------------------------------------------

/**
 * GET /api/production/collaborations
 *
 * Delegates to the real collaborations handler.
 */
export async function productionCollaborationsHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  // Delegate to the real collaborations handler
  const { getProductionCollaborationsHandler } = await import('./collaborations-real');
  return getProductionCollaborationsHandler(request, env);
}