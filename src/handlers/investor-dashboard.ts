/**
 * Investor Dashboard Handler with Error Resilience
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { requireRole } from '../utils/auth-extract';

export async function investorDashboardHandler(request: Request, env: Env): Promise<Response> {
  // Require investor role
  const roleCheck = await requireRole(request, env, 'investor');
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  const sql = getDb(env);
  const authenticatedUserId = roleCheck.user.id;
  
  // Always return valid data structure
  const defaultData = {
    totalInvestments: 0,
    portfolioValue: 0,
    activeNDAs: 0,
    savedPitches: 0,
    recentActivity: [],
    investmentBreakdown: {
      preProduction: 0,
      production: 0,
      postProduction: 0,
      released: 0
    },
    analytics: {
      weeklyROI: 0,
      monthlyROI: 0,
      averageInvestment: 0
    }
  };
  
  if (!sql) {
    console.log('Database unavailable, returning default investor data');
    return new Response(JSON.stringify({
      success: true,
      data: defaultData
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }
  
  try {
    // Get user ID from auth
    const userId = authenticatedUserId ? Number(authenticatedUserId) : 2;
    
    // The `ndas` signer column drifts across envs (signer_id is canonical;
    // requester_id is legacy — see CLAUDE.md "NDA signer drift"). Try the
    // canonical column first, fall back to the legacy one, default to 0. Wrapped
    // so a column/table mismatch can't reject the whole Promise.all and zero out
    // the entire dashboard (which it was doing — every investor saw all zeros).
    // Lazy thunks — only run the fallback query if the primary column is absent
    // (building a sql`` template eagerly kicks off the request, so a non-thunk
    // array would fire both and leave an unhandled rejection on the unused one).
    const ndaStatsP = (async () => {
      const variants = [
        () => sql`SELECT COUNT(*) FILTER (WHERE status = 'active' OR status = 'signed') AS active_ndas FROM ndas WHERE signer_id = ${userId}`,
        () => sql`SELECT COUNT(*) FILTER (WHERE status = 'active' OR status = 'signed') AS active_ndas FROM ndas WHERE requester_id = ${userId}`,
      ];
      for (const run of variants) {
        try { return await run(); } catch { /* try the next column variant */ }
      }
      console.error('Investor dashboard nda query: no usable signer column on `ndas`');
      return [{ active_ndas: 0 }];
    })();

    // Simple queries for free tier
    const [investmentStats, ndaStats, savedStats] = await Promise.all([
      sql`
        SELECT
          COUNT(DISTINCT i.id) as total_investments,
          COALESCE(SUM(i.amount), 0) as portfolio_value,
          COALESCE(AVG(i.amount), 0) as avg_investment
        FROM investments i
        WHERE i.investor_id = ${userId}
      `.catch((err: unknown) => { console.error('Investor dashboard investments query error:', err); return [{ total_investments: 0, portfolio_value: 0, avg_investment: 0 }]; }),
      ndaStatsP,
      sql`
        SELECT
          COUNT(*) as saved_count
        FROM saved_pitches
        WHERE user_id = ${userId}
      `.catch((err: unknown) => { console.error('Investor dashboard saved_pitches query error:', err); return [{ saved_count: 0 }]; })
    ]);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        totalInvestments: Number(investmentStats[0]?.total_investments) || 0,
        portfolioValue: Number(investmentStats[0]?.portfolio_value) || 0,
        activeNDAs: Number(ndaStats[0]?.active_ndas) || 0,
        savedPitches: Number(savedStats[0]?.saved_count) || 0,
        recentActivity: [],
        investmentBreakdown: {
          preProduction: 0,
          production: 0,
          postProduction: 0,
          released: 0
        },
        analytics: {
          weeklyROI: 0,
          monthlyROI: 0,
          averageInvestment: Number(investmentStats[0]?.avg_investment) || 0
        }
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
    
  } catch (error) {
    console.error('Investor dashboard query error:', error);
    return new Response(JSON.stringify({
      success: true,
      data: defaultData
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }
}