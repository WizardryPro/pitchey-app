/**
 * Admin manual-recompute of the platform-earned GOLD creator-reputation tier (R13).
 *
 * The promote-only gold recompute (`src/services/creator-reputation.ts`) runs on a
 * daily cron only — if that cron silently freezes, qualified creators stop being
 * promoted and nobody notices. This admin-gated endpoint is the operator escape
 * hatch: trigger the same service on demand and get back what it promoted, with an
 * audit log naming the triggering admin and the promoted creator ids.
 *
 * Mirrors the heat-score recalc precedent: directly registered + excluded from the
 * AdminEndpointsHandler intercept, admin enforced inside the handler.
 *   POST /api/admin/reputation/recompute
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

export async function recomputeReputationHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!sql || !userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, origin, 401);
  }

  try {
    // Same admin gate as recalculateHeatScoresHandler.
    const userResult = await sql`SELECT user_type FROM users WHERE id = ${userId}`;
    if (userResult.length === 0 || userResult[0].user_type !== 'admin') {
      return jsonResponse({ success: false, error: 'Admin access required' }, origin, 403);
    }

    const { recomputeCreatorReputationTiers } = await import('../services/creator-reputation');
    const { promoted, promotedIds } = await recomputeCreatorReputationTiers(env);

    // Audit: who triggered it + exactly which creators were promoted.
    console.log(JSON.stringify({
      level: 'info',
      category: 'reputation',
      action: 'creator_gold_recompute_manual',
      triggeredBy: userId,
      promoted,
      promotedIds,
    }));

    return jsonResponse({ success: true, promoted, promotedIds }, origin);
  } catch (err) {
    // Do NOT swallow — surface as a 500 so a failed recompute is visible, not a
    // silent "nothing promoted". (The service itself is cron-resilient and logs
    // its own internal errors; this catch handles auth/db failures here.)
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('recomputeReputationHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to recompute reputation' }, origin, 500);
  }
}
