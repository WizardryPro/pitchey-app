/**
 * Creator Portal Sidebar Handlers
 * Real database query implementations replacing stub endpoints
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  data: unknown,
  origin: string | null,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      ...getCorsHeaders(origin),
    },
  });
}

function parsePageParams(request: Request): { page: number; limit: number; offset: number } {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ---------------------------------------------------------------------------
// 1. GET /api/creator/stats
// ---------------------------------------------------------------------------

export async function creatorStatsHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = {
    totalPitches: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalSubmissions: 0,
    pendingSubmissions: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    teamMembers: 0,
  };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    // Pitch counts by status
    const pitchStats = await sql`
      SELECT
        COUNT(*)::int AS total_pitches,
        COUNT(CASE WHEN status IN ('public', 'active') THEN 1 END)::int AS active_projects,
        COUNT(CASE WHEN status = 'archived' THEN 1 END)::int AS completed_projects,
        COALESCE(SUM(view_count), 0)::int AS total_views,
        COALESCE(SUM(like_count), 0)::int AS total_likes
      FROM pitches
      WHERE user_id = ${userId}
    `;

    // Follower count (people following this creator)
    const followerStats = await sql`
      SELECT COUNT(*)::int AS follower_count
      FROM follows
      WHERE following_id = ${userId}
    `;

    // Investment totals for the creator's pitches
    const investmentStats = await sql`
      SELECT
        COALESCE(SUM(amount), 0)::numeric AS total_revenue
      FROM investments
      WHERE pitch_id IN (SELECT id FROM pitches WHERE user_id = ${userId})
        AND status IN ('completed', 'committed')
    `;

    // Monthly revenue (investments completed/committed this calendar month)
    const monthlyStats = await sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS monthly_revenue
      FROM investments
      WHERE pitch_id IN (SELECT id FROM pitches WHERE user_id = ${userId})
        AND status IN ('completed', 'committed')
        AND created_at >= date_trunc('month', CURRENT_DATE)
    `;

    const p = pitchStats[0] || {};
    const f = followerStats[0] || {};
    const i = investmentStats[0] || {};
    const m = monthlyStats[0] || {};

    return jsonResponse({
      success: true,
      data: {
        totalPitches: Number(p.total_pitches) || 0,
        activeProjects: Number(p.active_projects) || 0,
        completedProjects: Number(p.completed_projects) || 0,
        totalSubmissions: Number(p.total_pitches) || 0,
        pendingSubmissions: 0,
        totalRevenue: Number(i.total_revenue) || 0,
        monthlyRevenue: Number(m.monthly_revenue) || 0,
        teamMembers: Number(f.follower_count) || 0,
      },
    }, origin);
  } catch (error) {
    console.error('creatorStatsHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 2. GET /api/creator/activity
// ---------------------------------------------------------------------------

export async function creatorActivityHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);
  const { page, limit, offset } = parsePageParams(request);

  const emptyData = {
    activities: [],
    pagination: { page, limit, total: 0, totalPages: 0 },
  };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const countResult = await sql`
      SELECT COUNT(*)::int AS total
      FROM notifications
      WHERE user_id = ${userId}
    `;
    const total = Number(countResult[0]?.total) || 0;
    const totalPages = Math.ceil(total / limit);

    const activities = await sql`
      SELECT id, user_id, type, title, message, is_read, created_at
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return jsonResponse({
      success: true,
      data: {
        activities,
        pagination: { page, limit, total, totalPages },
      },
    }, origin);
  } catch (error) {
    console.error('creatorActivityHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 3. GET /api/creator/pitches/analytics
// ---------------------------------------------------------------------------

export async function creatorPitchesAnalyticsHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = {
    pitches: [],
    totals: { totalViews: 0, totalLikes: 0 },
  };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const pitches = await sql`
      SELECT
        p.id,
        p.title,
        COALESCE(p.view_count, 0)::int AS views,
        COALESCE(p.like_count, 0)::int AS likes,
        (SELECT COUNT(*)::int FROM saved_pitches sp WHERE sp.pitch_id = p.id) AS saves
      FROM pitches p
      WHERE p.user_id = ${userId}
      ORDER BY p.view_count DESC NULLS LAST
    `;

    const totals = await sql`
      SELECT
        COALESCE(SUM(view_count), 0)::int AS total_views,
        COALESCE(SUM(like_count), 0)::int AS total_likes
      FROM pitches
      WHERE user_id = ${userId}
    `;

    const t = totals[0] || {};

    return jsonResponse({
      success: true,
      data: {
        pitches,
        totals: {
          totalViews: Number(t.total_views) || 0,
          totalLikes: Number(t.total_likes) || 0,
        },
      },
    }, origin);
  } catch (error) {
    console.error('creatorPitchesAnalyticsHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 4. GET /api/creator/portfolio
// ---------------------------------------------------------------------------

export async function creatorPortfolioHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = { pitches: [], totalInvestment: 0 };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const pitches = await sql`
      SELECT
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.status,
        p.title_image AS cover_image,
        COALESCE(p.view_count, 0)::int AS view_count,
        COALESCE(p.like_count, 0)::int AS like_count,
        p.created_at,
        COALESCE(inv.investment_total, 0)::numeric AS investment_total
      FROM pitches p
      LEFT JOIN (
        SELECT pitch_id, SUM(amount) AS investment_total
        FROM investments
        WHERE status IN ('completed', 'committed')
        GROUP BY pitch_id
      ) inv ON inv.pitch_id = p.id
      WHERE p.user_id = ${userId}
      ORDER BY p.created_at DESC
    `;

    const totalInvestmentResult = await sql`
      SELECT COALESCE(SUM(i.amount), 0)::numeric AS total
      FROM investments i
      JOIN pitches p ON p.id = i.pitch_id
      WHERE p.user_id = ${userId}
        AND i.status IN ('completed', 'committed')
    `;

    return jsonResponse({
      success: true,
      data: {
        pitches,
        totalInvestment: Number(totalInvestmentResult[0]?.total) || 0,
      },
    }, origin);
  } catch (error) {
    console.error('creatorPortfolioHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 5. GET /api/creator/ndas
// ---------------------------------------------------------------------------

export async function creatorNdasHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = { ndas: [], total: 0 };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const ndas = await sql`
      SELECT
        nr.id,
        nr.pitch_id,
        nr.requester_id,
        nr.pitch_owner_id,
        nr.status,
        nr.message,
        nr.response_message,
        nr.requested_at,
        nr.responded_at,
        nr.expires_at,
        p.title AS pitch_title,
        u.email AS requester_email,
        COALESCE(u.name, u.email) AS requester_name
      FROM nda_requests nr
      JOIN pitches p ON p.id = nr.pitch_id
      LEFT JOIN users u ON u.id = nr.requester_id
      WHERE (nr.pitch_owner_id = ${userId} OR nr.creator_id = ${userId} OR nr.owner_id = ${userId} OR p.user_id = ${userId})
      ORDER BY nr.requested_at DESC
    `;

    // Also fetch from ndas table (signed NDAs may only exist there)
    let signedNdas: any[] = [];
    try {
      signedNdas = await sql`
        SELECT
          n.id,
          n.pitch_id,
          n.signer_id AS requester_id,
          NULL AS pitch_owner_id,
          n.status,
          NULL AS message,
          NULL AS response_message,
          n.created_at AS requested_at,
          n.signed_at AS responded_at,
          n.expires_at,
          p.title AS pitch_title,
          u.email AS requester_email,
          COALESCE(u.name, u.email) AS requester_name
        FROM ndas n
        JOIN pitches p ON p.id = n.pitch_id
        LEFT JOIN users u ON u.id = n.signer_id
        WHERE p.user_id = ${userId}
          AND n.id NOT IN (SELECT nr2.id FROM nda_requests nr2 WHERE nr2.pitch_id = n.pitch_id AND nr2.requester_id = n.signer_id)
        ORDER BY n.created_at DESC
      `;
    } catch {
      // ndas table query is supplementary
    }

    const allNdas = [...ndas, ...signedNdas];

    return jsonResponse({
      success: true,
      data: {
        ndas: allNdas,
        total: allNdas.length,
      },
    }, origin);
  } catch (error) {
    console.error('creatorNdasHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 6. GET /api/creator/calendar
// ---------------------------------------------------------------------------

export async function creatorCalendarHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = { events: [] };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  // Parse optional date range filters
  const url = new URL(request.url);
  const startParam = url.searchParams.get('start');
  const endParam = url.searchParams.get('end');

  try {
    // Synthesise events from NDA deadlines
    const ndaEvents = await sql`
      SELECT
        nr.id,
        'nda_deadline' AS type,
        'NDA: ' || p.title AS title,
        'NDA request for pitch "' || p.title || '"' AS description,
        nr.requested_at AS start_date,
        nr.expires_at AS end_date,
        '#ef4444' AS color
      FROM nda_requests nr
      JOIN pitches p ON p.id = nr.pitch_id
      WHERE (nr.pitch_owner_id = ${userId} OR nr.creator_id = ${userId} OR nr.owner_id = ${userId} OR p.user_id = ${userId})
        AND nr.status = 'pending'
      ORDER BY nr.requested_at DESC
      LIMIT 50
    `;

    // Investment milestones
    const investmentEvents = await sql`
      SELECT
        i.id,
        'investment' AS type,
        'Investment: ' || p.title AS title,
        'Investment of $' || i.amount || ' on pitch "' || p.title || '"' AS description,
        i.created_at AS start_date,
        NULL AS end_date,
        '#10b981' AS color
      FROM investments i
      JOIN pitches p ON p.id = i.pitch_id
      WHERE p.user_id = ${userId}
      ORDER BY i.created_at DESC
      LIMIT 50
    `;

    // User-created calendar events (table may not exist yet)
    let customEvents: any[] = [];
    try {
      if (startParam && endParam) {
        customEvents = await sql`
          SELECT id, title, type, start_date, end_date, location, description, attendees, color, reminder
          FROM calendar_events
          WHERE user_id = ${userId}
            AND start_date >= ${startParam}::timestamp
            AND start_date <= ${endParam}::timestamp
          ORDER BY start_date ASC
          LIMIT 100
        `;
      } else {
        customEvents = await sql`
          SELECT id, title, type, start_date, end_date, location, description, attendees, color, reminder
          FROM calendar_events
          WHERE user_id = ${userId}
          ORDER BY start_date DESC
          LIMIT 100
        `;
      }
    } catch {
      // calendar_events table may not exist yet — silently continue
    }

    // Normalize all events into a consistent shape with a `date` field
    const normalize = (row: any) => {
      const startRaw = row.start_date || row.start_time;
      const endRaw = row.end_date || row.end_time;
      const startISO = startRaw ? new Date(startRaw).toISOString() : null;
      const endISO = endRaw ? new Date(endRaw).toISOString() : null;

      return {
        id: row.id,
        title: row.title,
        type: row.type,
        date: startISO ? startISO.split('T')[0] : null,
        start: startISO,
        end: endISO,
        description: row.description || null,
        color: row.color || '#8b5cf6',
        location: row.location || null,
        attendees: row.attendees || [],
      };
    };

    const events = [
      ...ndaEvents.map((e: any) => normalize(e)),
      ...investmentEvents.map((e: any) => normalize(e)),
      ...customEvents.map((e: any) => normalize(e)),
    ].sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : 0;
      const bTime = b.start ? new Date(b.start).getTime() : 0;
      return bTime - aTime;
    });

    return jsonResponse({ success: true, data: { events } }, origin);
  } catch (error) {
    console.error('creatorCalendarHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 7. GET /api/creator/earnings
// ---------------------------------------------------------------------------

export async function creatorEarningsHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = { total: 0, pending: 0, paid: 0, transactions: [] };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    // Aggregate earnings from investments on the creator's pitches
    const earningsSummary = await sql`
      SELECT
        COALESCE(SUM(i.amount), 0)::numeric AS total,
        COALESCE(SUM(CASE WHEN i.status = 'pending' THEN i.amount ELSE 0 END), 0)::numeric AS pending,
        COALESCE(SUM(CASE WHEN i.status IN ('completed', 'committed') THEN i.amount ELSE 0 END), 0)::numeric AS paid
      FROM investments i
      JOIN pitches p ON p.id = i.pitch_id
      WHERE p.user_id = ${userId}
    `;

    // Also check investment_deals for additional earnings data
    let dealEarnings = { total: 0, pending: 0, paid: 0 };
    try {
      const dealResult = await sql`
        SELECT
          COALESCE(SUM(investment_amount), 0)::numeric AS total,
          COALESCE(SUM(CASE WHEN deal_state = 'inquiry' THEN investment_amount ELSE 0 END), 0)::numeric AS pending,
          COALESCE(SUM(CASE WHEN deal_state IN ('funded', 'completed') THEN investment_amount ELSE 0 END), 0)::numeric AS paid
        FROM investment_deals
        WHERE user_id = ${userId}
      `;
      if (dealResult[0]) {
        dealEarnings = {
          total: Number(dealResult[0].total) || 0,
          pending: Number(dealResult[0].pending) || 0,
          paid: Number(dealResult[0].paid) || 0,
        };
      }
    } catch {
      // investment_deals table may not exist -- silently continue
    }

    // Recent transactions: latest investments on the creator's pitches
    const transactions = await sql`
      SELECT
        i.id,
        i.amount,
        i.status,
        i.created_at,
        p.title AS pitch_title,
        u.email AS investor_email,
        COALESCE(u.name, u.email) AS investor_name
      FROM investments i
      JOIN pitches p ON p.id = i.pitch_id
      LEFT JOIN users u ON u.id = i.investor_id
      WHERE p.user_id = ${userId}
      ORDER BY i.created_at DESC
      LIMIT 50
    `;

    const s = earningsSummary[0] || {};

    return jsonResponse({
      success: true,
      data: {
        total: (Number(s.total) || 0) + dealEarnings.total,
        pending: (Number(s.pending) || 0) + dealEarnings.pending,
        paid: (Number(s.paid) || 0) + dealEarnings.paid,
        transactions,
      },
    }, origin);
  } catch (error) {
    console.error('creatorEarningsHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 8. GET /api/creator/followers
// ---------------------------------------------------------------------------

export async function creatorFollowersHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = { followers: [], total: 0 };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const countResult = await sql`
      SELECT COUNT(*)::int AS total
      FROM follows
      WHERE following_id = ${userId}
    `;
    const total = Number(countResult[0]?.total) || 0;

    const followers = await sql`
      SELECT
        u.id,
        u.email,
        COALESCE(u.name, u.email) AS name,
        u.user_type,
        u.profile_image,
        u.bio,
        f.created_at AS followed_at
      FROM follows f
      JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = ${userId}
      ORDER BY f.created_at DESC
      LIMIT 100
    `;

    return jsonResponse({
      success: true,
      data: {
        followers,
        total,
      },
    }, origin);
  } catch (error) {
    console.error('creatorFollowersHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 9. GET /api/creator/performance
// ---------------------------------------------------------------------------

export async function creatorPerformanceHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = {
    pitchPerformance: [],
    genreBreakdown: [],
    monthlyTrends: [],
    overallStats: { totalViews: 0, totalLikes: 0, avgEngagement: 0 },
  };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const pitchPerformance = await sql`
      SELECT
        p.id,
        p.title,
        p.genre,
        p.status,
        COALESCE(p.view_count, 0)::int AS views,
        COALESCE(p.like_count, 0)::int AS likes,
        CASE WHEN COALESCE(p.view_count, 0) > 0
          THEN ROUND((COALESCE(p.like_count, 0)::numeric / p.view_count) * 100, 2)
          ELSE 0
        END AS engagement_rate,
        p.created_at
      FROM pitches p
      WHERE p.user_id = ${userId}
      ORDER BY views DESC
      LIMIT 50
    `;

    const genreBreakdown = await sql`
      SELECT
        p.genre,
        COUNT(*)::int AS pitch_count,
        COALESCE(SUM(p.view_count), 0)::int AS total_views,
        COALESCE(SUM(p.like_count), 0)::int AS total_likes
      FROM pitches p
      WHERE p.user_id = ${userId}
      GROUP BY p.genre
      ORDER BY total_views DESC
    `;

    const monthlyTrends = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', p.created_at), 'YYYY-MM') AS month,
        COUNT(*)::int AS pitches_created,
        COALESCE(SUM(p.view_count), 0)::int AS views,
        COALESCE(SUM(p.like_count), 0)::int AS likes
      FROM pitches p
      WHERE p.user_id = ${userId}
        AND p.created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', p.created_at)
      ORDER BY month ASC
    `;

    let totalViews = 0;
    let totalLikes = 0;
    for (const row of pitchPerformance) {
      totalViews += Number(row.views) || 0;
      totalLikes += Number(row.likes) || 0;
    }
    const avgEngagement = totalViews > 0
      ? Number(((totalLikes / totalViews) * 100).toFixed(2))
      : 0;

    return jsonResponse({
      success: true,
      data: {
        pitchPerformance,
        genreBreakdown,
        monthlyTrends,
        overallStats: { totalViews, totalLikes, avgEngagement },
      },
    }, origin);
  } catch (error) {
    console.error('creatorPerformanceHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 10. GET /api/creator/network
// ---------------------------------------------------------------------------

export async function creatorNetworkHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = { connections: [], total: 0 };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const connections = await sql`
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.user_type,
        u.avatar_url,
        f.created_at AS connected_since
      FROM follows f
      JOIN users u ON (
        (f.follower_id = ${userId} AND u.id = f.following_id)
        OR
        (f.following_id = ${userId} AND u.id = f.follower_id)
      )
      WHERE f.follower_id = ${userId}
         OR f.following_id = ${userId}
      ORDER BY f.created_at DESC
    `;

    return jsonResponse({
      success: true,
      data: { connections, total: connections.length },
    }, origin);
  } catch (error) {
    console.error('creatorNetworkHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}