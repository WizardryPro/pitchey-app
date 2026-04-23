/**
 * Founding-user subscription grant observability.
 *
 * Source of truth for "did the 6-month founding grant (migration 082) apply
 * correctly, how many are still active, and did the daily sweep downgrade
 * the expired ones". Admin-only. Used in lieu of Stripe Dashboard visibility
 * while Stripe is still pre-Go-Live.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}

// GET /api/admin/subscription-grants/status
export async function subscriptionGrantsStatusHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!sql || !userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, origin, 401);
  }

  try {
    const [me] = await sql`SELECT user_type FROM users WHERE id = ${userId}`;
    if (me?.user_type !== 'admin') {
      return jsonResponse({ success: false, error: 'Admin access required' }, origin, 403);
    }

    // Per-status and per-tier breakdown of founding grants. One query, no N+1.
    const summary = await sql`
      SELECT
        sh.status,
        sh.new_tier,
        COUNT(*)::int AS count,
        MIN(sh.period_end) AS earliest_end,
        MAX(sh.period_end) AS latest_end
      FROM subscription_history sh
      WHERE sh.action = 'founding_grant'
        AND sh.stripe_subscription_id IS NULL
      GROUP BY sh.status, sh.new_tier
      ORDER BY sh.status, sh.new_tier
    `;

    // Cross-check: users whose tier + ends_at disagree with their history row.
    // Non-zero here means the sweep missed someone OR a manual edit happened.
    const [drift] = await sql`
      SELECT COUNT(*)::int AS drift_count
      FROM users u
      WHERE u.subscription_ends_at IS NOT NULL
        AND u.subscription_ends_at < NOW()
        AND u.subscription_tier IN ('creator_unlimited', 'production_unlimited', 'exec_unlimited')
        AND u.subscription_status = 'active'
    ` as { drift_count: number }[];

    // How close are we to the next expiry — useful for knowing when support
    // load from confused-downgraded users might spike.
    const [nextExpiry] = await sql`
      SELECT MIN(period_end) AS next_expiry_at, COUNT(*)::int AS expiring_in_7_days
      FROM subscription_history
      WHERE action = 'founding_grant'
        AND status = 'active'
        AND stripe_subscription_id IS NULL
        AND period_end BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    ` as { next_expiry_at: string | null; expiring_in_7_days: number }[];

    return jsonResponse(
      {
        success: true,
        data: {
          summary,
          drift_count: drift?.drift_count ?? 0,
          next_expiry_at: nextExpiry?.next_expiry_at ?? null,
          expiring_in_7_days: nextExpiry?.expiring_in_7_days ?? 0,
          checked_at: new Date().toISOString(),
        },
      },
      origin,
    );
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('subscriptionGrantsStatusHandler error:', e.message);
    return jsonResponse(
      { success: false, error: 'Failed to read grant status' },
      origin,
      500,
    );
  }
}
