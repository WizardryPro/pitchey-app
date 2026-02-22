/**
 * Investor Sidebar Handlers
 * Real database-backed handlers for the Investor portal sidebar endpoints.
 * Replaces 18 stub endpoints with actual queries against Neon PostgreSQL.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a standard JSON response with CORS headers. */
function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}

/** Build an auth-error response when no userId can be resolved. */
function authError(origin: string | null): Response {
  return new Response(
    JSON.stringify({ success: false, error: 'Authentication required' }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin),
      },
    },
  );
}

// ---------------------------------------------------------------------------
// 1. investorDealsHandler
//    GET /api/investor/deals
// ---------------------------------------------------------------------------
export async function investorDealsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status') || 'all';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({
      deals: [],
      filter: statusFilter,
      pagination: { page, limit, total: 0, totalPages: 0 },
    }, origin);
  }

  try {
    let deals: any[];
    let countResult: any[];

    if (statusFilter !== 'all') {
      deals = await sql`
        SELECT d.*
        FROM deals d
        WHERE d.investor_id = ${userId}
          AND d.status = ${statusFilter}
        ORDER BY d.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*)::int AS total
        FROM deals d
        WHERE d.investor_id = ${userId}
          AND d.status = ${statusFilter}
      `;
    } else {
      deals = await sql`
        SELECT d.*
        FROM deals d
        WHERE d.investor_id = ${userId}
        ORDER BY d.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*)::int AS total
        FROM deals d
        WHERE d.investor_id = ${userId}
      `;
    }

    const total = countResult[0]?.total ?? 0;

    return jsonResponse({
      deals,
      filter: statusFilter,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, origin);
  } catch (error) {
    console.error('[investorDealsHandler] Query error:', error);
    return jsonResponse({
      deals: [],
      filter: statusFilter,
      pagination: { page, limit, total: 0, totalPages: 0 },
    }, origin);
  }
}

// ---------------------------------------------------------------------------
// 2. investorCompletedProjectsHandler
//    GET /api/investor/completed-projects
// ---------------------------------------------------------------------------
export async function investorCompletedProjectsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ projects: [], totalReturns: 0, averageROI: 0 }, origin);
  }

  try {
    const projects = await sql`
      SELECT
        i.id AS investment_id,
        i.amount,
        i.current_value,
        i.status,
        i.created_at AS invested_at,
        p.id AS pitch_id,
        p.title,
        p.genre,
        p.status AS pitch_status
      FROM investments i
      JOIN pitches p ON p.id::text = i.pitch_id::text
      WHERE i.investor_id = ${userId}
        AND i.status = 'completed'
      ORDER BY i.created_at DESC
    `;

    let totalReturns = 0;
    let totalInvested = 0;
    for (const proj of projects) {
      const amount = Number(proj.amount) || 0;
      const currentValue = Number(proj.current_value) || 0;
      totalReturns += currentValue - amount;
      totalInvested += amount;
    }

    const averageROI = totalInvested > 0 ? Number(((totalReturns / totalInvested) * 100).toFixed(2)) : 0;

    return jsonResponse({ projects, totalReturns, averageROI }, origin);
  } catch (error) {
    console.error('[investorCompletedProjectsHandler] Query error:', error);
    return jsonResponse({ projects: [], totalReturns: 0, averageROI: 0 }, origin);
  }
}

// ---------------------------------------------------------------------------
// 3. investorSavedPitchesHandler
//    GET /api/investor/saved-pitches
// ---------------------------------------------------------------------------
export async function investorSavedPitchesHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ savedPitches: [], total: 0 }, origin);
  }

  try {
    const savedPitches = await sql`
      SELECT
        sp.pitch_id,
        sp.created_at AS saved_at,
        p.title,
        p.genre,
        p.logline,
        p.status,
        p.thumbnail_url,
        u.name AS creator_name
      FROM saved_pitches sp
      JOIN pitches p ON p.id::text = sp.pitch_id::text
      LEFT JOIN users u ON u.id::text = p.user_id::text
      WHERE sp.user_id = ${userId}
      ORDER BY sp.created_at DESC
    `;

    return jsonResponse({ savedPitches, total: savedPitches.length }, origin);
  } catch (error) {
    console.error('[investorSavedPitchesHandler] Query error:', error);
    return jsonResponse({ savedPitches: [], total: 0 }, origin);
  }
}

// ---------------------------------------------------------------------------
// 4. investorFinancialOverviewHandler
//    GET /api/investor/financial-overview
// ---------------------------------------------------------------------------
export async function investorFinancialOverviewHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const emptyData = {
    totalInvested: 0,
    currentValue: 0,
    totalReturns: 0,
    unrealizedGains: 0,
    realizedGains: 0,
    pendingInvestments: 0,
    availableFunds: 0,
  };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  try {
    const agg = await sql`
      SELECT
        COALESCE(SUM(amount), 0)::numeric          AS total_invested,
        COALESCE(SUM(current_value), 0)::numeric    AS current_value,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN current_value - amount ELSE 0 END), 0)::numeric AS realized_gains,
        COALESCE(SUM(CASE WHEN status != 'completed' AND status != 'pending' THEN current_value - amount ELSE 0 END), 0)::numeric AS unrealized_gains,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)::numeric AS pending_investments
      FROM investments
      WHERE investor_id = ${userId}
    `;

    const row = agg[0] || {};
    const totalInvested = Number(row.total_invested) || 0;
    const currentValue = Number(row.current_value) || 0;
    const realizedGains = Number(row.realized_gains) || 0;
    const unrealizedGains = Number(row.unrealized_gains) || 0;
    const pendingInvestments = Number(row.pending_investments) || 0;
    const totalReturns = realizedGains + unrealizedGains;

    // Try to get available funds from user_credits if the table exists
    let availableFunds = 0;
    try {
      const creditRows = await sql`
        SELECT COALESCE(balance, 0)::numeric AS balance
        FROM user_credits
        WHERE user_id = ${userId}
        LIMIT 1
      `;
      availableFunds = Number(creditRows[0]?.balance) || 0;
    } catch {
      // user_credits table may not exist yet; silently fall back to 0
    }

    return jsonResponse({
      totalInvested,
      currentValue,
      totalReturns,
      unrealizedGains,
      realizedGains,
      pendingInvestments,
      availableFunds,
    }, origin);
  } catch (error) {
    console.error('[investorFinancialOverviewHandler] Query error:', error);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// 5. investorBudgetHandler
//    GET /api/investor/budget
// ---------------------------------------------------------------------------
export async function investorBudgetHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const emptyData = { totalBudget: 0, allocated: 0, remaining: 0, allocations: [] as any[] };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  try {
    const allocations = await sql`
      SELECT
        id,
        category,
        amount,
        spent,
        created_at
      FROM budget_allocations
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    let totalBudget = 0;
    let allocated = 0;
    for (const row of allocations) {
      totalBudget += Number(row.amount) || 0;
      allocated += Number(row.spent) || 0;
    }

    return jsonResponse({
      totalBudget,
      allocated,
      remaining: totalBudget - allocated,
      allocations,
    }, origin);
  } catch (error) {
    console.error('[investorBudgetHandler] Query error:', error);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// 6. investorROIHandler
//    GET /api/investor/roi
// ---------------------------------------------------------------------------
export async function investorROIHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const emptyData = {
    overallROI: 0,
    roiByProject: [] as any[],
    roiByGenre: [] as any[],
    roiTimeline: [] as any[],
    projectedROI: 0,
  };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  try {
    // Per-project ROI
    const roiByProject = await sql`
      SELECT
        i.id AS investment_id,
        p.title,
        p.genre,
        i.amount,
        i.current_value,
        CASE WHEN i.amount > 0
          THEN ROUND(((i.current_value - i.amount) / i.amount) * 100, 2)
          ELSE 0
        END AS roi,
        i.created_at
      FROM investments i
      JOIN pitches p ON p.id::text = i.pitch_id::text
      WHERE i.investor_id = ${userId}
      ORDER BY i.created_at DESC
    `;

    // Per-genre aggregation
    const roiByGenre = await sql`
      SELECT
        p.genre,
        COUNT(*)::int AS investments,
        SUM(i.amount)::numeric AS total_invested,
        SUM(i.current_value)::numeric AS total_value,
        CASE WHEN SUM(i.amount) > 0
          THEN ROUND(((SUM(i.current_value) - SUM(i.amount)) / SUM(i.amount)) * 100, 2)
          ELSE 0
        END AS roi
      FROM investments i
      JOIN pitches p ON p.id::text = i.pitch_id::text
      WHERE i.investor_id = ${userId}
      GROUP BY p.genre
      ORDER BY roi DESC
    `;

    // Monthly ROI timeline (last 12 months)
    const roiTimeline = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', i.created_at), 'YYYY-MM') AS month,
        SUM(i.amount)::numeric AS invested,
        SUM(i.current_value)::numeric AS value
      FROM investments i
      WHERE i.investor_id = ${userId}
        AND i.created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', i.created_at)
      ORDER BY month ASC
    `;

    // Overall ROI
    let totalInvested = 0;
    let totalValue = 0;
    for (const row of roiByProject) {
      totalInvested += Number(row.amount) || 0;
      totalValue += Number(row.current_value) || 0;
    }
    const overallROI = totalInvested > 0
      ? Number(((totalValue - totalInvested) / totalInvested * 100).toFixed(2))
      : 0;

    // Simple projection: assume same trend forward
    const projectedROI = Number((overallROI * 1.1).toFixed(2));

    return jsonResponse({
      overallROI,
      roiByProject,
      roiByGenre,
      roiTimeline,
      projectedROI,
    }, origin);
  } catch (error) {
    console.error('[investorROIHandler] Query error:', error);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// 7. investorReportsHandler
//    GET /api/investor/reports
// ---------------------------------------------------------------------------
export async function investorReportsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ reports: [], availableTypes: ['quarterly', 'annual', 'tax', 'performance'] }, origin);

  try {
    // Check if user has any investment activity to generate reports from
    const activity = await sql`
      SELECT
        COUNT(*)::int as total_investments,
        MIN(created_at) as first_investment,
        MAX(created_at) as last_investment,
        COALESCE(SUM(amount), 0) as total_amount
      FROM investments
      WHERE investor_id = ${userId}
    `;

    const a = activity[0] || {};
    const totalInvestments = parseInt(String(a.total_investments || '0'), 10);

    // No activity = no reports to show
    if (totalInvestments === 0) {
      return jsonResponse({ reports: [], availableTypes: ['quarterly', 'annual', 'tax', 'performance'] }, origin);
    }

    // Generate available reports based on real investment history
    const reports: Array<Record<string, unknown>> = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

    // Most recent quarter performance report
    const qLabel = `Q${currentQuarter > 1 ? currentQuarter - 1 : 4} ${currentQuarter > 1 ? currentYear : currentYear - 1}`;
    reports.push({
      id: `perf-${qLabel}`,
      title: `${qLabel} Portfolio Performance`,
      type: 'quarterly',
      category: 'performance',
      date: now.toISOString().split('T')[0],
      fileSize: '-',
      format: 'pdf',
      description: `Performance summary for ${qLabel} based on ${totalInvestments} investment(s)`,
    });

    // Annual tax report if activity exists in current or previous year
    reports.push({
      id: `tax-${currentYear}`,
      title: `Annual Tax Summary ${currentYear}`,
      type: 'annual',
      category: 'tax',
      date: now.toISOString().split('T')[0],
      fileSize: '-',
      format: 'pdf',
      description: `Tax documentation for investment activities in ${currentYear}`,
    });

    // Portfolio overview
    reports.push({
      id: `portfolio-${currentYear}`,
      title: `Portfolio Overview`,
      type: 'custom',
      category: 'portfolio',
      date: now.toISOString().split('T')[0],
      fileSize: '-',
      format: 'pdf',
      description: `Current portfolio breakdown across ${totalInvestments} investment(s) totaling $${parseFloat(String(a.total_amount || '0')).toLocaleString()}`,
    });

    return jsonResponse({ reports, availableTypes: ['quarterly', 'annual', 'tax', 'performance'] }, origin);
  } catch (error) {
    console.error('[investorReportsHandler] Error:', error);
    return jsonResponse({ reports: [], availableTypes: ['quarterly', 'annual', 'tax', 'performance'] }, origin);
  }
}

// ---------------------------------------------------------------------------
// 8. investorTaxDocumentsHandler
//    GET /api/investor/tax-documents
// ---------------------------------------------------------------------------
export async function investorTaxDocumentsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const url = new URL(request.url);
  const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ documents: [], taxYear: year }, origin);

  try {
    // Generate tax summaries from financial_transactions and investments
    const txSummary = await sql`
      SELECT
        type,
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0) as total
      FROM financial_transactions
      WHERE user_id = ${userId}
        AND EXTRACT(YEAR FROM created_at) = ${year}
        AND status = 'completed'
      GROUP BY type
    `;

    const investmentSummary = await sql`
      SELECT
        COUNT(*)::int as total_investments,
        COALESCE(SUM(amount), 0) as total_invested,
        COALESCE(SUM(CASE WHEN roi_percentage > 0 THEN amount * roi_percentage / 100 ELSE 0 END), 0) as total_gains,
        COALESCE(SUM(CASE WHEN roi_percentage < 0 THEN amount * ABS(roi_percentage) / 100 ELSE 0 END), 0) as total_losses
      FROM investments
      WHERE investor_id = ${userId}
        AND EXTRACT(YEAR FROM created_at) = ${year}
    `;

    const documents: Array<{ id: string; title: string; type: string; year: number; summary: Record<string, unknown> }> = [];
    const inv = investmentSummary[0] || {};
    const totalInvested = parseFloat(String(inv.total_invested || '0'));

    if (totalInvested > 0 || txSummary.length > 0) {
      documents.push({
        id: `tax-summary-${year}`,
        title: `Tax Year ${year} Investment Summary`,
        type: 'annual_summary',
        year,
        summary: {
          totalInvestments: parseInt(String(inv.total_investments || '0'), 10),
          totalInvested,
          totalGains: parseFloat(String(inv.total_gains || '0')),
          totalLosses: parseFloat(String(inv.total_losses || '0')),
          transactions: txSummary.map((t: any) => ({
            type: t.type,
            count: t.count,
            total: parseFloat(String(t.total || '0')),
          })),
        },
      });
    }

    return jsonResponse({ documents, taxYear: year }, origin);
  } catch (error) {
    console.error('[investorTaxDocumentsHandler] Error:', error);
    return jsonResponse({ documents: [], taxYear: year }, origin);
  }
}

// ---------------------------------------------------------------------------
// 9. investorMarketTrendsHandler
//    GET /api/investor/market-trends
// ---------------------------------------------------------------------------
export async function investorMarketTrendsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');

  const emptyData = {
    trends: [] as any[],
    topGenres: [] as any[],
    avgInvestmentByGenre: [] as any[],
  };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  try {
    // Top genres by number of published pitches
    const topGenres = await sql`
      SELECT
        genre,
        COUNT(*)::int AS pitch_count
      FROM pitches
      WHERE status IN ('published', 'active')
        AND genre IS NOT NULL
      GROUP BY genre
      ORDER BY pitch_count DESC
      LIMIT 10
    `;

    // Average investment per genre
    const avgInvestmentByGenre = await sql`
      SELECT
        p.genre,
        COUNT(i.id)::int AS investment_count,
        COALESCE(AVG(i.amount), 0)::numeric AS avg_investment,
        COALESCE(SUM(i.amount), 0)::numeric AS total_invested
      FROM investments i
      JOIN pitches p ON p.id::text = i.pitch_id::text
      WHERE p.genre IS NOT NULL
      GROUP BY p.genre
      ORDER BY total_invested DESC
      LIMIT 10
    `;

    // Simple trends: pitches created per month (last 6 months)
    const trends = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COUNT(*)::int AS pitches_created,
        COUNT(DISTINCT genre) AS genre_diversity
      FROM pitches
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `;

    return jsonResponse({ trends, topGenres, avgInvestmentByGenre }, origin);
  } catch (error) {
    console.error('[investorMarketTrendsHandler] Query error:', error);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// 10. investorNetworkHandler
//     GET /api/investor/network
// ---------------------------------------------------------------------------
export async function investorNetworkHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const emptyData = { connections: [] as any[], total: 0 };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

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
        (f.follower_id::text = ${userId} AND u.id::text = f.following_id::text)
        OR
        (f.following_id::text = ${userId} AND u.id::text = f.follower_id::text)
      )
      WHERE f.follower_id::text = ${userId}
         OR f.following_id::text = ${userId}
      ORDER BY f.created_at DESC
    `;

    return jsonResponse({ connections, total: connections.length }, origin);
  } catch (error) {
    console.error('[investorNetworkHandler] Query error:', error);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// 11. investorCoInvestorsHandler
//     GET /api/investor/co-investors
// ---------------------------------------------------------------------------
export async function investorCoInvestorsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const emptyData = { coInvestors: [] as any[], total: 0 };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  try {
    // Find other investors who invested in the same pitches
    const coInvestors = await sql`
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.avatar_url,
        COUNT(i2.pitch_id)::int AS shared_investments
      FROM investments i1
      JOIN investments i2 ON i2.pitch_id = i1.pitch_id
        AND i2.investor_id != i1.investor_id
      JOIN users u ON u.id::text = i2.investor_id::text
      WHERE i1.investor_id = ${userId}
      GROUP BY u.id, u.name, u.email, u.avatar_url
      ORDER BY shared_investments DESC
      LIMIT 50
    `;

    return jsonResponse({ coInvestors, total: coInvestors.length }, origin);
  } catch (error) {
    console.error('[investorCoInvestorsHandler] Query error:', error);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// 12. investorCreatorsHandler
//     GET /api/investor/creators
// ---------------------------------------------------------------------------
export async function investorCreatorsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const emptyData = { creators: [] as any[], total: 0 };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  try {
    const creators = await sql`
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.avatar_url,
        u.bio,
        COUNT(i.id)::int AS investment_count,
        COALESCE(SUM(i.amount), 0)::numeric AS total_invested
      FROM investments i
      JOIN pitches p ON p.id::text = i.pitch_id::text
      JOIN users u ON u.id::text = p.user_id::text
      WHERE i.investor_id = ${userId}
      GROUP BY u.id, u.name, u.email, u.avatar_url, u.bio
      ORDER BY total_invested DESC
    `;

    return jsonResponse({ creators, total: creators.length }, origin);
  } catch (error) {
    console.error('[investorCreatorsHandler] Query error:', error);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// 13. investorProductionCompaniesHandler
//     GET /api/investor/production-companies
// ---------------------------------------------------------------------------
export async function investorProductionCompaniesHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');

  const emptyData = { companies: [] as any[], total: 0 };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  try {
    const companies = await sql`
      SELECT
        id,
        name,
        email,
        avatar_url,
        bio,
        created_at
      FROM users
      WHERE user_type = 'production'
        AND is_active = true
      ORDER BY name ASC
    `;

    return jsonResponse({ companies, total: companies.length }, origin);
  } catch (error) {
    console.error('[investorProductionCompaniesHandler] Query error:', error);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// 14. investorWalletHandler
//     GET /api/investor/wallet
// ---------------------------------------------------------------------------
export async function investorWalletHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const emptyData = { balance: 0, currency: 'USD', transactions: [] as any[] };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  try {
    // Get balance from user_credits
    let balance = 0;
    try {
      const creditRows = await sql`
        SELECT COALESCE(balance, 0)::numeric AS balance
        FROM user_credits
        WHERE user_id = ${userId}
        LIMIT 1
      `;
      balance = Number(creditRows[0]?.balance) || 0;
    } catch {
      // table may not exist
    }

    // Attempt to retrieve recent transactions if a transactions table exists
    let transactions: any[] = [];
    try {
      transactions = await sql`
        SELECT id, type, amount, description, created_at
        FROM transactions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 20
      `;
    } catch {
      // transactions table may not exist
    }

    return jsonResponse({ balance, currency: 'USD', transactions }, origin);
  } catch (error) {
    console.error('[investorWalletHandler] Query error:', error);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// 15. investorPaymentMethodsHandler
//     GET /api/investor/payment-methods
// ---------------------------------------------------------------------------
export async function investorPaymentMethodsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const emptyData = { methods: [] as any[], total: 0 };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  try {
    const methods = await sql`
      SELECT
        id,
        card_brand,
        card_last4,
        is_default,
        created_at
      FROM payment_methods
      WHERE user_id = ${userId}
      ORDER BY is_default DESC, created_at DESC
    `;

    return jsonResponse({ methods, total: methods.length }, origin);
  } catch (error) {
    console.error('[investorPaymentMethodsHandler] Query error:', error);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// 16. investorNdasHandler
//     GET /api/investor/ndas
// ---------------------------------------------------------------------------
export async function investorNdasHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const emptyData = { ndas: [] as any[], total: 0 };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  try {
    const ndas = await sql`
      SELECT
        nr.id,
        nr.pitch_id,
        nr.requester_id,
        nr.owner_id,
        nr.status,
        nr.created_at,
        nr.updated_at,
        p.title AS pitch_title
      FROM nda_requests nr
      LEFT JOIN pitches p ON p.id::text = nr.pitch_id::text
      WHERE nr.requester_id = ${userId}
      ORDER BY nr.created_at DESC
    `;

    return jsonResponse({ ndas, total: ndas.length }, origin);
  } catch (error) {
    console.error('[investorNdasHandler] Query error:', error);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// 17. investorPerformanceHandler
//     GET /api/investor/performance
// ---------------------------------------------------------------------------
export async function investorPerformanceHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const emptyData = {
    overallROI: 0,
    roiByProject: [] as any[],
    roiByGenre: [] as any[],
    roiTimeline: [] as any[],
    projectedROI: 0,
  };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  try {
    // Per-project performance
    const roiByProject = await sql`
      SELECT
        i.id AS investment_id,
        p.title,
        p.genre,
        i.amount,
        i.current_value,
        i.status,
        CASE WHEN i.amount > 0
          THEN ROUND(((i.current_value - i.amount) / i.amount) * 100, 2)
          ELSE 0
        END AS roi,
        i.created_at
      FROM investments i
      JOIN pitches p ON p.id::text = i.pitch_id::text
      WHERE i.investor_id = ${userId}
      ORDER BY roi DESC
    `;

    // Per-genre aggregation
    const roiByGenre = await sql`
      SELECT
        p.genre,
        COUNT(*)::int AS investments,
        SUM(i.amount)::numeric AS total_invested,
        SUM(i.current_value)::numeric AS total_value,
        CASE WHEN SUM(i.amount) > 0
          THEN ROUND(((SUM(i.current_value) - SUM(i.amount)) / SUM(i.amount)) * 100, 2)
          ELSE 0
        END AS roi
      FROM investments i
      JOIN pitches p ON p.id::text = i.pitch_id::text
      WHERE i.investor_id = ${userId}
      GROUP BY p.genre
      ORDER BY roi DESC
    `;

    // Monthly timeline (last 12 months)
    const roiTimeline = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', i.created_at), 'YYYY-MM') AS month,
        SUM(i.amount)::numeric AS invested,
        SUM(i.current_value)::numeric AS value
      FROM investments i
      WHERE i.investor_id = ${userId}
        AND i.created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', i.created_at)
      ORDER BY month ASC
    `;

    // Overall calculations
    let totalInvested = 0;
    let totalValue = 0;
    for (const row of roiByProject) {
      totalInvested += Number(row.amount) || 0;
      totalValue += Number(row.current_value) || 0;
    }
    const overallROI = totalInvested > 0
      ? Number(((totalValue - totalInvested) / totalInvested * 100).toFixed(2))
      : 0;
    const projectedROI = Number((overallROI * 1.1).toFixed(2));

    return jsonResponse({
      overallROI,
      roiByProject,
      roiByGenre,
      roiTimeline,
      projectedROI,
    }, origin);
  } catch (error) {
    console.error('[investorPerformanceHandler] Query error:', error);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// 18. investorOpportunitiesHandler
//     GET /api/investor/opportunities
// ---------------------------------------------------------------------------
export async function investorOpportunitiesHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const url = new URL(request.url);
  const genre = url.searchParams.get('genre');
  const sortBy = url.searchParams.get('sortBy') || 'popularity';
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

  const emptyData = { opportunities: [] as any[], total: 0 };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  // --- Redis cache (3 min TTL) ---
  const { UpstashCacheService } = await import('../services/upstash-cache.service');
  const cache = new UpstashCacheService(env);
  const cacheKey = `investor:opportunities:${sortBy}:${genre || 'all'}:o${offset}:l${limit}`;

  if (cache.isConnected) {
    try {
      const cached = await cache.get<{ opportunities: any[]; total: number }>(cacheKey);
      if (cached) return jsonResponse(cached, origin);
    } catch {
      // cache miss — continue to DB
    }
  }

  try {
    // Build ORDER BY from sortBy param
    let orderClause: string;
    switch (sortBy) {
      case 'popularity':
        orderClause = '(COALESCE(p.view_count,0) + COALESCE(p.like_count,0)*2 + COALESCE(p.nda_count,0)*5) DESC';
        break;
      case 'roi':
        orderClause = 'COALESCE(md.avg_roi, 0) DESC, p.created_at DESC';
        break;
      case 'matchScore':
        orderClause = 'match_score DESC';
        break;
      case 'deadline':
      default:
        orderClause = 'p.created_at DESC';
        break;
    }

    const genreFilter = genre && genre !== 'all'
      ? sql`AND p.genre ILIKE ${'%' + genre + '%'}`
      : sql``;

    const rows = await sql`
      SELECT
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.status,
        p.title_image AS thumbnail_url,
        p.budget,
        COALESCE(p.investment_total, 0) AS raised_amount,
        COALESCE(p.investment_count, 0) AS investors,
        COALESCE(p.view_count, 0) AS view_count,
        COALESCE(p.like_count, 0) AS like_count,
        COALESCE(p.nda_count, 0) AS nda_count,
        COALESCE(p.rating_average, 0) AS rating_average,
        p.created_at,
        u.name AS creator_name,
        md.avg_roi,
        -- Match score: weighted engagement metrics scaled 0-100
        LEAST(100, (
          COALESCE(p.view_count,0) * 0.5
          + COALESCE(p.like_count,0) * 3
          + COALESCE(p.nda_count,0) * 10
          + COALESCE(p.rating_average,0) * 10
        )::int) AS match_score
      FROM pitches p
      JOIN users u ON u.id::text = p.user_id::text
      LEFT JOIN LATERAL (
        SELECT avg_roi FROM market_data
        WHERE genre ILIKE p.genre
        ORDER BY data_date DESC LIMIT 1
      ) md ON true
      WHERE (p.seeking_investment = true OR p.status = 'published')
        ${genreFilter}
      ORDER BY ${sql.unsafe(orderClause)}
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count for pagination
    const countResult = await sql`
      SELECT COUNT(*)::int AS total
      FROM pitches p
      WHERE (p.seeking_investment = true OR p.status = 'published')
        ${genreFilter}
    `;
    const total = countResult[0]?.total ?? rows.length;

    // Map rows to InvestmentOpportunity shape
    const opportunities = rows.map((r: any) => {
      const budget = Number(r.budget) || 0;
      let riskLevel: 'low' | 'medium' | 'high' = 'medium';
      if (budget > 0 && budget < 100000) riskLevel = 'low';
      else if (budget >= 1000000) riskLevel = 'high';

      return {
        id: r.id,
        title: r.title,
        logline: r.logline,
        genre: r.genre,
        status: r.status,
        thumbnailUrl: r.thumbnail_url,
        targetAmount: budget,
        raisedAmount: Number(r.raised_amount) || 0,
        investors: Number(r.investors) || 0,
        expectedROI: r.avg_roi != null ? Number(r.avg_roi) : null,
        matchScore: Number(r.match_score) || 0,
        riskLevel,
        minInvestment: null,
        creatorName: r.creator_name,
        createdAt: r.created_at,
      };
    });

    const result = { opportunities, total };

    // Cache the result (fire-and-forget)
    if (cache.isConnected) {
      cache.set(cacheKey, result, 180).catch(() => {});
    }

    return jsonResponse(result, origin);
  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    console.error('[investorOpportunitiesHandler] Query error:', e.message);
    return jsonResponse(emptyData, origin);
  }
}

// ---------------------------------------------------------------------------
// investorSettingsGetHandler
//    GET /api/investor/settings
// ---------------------------------------------------------------------------
export async function investorSettingsGetHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ notifications: {}, privacy: {}, security: {}, preferences: {} }, origin);

  try {
    const rows = await sql`
      SELECT preferences, privacy_settings, alert_preferences,
             email_notifications, notifications_enabled, two_factor_enabled
      FROM users WHERE id = ${userId}
    `;
    const user = rows[0];
    if (!user) return jsonResponse({ notifications: {}, privacy: {}, security: {}, preferences: {} }, origin);

    const prefs = (user.preferences as Record<string, unknown>) || {};
    const privacy = (user.privacy_settings as Record<string, unknown>) || {};
    const alerts = (user.alert_preferences as Record<string, unknown>) || {};

    return jsonResponse({
      notifications: {
        emailAlerts: user.email_notifications ?? true,
        pushNotifications: (alerts.pushNotifications as boolean) ?? false,
        smsAlerts: (alerts.smsAlerts as boolean) ?? false,
        weeklyDigest: (alerts.weeklyDigest as boolean) ?? true,
        pitchUpdates: (alerts.pitchUpdates as boolean) ?? true,
        investmentAlerts: (alerts.investmentAlerts as boolean) ?? true,
        ndaReminders: (alerts.ndaReminders as boolean) ?? true,
      },
      privacy: {
        profileVisible: (privacy.profileVisible as boolean) ?? true,
        showInvestments: (privacy.showInvestments as boolean) ?? false,
        allowMessages: (privacy.allowMessages as boolean) ?? true,
        dataSharing: (privacy.dataSharing as boolean) ?? false,
      },
      security: {
        twoFactorAuth: user.two_factor_enabled ?? false,
        loginAlerts: (prefs.loginAlerts as boolean) ?? true,
        sessionTimeout: (prefs.sessionTimeout as string) ?? '30',
      },
      preferences: {
        currency: (prefs.currency as string) ?? 'USD',
        language: (prefs.language as string) ?? 'en',
        timezone: (prefs.timezone as string) ?? 'America/Los_Angeles',
        theme: (prefs.theme as string) ?? 'light',
      },
    }, origin);
  } catch (error) {
    console.error('[investorSettingsGetHandler] Error:', error);
    return jsonResponse({ notifications: {}, privacy: {}, security: {}, preferences: {} }, origin);
  }
}

// ---------------------------------------------------------------------------
// investorSettingsSaveHandler
//    PUT /api/investor/settings
// ---------------------------------------------------------------------------
export async function investorSettingsSaveHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const sql = getDb(env);
  if (!sql) {
    return new Response(JSON.stringify({ success: false, error: 'Database unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const notifications = (body.notifications ?? {}) as Record<string, unknown>;
    const privacy = (body.privacy ?? {}) as Record<string, unknown>;
    const security = (body.security ?? {}) as Record<string, unknown>;
    const preferences = (body.preferences ?? {}) as Record<string, unknown>;

    const alertPrefs = {
      pushNotifications: notifications.pushNotifications ?? false,
      smsAlerts: notifications.smsAlerts ?? false,
      weeklyDigest: notifications.weeklyDigest ?? true,
      pitchUpdates: notifications.pitchUpdates ?? true,
      investmentAlerts: notifications.investmentAlerts ?? true,
      ndaReminders: notifications.ndaReminders ?? true,
    };

    const privacySettings = {
      profileVisible: privacy.profileVisible ?? true,
      showInvestments: privacy.showInvestments ?? false,
      allowMessages: privacy.allowMessages ?? true,
      dataSharing: privacy.dataSharing ?? false,
    };

    const prefsJson = {
      loginAlerts: security.loginAlerts ?? true,
      sessionTimeout: security.sessionTimeout ?? '30',
      currency: preferences.currency ?? 'USD',
      language: preferences.language ?? 'en',
      timezone: preferences.timezone ?? 'America/Los_Angeles',
      theme: preferences.theme ?? 'light',
    };

    await sql`
      UPDATE users SET
        email_notifications = ${notifications.emailAlerts ?? true},
        alert_preferences = ${JSON.stringify(alertPrefs)}::jsonb,
        privacy_settings = ${JSON.stringify(privacySettings)}::jsonb,
        preferences = ${JSON.stringify(prefsJson)}::jsonb,
        two_factor_enabled = ${security.twoFactorAuth ?? false},
        updated_at = NOW()
      WHERE id = ${userId}
    `;

    return jsonResponse({ saved: true }, origin);
  } catch (error) {
    console.error('[investorSettingsSaveHandler] Error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to save settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  }
}

// ---------------------------------------------------------------------------
// investorPitchInvestmentDetailHandler
//    GET /api/investor/pitch/:pitchId/investment-detail
// ---------------------------------------------------------------------------
export async function investorPitchInvestmentDetailHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return authError(origin);

  const url = new URL(request.url);
  // Extract pitchId from /api/investor/pitch/:pitchId/investment-detail
  const segments = url.pathname.split('/');
  const pitchIdx = segments.indexOf('pitch');
  const pitchId = pitchIdx >= 0 ? segments[pitchIdx + 1] : null;
  if (!pitchId) {
    return new Response(JSON.stringify({ success: false, error: 'Pitch ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  }

  const emptyData = {
    totalRaised: 0,
    investorCount: 0,
    avgInvestment: 0,
    targetAmount: null as number | null,
    percentageRaised: 0,
    expectedROI: null as number | null,
    riskLevel: 'medium' as 'low' | 'medium' | 'high',
    isWatchlisted: false,
    hasExpressedInterest: false,
    interestLevel: null as string | null,
  };

  const sql = getDb(env);
  if (!sql) return jsonResponse(emptyData, origin);

  try {
    // Run all queries in parallel
    const [investmentStats, pitchRow, watchlistRow, interestRow] = await Promise.all([
      // Investment stats for this pitch
      sql`
        SELECT
          COALESCE(SUM(amount), 0)::numeric AS total_raised,
          COUNT(*)::int AS investor_count,
          CASE WHEN COUNT(*) > 0 THEN (SUM(amount) / COUNT(*))::numeric ELSE 0 END AS avg_investment
        FROM investments
        WHERE pitch_id::text = ${pitchId}
      `,
      // Pitch budget + genre for risk/ROI calculation
      sql`
        SELECT p.budget, p.genre,
          md.avg_roi
        FROM pitches p
        LEFT JOIN LATERAL (
          SELECT avg_roi FROM market_data
          WHERE genre ILIKE p.genre
          ORDER BY data_date DESC LIMIT 1
        ) md ON true
        WHERE p.id::text = ${pitchId}
        LIMIT 1
      `,
      // Watchlist check for current user
      sql`
        SELECT id FROM investor_watchlist
        WHERE investor_id::text = ${userId} AND pitch_id::text = ${pitchId}
        LIMIT 1
      `,
      // Interest check for current user
      sql`
        SELECT id, interest_level FROM investment_interests
        WHERE investor_id::text = ${userId} AND pitch_id::text = ${pitchId}
        LIMIT 1
      `,
    ]);

    const stats = investmentStats[0] || {};
    const totalRaised = Number(stats.total_raised) || 0;
    const investorCount = Number(stats.investor_count) || 0;
    const avgInvestment = Number(stats.avg_investment) || 0;

    const pitch = pitchRow[0];
    const budget = pitch ? Number(pitch.budget) || 0 : 0;
    const expectedROI = pitch?.avg_roi != null ? Number(pitch.avg_roi) : null;

    // Risk level from budget bracket (same logic as discover page)
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (budget > 0 && budget < 100000) riskLevel = 'low';
    else if (budget >= 1000000) riskLevel = 'high';

    const percentageRaised = budget > 0 ? Math.min(100, (totalRaised / budget) * 100) : 0;

    return jsonResponse({
      totalRaised,
      investorCount,
      avgInvestment,
      targetAmount: budget > 0 ? budget : null,
      percentageRaised: Number(percentageRaised.toFixed(1)),
      expectedROI,
      riskLevel,
      isWatchlisted: watchlistRow.length > 0,
      hasExpressedInterest: interestRow.length > 0,
      interestLevel: interestRow[0]?.interest_level ?? null,
    }, origin);
  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    console.error('[investorPitchInvestmentDetailHandler] Error:', e.message);
    return jsonResponse(emptyData, origin);
  }
}